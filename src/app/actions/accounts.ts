'use server';

import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { paymentMethods } from '@/db/schema';

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  startingBalance: number;
  balance: number;
}

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const accounts = await db.query.paymentMethods.findMany({ orderBy: [asc(paymentMethods.name)] });
  if (accounts.length === 0) return [];

  const [rows, transferRows] = await Promise.all([db.query.transactions.findMany(), db.query.transfers.findMany()]);

  return accounts.map((account) => {
    let delta = 0;
    for (const t of rows) {
      if (t.paymentMethod !== account.name) continue;
      if (t.type === 'income' || t.type === 'refund') delta += t.amount;
      else if (t.type === 'expense') delta -= t.amount;
    }
    // Transfers move money between accounts — they never touch income/expense totals,
    // only shift balance from one account to another.
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
    };
  });
}
