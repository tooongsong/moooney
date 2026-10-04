'use server';

import { and, eq, gte, lte } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { monthRange, yearRange, daysInMonth, monthOf, dayOf, yearOf, nowPartsIn, safeTimeZone } from '@/lib/dates';
import { aggregateTransactions, trailingMonths, type AggregateInput, type MonthBucket } from '@/lib/spendingAggregate';
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

async function getMonthOverview(
  userId: string,
  anchor: { year: number; month: number },
  now: { year: number; month: number; day: number },
): Promise<OverviewData> {
  const [monthStart, monthEnd] = monthRange(anchor.year, anchor.month);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
    columns: { type: true, amount: true, category: true, date: true },
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  // "Elapsed days" is only "today's day-of-month" when anchor IS the current
  // real month. A fully-past month has ALL its days elapsed, regardless of
  // what day-of-month the anchor Date object happens to represent (e.g. day 1).
  const isCurrentMonth = anchor.year === now.year && anchor.month === now.month;
  const today = isCurrentMonth ? now.day : daysInMonth(anchor.year, anchor.month);

  const dayBuckets = new Map<number, AggregateInput[]>();
  for (const r of rows) {
    const day = dayOf(r.date);
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
    label: monthLabel(anchor.year, anchor.month),
    spend: result.spend,
    income: result.income,
    net: result.net,
    categoryTotals: result.categoryTotals,
    dailyTrend,
    dailyAverage: result.spend / Math.max(1, today),
    monthKey: `${anchor.year}-${String(anchor.month).padStart(2, '0')}`,
  };
}

async function getYearOverview(
  userId: string,
  anchor: { year: number },
  now: { year: number; month: number },
): Promise<OverviewData> {
  const [yearStart, yearEnd] = yearRange(anchor.year);
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), gte(transactions.date, yearStart), lte(transactions.date, yearEnd)),
    columns: { type: true, amount: true, category: true, date: true },
  });

  const result = aggregateTransactions(toAggregateInput(rows));

  const monthBuckets: AggregateInput[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) {
    monthBuckets[monthOf(r.date) - 1].push({ type: r.type, amount: Number(r.amount) || 0, category: r.category });
  }
  const monthlyTrend = monthBuckets.map((bucket, i) => ({ month: i + 1, spend: aggregateTransactions(bucket).spend }));

  // Same principle as getMonthOverview: a fully-past year has all 12 months
  // elapsed, regardless of the anchor Date's own month-of-year.
  const monthsElapsed = anchor.year === now.year ? now.month : 12;

  return {
    period: 'year',
    label: String(anchor.year),
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
    const year = yearOf(r.date);
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

/** "SEPTEMBER 2026" — built from calendar parts, with no Date in the path. */
function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
}

/**
 * Resolves which period to show from the raw URL params, clamped so navigation
 * can't run past the current month/year. "Current" is the user's zone, which is
 * why this lives here rather than in the page: the page has no access to it.
 */
export async function getOverviewData(
  period: OverviewPeriod,
  anchorParams: { month?: string; year?: string } = {},
): Promise<OverviewData> {
  const user = await getUser();
  const tz = safeTimeZone(user.user_metadata?.timezone as string | undefined);
  const now = nowPartsIn(tz);

  if (period === 'month') {
    let anchor = { year: now.year, month: now.month };
    const match = /^(\d{4})-(\d{2})$/.exec(anchorParams.month ?? '');
    if (match) {
      const candidate = { year: Number(match[1]), month: Number(match[2]) };
      const inRange = candidate.month >= 1 && candidate.month <= 12;
      const notFuture = candidate.year < now.year
        || (candidate.year === now.year && candidate.month <= now.month);
      if (inRange && notFuture) anchor = candidate;
    }
    return getMonthOverview(user.id, anchor, now);
  }

  if (period === 'year') {
    const y = Number(anchorParams.year);
    const year = Number.isInteger(y) && y <= now.year ? y : now.year;
    return getYearOverview(user.id, { year }, now);
  }

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
  const years = new Set(rows.map((r) => yearOf(r.date)));
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * The trailing-N-month trend behind the overview's default right panel. The
 * window ends at the user's current month, not the server's — on a UTC host
 * the last few hours of a Pacific month would otherwise land in the next one.
 */
export async function getTrailingTrend(
  months = 12,
): Promise<{ buckets: MonthBucket[]; average: number; peak: number }> {
  const user = await getUser();
  const tz = safeTimeZone(user.user_metadata?.timezone as string | undefined);
  const { year, month } = nowPartsIn(tz);

  const first = trailingMonths([], year, month, months)[0];
  const [windowStart] = monthRange(first.year, first.month);
  const [, windowEnd] = monthRange(year, month);

  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      gte(transactions.date, windowStart),
      lte(transactions.date, windowEnd),
    ),
    columns: { type: true, amount: true, category: true, date: true },
  });

  const buckets = trailingMonths(
    rows.map((r) => ({ type: r.type, amount: Number(r.amount) || 0, category: r.category, date: r.date })),
    year,
    month,
    months,
  );

  const spends = buckets.map((b) => b.spend);
  return {
    buckets,
    average: spends.reduce((a, b) => a + b, 0) / Math.max(1, spends.length),
    peak: Math.max(0, ...spends),
  };
}
