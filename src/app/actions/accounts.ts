'use server';

import { asc, eq, isNull } from 'drizzle-orm';
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
    let delta = 0;

    for (const t of txRows) {
      // Prefer ID match; fall back to name for legacy rows that weren't backfilled
      const matches = t.paymentMethodId
        ? t.paymentMethodId === account.id
        : t.paymentMethod === account.name;
      if (!matches) continue;
      if (t.type === 'income' || t.type === 'refund') delta += t.amount;
      else if (t.type === 'expense') delta -= t.amount;
    }

    for (const tr of trRows) {
      const fromMatches = tr.fromAccountId
        ? tr.fromAccountId === account.id
        : tr.fromAccount === account.name;
      const toMatches = tr.toAccountId
        ? tr.toAccountId === account.id
        : tr.toAccount === account.name;
      if (fromMatches) delta -= tr.amount;
      if (toMatches) delta += tr.amount;
    }

    return {
      id:              account.id,
      name:            account.name,
      type:            account.type,
      institution:     account.institution,
      currency:        account.currency,
      creditLimit:     account.creditLimit,
      startingBalance: account.startingBalance,
      balance:         account.startingBalance + delta,
      isLiability:     LIABILITY_TYPES.has(account.type),
    };
  });
}
