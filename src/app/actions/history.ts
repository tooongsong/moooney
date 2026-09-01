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
  allTime,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, category, account, allTime }),
    category ? Promise.resolve([]) : listTransfers({ query, month, account, allTime }),
  ]);

  const merged: HistoryItem[] = [
    ...txns.map((t) => ({ kind: 'transaction' as const, ...t })),
    ...transferRows.map((t) => ({ kind: 'transfer' as const, ...t })),
  ];

  merged.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  return merged;
}
