'use server';

import { and, eq, gte, lte } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { transactions, type Transfer } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { monthRange, yearRange, nowPartsIn, safeTimeZone } from '@/lib/dates';
import { aggregateTransactions } from '@/lib/spendingAggregate';
import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';
import { listTransactions, type TransactionListRow } from './transactions';
import { listTransfers } from './transfers';

export type HistoryItem = ({ kind: 'transaction' } & TransactionListRow) | ({ kind: 'transfer' } & Transfer);

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

  // date is "YYYY-MM-DD", which sorts correctly as a string; createdAt is a
  // real instant and breaks ties within a day.
  merged.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime());

  return merged;
}


async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Spend per category and per account for the period on screen.
 *
 * Deliberately ignores the category, account and search filters: sizing the
 * filter shapes from the fully filtered set would collapse them to a single
 * circle the moment one is picked. These answer "what is large this month",
 * which stays true while you explore.
 */
export async function getFilterTotals(params: {
  month?: string;
  year?: number;
  allTime?: boolean;
}): Promise<{ categories: { name: string; value: number }[]; accounts: { name: string; value: number }[] }> {
  const user = await getUser();
  const tz = safeTimeZone(user.user_metadata?.timezone as string | undefined);

  let range: [string, string] | null = null;
  if (!params.allTime) {
    if (params.month) {
      range = monthRange(Number(params.month.slice(0, 4)), Number(params.month.slice(5, 7)));
    } else if (params.year) {
      range = yearRange(params.year);
    } else {
      const now = nowPartsIn(tz);
      range = monthRange(now.year, now.month);
    }
  }

  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      range ? gte(transactions.date, range[0]) : undefined,
      range ? lte(transactions.date, range[1]) : undefined,
    ),
    columns: { type: true, amount: true, category: true, paymentMethod: true },
  });

  const spend = rows.filter((r) => r.type !== BALANCE_ADJUSTMENT_TYPE);

  const categories = aggregateTransactions(
    spend.map((r) => ({ type: r.type, amount: Number(r.amount) || 0, category: r.category })),
  ).categoryTotals;

  // Same rules, keyed by account instead of category.
  const accounts = aggregateTransactions(
    spend.map((r) => ({
      type: r.type,
      amount: Number(r.amount) || 0,
      category: r.paymentMethod ?? 'Unassigned',
    })),
  ).categoryTotals;

  return { categories, accounts };
}
