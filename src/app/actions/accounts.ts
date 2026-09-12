'use server';

import { and, asc, eq, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, transactions, transfers } from '@/db/schema';
import { ASSET_TYPES, LIABILITY_TYPES } from '@/lib/accountTypes';
import { toCents } from '@/lib/balanceAdjustment';
import { BALANCE_ADJUSTMENT_TYPE, BALANCE_ADJUSTMENT_CATEGORY } from '@/lib/categories';
import { createClient } from '@/lib/supabase/server';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

// Drizzle returns Postgres `numeric` columns as strings at runtime despite .$type<number>().
// This coerces safely and logs if a DB value was unexpectedly non-numeric.
function toNum(v: unknown, field?: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    console.error(`[accounts] non-numeric value for ${field ?? '?'}:`, v);
    return 0;
  }
  return n;
}

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currency: string;
  creditLimit: number | null;
  startingBalance: number;
  balance: number;
  isLiability: boolean;
}

export interface AccountDetail extends AccountBalance {
  thisMonthIn: number;
  thisMonthOut: number;
}

/**
 * Sums every account's transaction + transfer deltas directly in Postgres —
 * matching the app's "prefer paymentMethodId, fall back to legacy name
 * match" rule for both transactions and transfers (each side of a transfer
 * checked independently) — instead of downloading every transaction/transfer
 * row (with their receipt images, OCR line items, etc.) into the app just to
 * sum them in JS. Only ever returns one small row per account: its id and
 * signed delta.
 */
async function accountDeltas(userId: string): Promise<Map<string, number>> {
  const rows = await db.execute<{ account_id: string; delta: string | number }>(sql`
    SELECT a.id AS account_id, COALESCE(tx.delta, 0) + COALESCE(tr.delta, 0) AS delta
    FROM ${paymentMethods} a
    LEFT JOIN (
      SELECT
        COALESCE(t.payment_method_id, pm.id) AS account_id,
        SUM(
          CASE
            WHEN t.type IN ('income', 'refund', ${BALANCE_ADJUSTMENT_TYPE}) THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            ELSE 0
          END
        ) AS delta
      FROM ${transactions} t
      LEFT JOIN ${paymentMethods} pm
        ON pm.user_id = t.user_id AND pm.name = t.payment_method AND t.payment_method_id IS NULL
      WHERE t.user_id = ${userId}
      GROUP BY COALESCE(t.payment_method_id, pm.id)
    ) tx ON tx.account_id = a.id
    LEFT JOIN (
      SELECT account_id, SUM(delta) AS delta FROM (
        SELECT COALESCE(tr.from_account_id, pf.id) AS account_id, -tr.amount AS delta
        FROM ${transfers} tr
        LEFT JOIN ${paymentMethods} pf
          ON pf.user_id = tr.user_id AND pf.name = tr.from_account AND tr.from_account_id IS NULL
        WHERE tr.user_id = ${userId}
        UNION ALL
        SELECT COALESCE(tr.to_account_id, pt.id) AS account_id, tr.amount AS delta
        FROM ${transfers} tr
        LEFT JOIN ${paymentMethods} pt
          ON pt.user_id = tr.user_id AND pt.name = tr.to_account AND tr.to_account_id IS NULL
        WHERE tr.user_id = ${userId}
      ) combined
      GROUP BY account_id
    ) tr ON tr.account_id = a.id
    WHERE a.user_id = ${userId}
  `);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.account_id, toNum(row.delta, 'account delta'));
  }
  return map;
}

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const user = await getUser();

  const accounts = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.userId, user.id),
    orderBy: [asc(paymentMethods.name)],
  });

  // Exclude archived accounts from the main view
  const active = accounts.filter((a) => !a.archivedAt);
  if (active.length === 0) return [];

  const deltas = await accountDeltas(user.id);

  return active.map((account) => {
    const sb = toNum(account.startingBalance, 'startingBalance');
    const delta = deltas.get(account.id) ?? 0;

    return {
      id:              account.id,
      name:            account.name,
      type:            account.type,
      institution:     account.institution,
      currency:        account.currency,
      creditLimit:     account.creditLimit !== null ? toNum(account.creditLimit, 'creditLimit') : null,
      startingBalance: sb,
      balance:         sb + delta,
      isLiability:     LIABILITY_TYPES.has(account.type),
    };
  });
}

/** This account's income/refund total and expense total for one month,
 * computed in Postgres — same paymentMethodId-then-name matching rule as
 * accountDeltas(), no rows downloaded. */
async function accountMonthFlow(
  userId: string,
  account: { id: string; name: string },
  monthStart: Date,
  monthEnd: Date,
): Promise<{ thisMonthIn: number; thisMonthOut: number }> {
  const rows = await db.execute<{ month_in: string | number | null; month_out: string | number | null }>(sql`
    SELECT
      SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END) AS month_in,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS month_out
    FROM ${transactions}
    WHERE user_id = ${userId}
      AND (payment_method_id = ${account.id} OR (payment_method_id IS NULL AND payment_method = ${account.name}))
      AND date >= ${monthStart} AND date <= ${monthEnd}
  `);
  return {
    thisMonthIn:  toNum(rows[0]?.month_in ?? 0, 'thisMonthIn'),
    thisMonthOut: toNum(rows[0]?.month_out ?? 0, 'thisMonthOut'),
  };
}

export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  const user = await getUser();
  const account = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)),
  });
  if (!account || account.archivedAt) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  // Reuses the same corrected all-account delta computation getAccountBalances
  // uses, rather than a second hand-written copy of the matching rule — the
  // old per-account version here compared a legacy transfer's account NAME
  // against this account's ID (never its name) in the no-ID fallback case,
  // silently excluding un-backfilled legacy transfers from the balance.
  const [deltas, { thisMonthIn, thisMonthOut }] = await Promise.all([
    accountDeltas(user.id),
    accountMonthFlow(user.id, account, monthStart, monthEnd),
  ]);

  const sb = toNum(account.startingBalance, 'startingBalance');
  const delta = deltas.get(account.id) ?? 0;

  return {
    id:              account.id,
    name:            account.name,
    type:            account.type,
    institution:     account.institution,
    currency:        account.currency,
    creditLimit:     account.creditLimit !== null ? toNum(account.creditLimit, 'creditLimit') : null,
    startingBalance: sb,
    balance:         sb + delta,
    isLiability:     LIABILITY_TYPES.has(account.type),
    thisMonthIn,
    thisMonthOut,
  };
}

export async function adjustAccountBalance(
  accountId: string,
  targetBalance: number,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  const detail = await getAccountDetail(accountId);
  if (!detail) return { success: false, error: 'Account not found' };

  // Never trust a client-computed delta — re-derive it here from the
  // account's freshly-read current balance and the requested target.
  const deltaCents = toCents(targetBalance) - toCents(detail.balance);
  if (deltaCents === 0) return { success: true };

  try {
    await db.insert(transactions).values({
      id:              randomUUID(),
      userId:          user.id,
      date:            new Date(),
      amount:          deltaCents / 100,
      type:            BALANCE_ADJUSTMENT_TYPE,
      category:        BALANCE_ADJUSTMENT_CATEGORY,
      merchant:        'Balance adjustment',
      description:     'Balance adjustment',
      paymentMethod:   detail.name,
      paymentMethodId: accountId,
    });

    revalidatePath('/accounts');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('adjustAccountBalance error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
