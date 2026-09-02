'use server';

import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { paymentMethods, transactions, transfers } from '@/db/schema';
import { ASSET_TYPES, LIABILITY_TYPES } from '@/lib/accountTypes';
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

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const user = await getUser();

  const accounts = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.userId, user.id),
    orderBy: [asc(paymentMethods.name)],
  });

  // Exclude archived accounts from the main view
  const active = accounts.filter((a) => !a.archivedAt);
  if (active.length === 0) return [];

  const activeIds = new Set(active.map((a) => a.id));

  const [txRows, trRows] = await Promise.all([
    db.query.transactions.findMany({ where: eq(transactions.userId, user.id) }),
    db.query.transfers.findMany({ where: eq(transfers.userId, user.id) }),
  ]);

  return active.map((account) => {
    const sb = toNum(account.startingBalance, 'startingBalance');
    let delta = 0;

    for (const t of txRows) {
      const matches = t.paymentMethodId
        ? t.paymentMethodId === account.id
        : t.paymentMethod === account.name;
      if (!matches) continue;
      const amt = toNum(t.amount, 'transaction.amount');
      if (t.type === 'income' || t.type === 'refund') delta += amt;
      else if (t.type === 'expense') delta -= amt;
    }

    for (const tr of trRows) {
      const fromMatches = tr.fromAccountId
        ? tr.fromAccountId === account.id
        : tr.fromAccount === account.name;
      const toMatches = tr.toAccountId
        ? tr.toAccountId === account.id
        : tr.toAccount === account.name;
      const amt = toNum(tr.amount, 'transfer.amount');
      if (fromMatches) delta -= amt;
      if (toMatches) delta += amt;
    }

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

export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  const user = await getUser();
  const account = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)),
  });
  if (!account || account.archivedAt) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  // Match by ID; fall back to name for any un-backfilled legacy rows
  const txFilter = or(
    eq(transactions.paymentMethodId, account.id),
    and(isNull(transactions.paymentMethodId), eq(transactions.paymentMethod, account.name)),
  );
  const trFilter = or(
    eq(transfers.fromAccountId, account.id),
    eq(transfers.toAccountId,   account.id),
    and(isNull(transfers.fromAccountId), eq(transfers.fromAccount, account.name)),
    and(isNull(transfers.toAccountId),   eq(transfers.toAccount,   account.name)),
  );

  const [allTxns, allTr, monthTxns] = await Promise.all([
    db.query.transactions.findMany({ where: and(eq(transactions.userId, user.id), txFilter) }),
    db.query.transfers.findMany({ where: and(eq(transfers.userId, user.id), trFilter) }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, user.id),
        txFilter,
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    }),
  ]);

  const sb = toNum(account.startingBalance, 'startingBalance');
  let delta = 0;
  for (const t of allTxns) {
    const amt = toNum(t.amount, 'transaction.amount');
    if (t.type === 'income' || t.type === 'refund') delta += amt;
    else if (t.type === 'expense') delta -= amt;
  }
  for (const tr of allTr) {
    const amt = toNum(tr.amount, 'transfer.amount');
    if ((tr.fromAccountId ?? tr.fromAccount) === (account.id ?? account.name)) delta -= amt;
    if ((tr.toAccountId   ?? tr.toAccount)   === (account.id ?? account.name)) delta += amt;
  }

  let thisMonthIn = 0, thisMonthOut = 0;
  for (const t of monthTxns) {
    const amt = toNum(t.amount, 'transaction.amount');
    if (t.type === 'income' || t.type === 'refund') thisMonthIn  += amt;
    else if (t.type === 'expense')                   thisMonthOut += amt;
  }

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
