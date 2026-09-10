'use server';

import { and, eq, gte, lte } from 'drizzle-orm';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { aggregateTransactions, type AggregateInput } from '@/lib/spendingAggregate';
import { getAccountBalances } from './accounts';
import { computeNetWorth } from '@/lib/accountTypes';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

export type OverviewPeriod = 'month' | 'year' | 'all';

export interface OverviewData {
  period: OverviewPeriod;
  label: string;
  spend: number;
  income: number;
  net: number;
  categoryTotals: { name: string; value: number }[];
  dailyTrend?: { day: number; spend: number }[];
  monthlyTrend?: { month: number; spend: number }[];
  yearlyTrend?: { year: number; spend: number }[];
  dailyAverage?: number;
  monthlyAverage?: number;
  netWorth?: number;
  /** "YYYY-MM" for the queried month — month period only. Computed once,
   * server-side, so the client never has to reconstruct it from "now"
   * (avoids a client/server timezone mismatch right at a month boundary,
   * and avoids a fragile Intl.DateTimeFormat round-trip on the client). */
  monthKey?: string;
}

function toAggregateInput(rows: { type: string; amount: number | string; category: string }[]): AggregateInput[] {
  return rows.map((r) => ({ type: r.type, amount: Number(r.amount) || 0, category: r.category }));
}

async function getMonthOverview(userId: string, now: Date): Promise<OverviewData> {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  const today = now.getDate(); // 1-31, always ≥ 1
  const dayBuckets = new Map<number, AggregateInput[]>();
  for (const r of rows) {
    const day = r.date.getDate();
    if (day > today) continue; // no future days
    if (!dayBuckets.has(day)) dayBuckets.set(day, []);
    dayBuckets.get(day)!.push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const dailyTrend = Array.from({ length: today }, (_, i) => {
    const day = i + 1;
    return { day, spend: aggregateTransactions(dayBuckets.get(day) ?? []).spend };
  });

  return {
    period: 'month',
    label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now).toUpperCase(),
    spend: result.spend,
    income: result.income,
    net: result.net,
    categoryTotals: result.categoryTotals,
    dailyTrend,
    dailyAverage: result.spend / Math.max(1, today),
    monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

async function getYearOverview(userId: string, now: Date): Promise<OverviewData> {
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, yearStart), lte(transactions.date, yearEnd)),
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  const monthBuckets: AggregateInput[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) {
    monthBuckets[r.date.getMonth()].push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const monthlyTrend = monthBuckets.map((bucket, i) => ({ month: i + 1, spend: aggregateTransactions(bucket).spend }));

  const monthsElapsed = now.getMonth() + 1; // getMonth() is 0-indexed; Jan = month 1 elapsed

  return {
    period: 'year',
    label: String(now.getFullYear()),
    spend: result.spend,
    income: result.income,
    net: result.net,
    categoryTotals: result.categoryTotals,
    monthlyTrend,
    monthlyAverage: result.spend / Math.max(1, monthsElapsed),
  };
}

async function getAllOverview(userId: string): Promise<OverviewData> {
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  // Group by calendar year — a Map naturally contains only years that
  // actually have ≥1 transaction, so there is no padding to a fixed range.
  const yearBuckets = new Map<number, AggregateInput[]>();
  for (const r of rows) {
    const year = r.date.getFullYear();
    if (!yearBuckets.has(year)) yearBuckets.set(year, []);
    yearBuckets.get(year)!.push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const yearlyTrend = Array.from(yearBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, bucket]) => ({ year, spend: aggregateTransactions(bucket).spend }));

  const accounts = await getAccountBalances();
  const { netWorth } = computeNetWorth(accounts);

  return {
    period: 'all',
    label: 'ALL TIME',
    spend: result.spend,
    income: result.income,
    net: result.net,
    categoryTotals: result.categoryTotals,
    yearlyTrend,
    netWorth,
  };
}

export async function getOverviewData(period: OverviewPeriod): Promise<OverviewData> {
  const user = await getUser();
  const now = new Date();
  if (period === 'month') return getMonthOverview(user.id, now);
  if (period === 'year') return getYearOverview(user.id, now);
  return getAllOverview(user.id);
}
