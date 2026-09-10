'use server';

import type { Transaction, Transfer } from '@/db/schema';
import { listTransactions } from './transactions';
import { listTransfers } from './transfers';

export type HistoryItem = ({ kind: 'transaction' } & Transaction) | ({ kind: 'transfer' } & Transfer);

export async function listHistoryItems({
  query,
  month,
  year,
  category,
  account,
  allTime,
  includeAdjustments,
}: {
  query?: string;
  month?: string;
  year?: number;
  category?: string;
  account?: string;
  allTime?: boolean;
  includeAdjustments?: boolean;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, year, category, account, allTime, includeAdjustments }),
    category ? Promise.resolve([]) : listTransfers({ query, month, year, account, allTime }),
  ]);

  const merged: HistoryItem[] = [
    ...txns.map((t) => ({ kind: 'transaction' as const, ...t })),
    ...transferRows.map((t) => ({ kind: 'transfer' as const, ...t })),
  ];

  merged.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  return merged;
}
