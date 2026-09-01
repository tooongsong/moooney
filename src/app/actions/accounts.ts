'use server';

import { asc, eq } from 'drizzle-orm';
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
  if (accounts.length === 0) return [];

  const [rows, transferRows] = await Promise.all([
    db.query.transactions.findMany({ where: eq(transactions.userId, user.id) }),
    db.query.transfers.findMany({ where: eq(transfers.userId, user.id) }),
  ]);

  return accounts.map((account) => {
    let delta = 0;
    for (const t of rows) {
      if (t.paymentMethod !== account.name) continue;
      if (t.type === 'income' || t.type === 'refund') delta += t.amount;
      else if (t.type === 'expense') delta -= t.amount;
    }
    for (const tr of transferRows) {
      if (tr.fromAccount === account.name) delta -= tr.amount;
      if (tr.toAccount === account.name) delta += tr.amount;
    }
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      startingBalance: account.startingBalance,
      balance: account.startingBalance + delta,
      isLiability: LIABILITY_TYPES.has(account.type),
    };
  });
}

