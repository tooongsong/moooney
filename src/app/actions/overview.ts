'use server';

import { and, eq, gte, lte } from 'drizzle-orm';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, isSameMonth, isSameYear, getDaysInMonth } from 'date-fns';
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

async function getMonthOverview(userId: string, anchor: Date): Promise<OverviewData> {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
    columns: { type: true, amount: true, category: true, date: true },
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  // "Elapsed days" is only "today's day-of-month" when anchor IS the current
  // real month. A fully-past month has ALL its days elapsed, regardless of
  // what day-of-month the anchor Date object happens to represent (e.g. day 1).
  const realNow = new Date();
  const today = isSameMonth(anchor, realNow) ? realNow.getDate() : getDaysInMonth(anchor);

  const dayBuckets = new Map<number, AggregateInput[]>();
  for (const r of rows) {
    const day = r.date.getDate();
    if (day > today) continue; // only excludes real future days when anchor is the current month
    if (!dayBuckets.has(day)) dayBuckets.set(day, []);
    dayBuckets.get(day)!.push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const dailyTrend = Array.from({ length: today }, (_, i) => {
    const day = i + 1;
    return { day, spend: aggregateTransactions(dayBuckets.get(day) ?? []).spend };
  });

  return {
    period: 'month',
    label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(anchor).toUpperCase(),
    spend: result.spend,
    income: result.income,
    net: result.net,
    categoryTotals: result.categoryTotals,
    dailyTrend,
    dailyAverage: result.spend / Math.max(1, today),
    monthKey: `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`,
  };
}

async function getYearOverview(userId: string, anchor: Date): Promise<OverviewData> {
  const yearStart = startOfYear(anchor);
  const yearEnd = endOfYear(anchor);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, yearStart), lte(transactions.date, yearEnd)),
    columns: { type: true, amount: true, category: true, date: true },
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  const monthBuckets: AggregateInput[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) {
    monthBuckets[r.date.getMonth()].push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const monthlyTrend = monthBuckets.map((bucket, i) => ({ month: i + 1, spend: aggregateTransactions(bucket).spend }));

  // Same principle as getMonthOverview: a fully-past year has all 12 months
  // elapsed, regardless of the anchor Date's own month-of-year.
  const realNow = new Date();
  const monthsElapsed = isSameYear(anchor, realNow) ? realNow.getMonth() + 1 : 12;

  return {
    period: 'year',
    label: String(anchor.getFullYear()),
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
    columns: { type: true, amount: true, category: true, date: true },
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

export async function getOverviewData(period: OverviewPeriod, anchor: Date = new Date()): Promise<OverviewData> {
  const user = await getUser();
  if (period === 'month') return getMonthOverview(user.id, anchor);
  if (period === 'year') return getYearOverview(user.id, anchor);
  return getAllOverview(user.id);
}

/** Distinct years that have ≥1 transaction, ascending. Used by YearPicker
 * to show a data-informed year list without running the full lifetime
 * aggregation (and its extra getAccountBalances round-trip) getAllOverview
 * does — this only needs the `date` column. */
export async function getAvailableYears(): Promise<number[]> {
  const user = await getUser();
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, user.id),
    columns: { date: true },
  });
  const years = new Set(rows.map((r) => r.date.getFullYear()));
  return Array.from(years).sort((a, b) => a - b);
}
