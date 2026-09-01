'use server';

import type { Transaction, Transfer } from '@/db/schema';
import { listTransactions } from './transactions';
import { listTransfers } from './transfers';

export type HistoryItem = ({ kind: 'transaction' } & Transaction) | ({ kind: 'transfer' } & Transfer);

export async function listHistoryItems({
  query,
  month,
  category,
  account,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, category, account }),
    // A category filter only makes sense for transactions — transfers have no category,
    // so they drop out of the list rather than showing up under every filter.
    category ? Promise.resolve([]) : listTransfers({ query, month, account }),
  ]);

  const merged: HistoryItem[] = [
    ...txns.map((t) => ({ kind: 'transaction' as const, ...t })),
    ...transferRows.map((t) => ({ kind: 'transfer' as const, ...t })),
  ];

  merged.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  return merged;
}
