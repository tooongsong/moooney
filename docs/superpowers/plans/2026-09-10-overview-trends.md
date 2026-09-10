# Overview / Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Month / Year / All cash-flow Overview reachable from Home (no new bottom-nav tab), showing spend/income/net, a bold geometric trend visualization, and top categories — reusing Home's aggregation logic and History's existing filters rather than duplicating either.

**Architecture:** One pure aggregation function (`aggregateTransactions`) replaces the inline loop `getHomeData` already has and is reused for all three Overview periods and their trend buckets. A single Server Component (`/overview`) fetches all three periods' data up front in parallel (there's no swipe/anchor-date navigation in this version, so there are only ever exactly three possible datasets); a client component switches between the pre-fetched data with no re-fetch on mode change, which is also what makes the cross-fade/count-up motion between modes instant and simple. One shared `TrendBars` bar-chart component serves all three trend visualizations (daily/monthly/yearly) — they're the same visual grammar at different granularities, per the spec.

**Tech Stack:** Next.js 16 (App Router, Server Components), Drizzle ORM/Postgres, React 19, Tailwind, `motion/react` (already used in `QuickAddIsland.tsx` for this codebase's spring-physics conventions). No test framework — the one pure-logic module is tested with Node's built-in test runner (`node --test`), matching `src/lib/balanceAdjustment.ts`'s precedent; everything else is verified by `tsc --noEmit` plus a real browser check using mock data (this feature is entirely read-only, so unlike the balance-adjustment feature, actual UI verification IS possible without a login — see Task 9).

**Spec:** `docs/superpowers/specs/2026-09-10-overview-trends-design.md`

## Global Constraints

- **No new bottom-nav tab.** Overview is reached only via a link on Home.
- **No swipe/prior-period navigation in this version** — Month/Year/All each show only the current period. Every data shape below is for "now," not an arbitrary anchor date.
- **No category-specific colors anywhere.** Every category shape is the same neutral tone; only size, typography, and position differentiate categories. The single accent color marks exactly one emphasis point per visualization (the #1 category, the highest-spend month), matching `CategoryBreakdown`'s existing #1-gets-accent convention.
- **No chart containers** — no card, border, shadow, or background box around any visualization. No axes, gridlines, or legends.
- **`getHomeData`'s existing return values must stay byte-for-byte identical** after Task 2's refactor — this is a regression-safe extraction, not a behavior change.
- **Averages are always computed with a `Math.max(1, …)` denominator guard** — never trust "today is always day ≥ 1" without the guard also being in the code.
- **All mode's yearly trend only includes years that actually have ≥1 transaction** — never pad to a fixed year range.
- **Don't touch:** Accounts page (no Net Worth/trend data added there), `expense`/`income`/`refund`/`balance_adjustment` handling elsewhere, any file not listed in a task below.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/spendingAggregate.ts` | **New.** Pure aggregation: `aggregateTransactions`. |
| `src/lib/spendingAggregate.test.ts` | **New.** `node --test` coverage. |
| `src/app/actions/transactions.ts` | `getHomeData` calls `aggregateTransactions` instead of its inline loop. |
| `src/app/actions/overview.ts` | **New.** `getOverviewData(period)` for month/year/all. |
| `src/app/history/page.tsx` | Reads and passes through an `allTime` search param. |
| `src/components/TrendBars.tsx` | **New.** Shared bar-chart visualization (daily/monthly/yearly). |
| `src/components/CategoryBlocks.tsx` | **New.** Size-by-value category shapes. |
| `src/components/OverviewClient.tsx` | **New.** Mode state, segmented control, header, cross-fade switching. |
| `src/app/overview/page.tsx` | **New.** Server Component — fetches all three periods, renders the shell. |
| `src/components/BottomNav.tsx` | Home tab's match function also matches `/overview`. |
| `src/app/page.tsx` | Adds an `Overview →` link under "By category". |

---

### Task 1: Pure spending aggregation

**Files:**
- Create: `src/lib/spendingAggregate.ts`
- Test: `src/lib/spendingAggregate.test.ts`

**Interfaces:**
- Produces: `aggregateTransactions(txns: AggregateInput[]): AggregateResult` where `AggregateInput = { type: string; amount: number; category: string }` and `AggregateResult = { spend: number; income: number; net: number; categoryTotals: { name: string; value: number }[] }` (sorted descending by value).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/spendingAggregate.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTransactions } from './spendingAggregate.ts';

test('expense adds to spend and category totals', () => {
  const r = aggregateTransactions([{ type: 'expense', amount: 50, category: 'Dining' }]);
  assert.equal(r.spend, 50);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 50 }]);
});

test('income adds to income, not spend, and does not create a category total', () => {
  const r = aggregateTransactions([{ type: 'income', amount: 1000, category: 'Salary' }]);
  assert.equal(r.income, 1000);
  assert.equal(r.spend, 0);
  assert.deepEqual(r.categoryTotals, []);
});

test('refund subtracts from overall spend but does not touch category totals', () => {
  // Matches getHomeData's original, unrefactored behavior exactly: the old
  // inline loop's refund branch only ever did `monthSpend -= amt` — it never
  // touched categoryTotals (only the expense branch does). This looks like an
  // asymmetry, but changing it would be a behavior change, and Task 2
  // requires getHomeData's output to stay byte-for-byte identical.
  const r = aggregateTransactions([
    { type: 'expense', amount: 100, category: 'Shopping' },
    { type: 'refund', amount: 30, category: 'Shopping' },
  ]);
  assert.equal(r.spend, 70);
  assert.deepEqual(r.categoryTotals, [{ name: 'Shopping', value: 100 }]);
});

test('balance_adjustment and any other unrecognized type contribute nothing', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 20, category: 'Dining' },
    { type: 'balance_adjustment', amount: 500, category: 'Balance Adjustment' },
    { type: 'some_future_type', amount: 999, category: 'Whatever' },
  ]);
  assert.equal(r.spend, 20);
  assert.equal(r.income, 0);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 20 }]);
});

test('net is income minus spend, can be negative', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 100, category: 'Dining' },
    { type: 'income', amount: 40, category: 'Salary' },
  ]);
  assert.equal(r.net, -60);
});

test('categoryTotals is sorted descending by value', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 10, category: 'Small' },
    { type: 'expense', amount: 90, category: 'Big' },
    { type: 'expense', amount: 40, category: 'Medium' },
  ]);
  assert.deepEqual(r.categoryTotals.map((c) => c.name), ['Big', 'Medium', 'Small']);
});

test('same category across multiple transactions sums together', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 10, category: 'Dining' },
    { type: 'expense', amount: 15, category: 'Dining' },
  ]);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 25 }]);
});

test('empty input returns all-zero result', () => {
  const r = aggregateTransactions([]);
  assert.equal(r.spend, 0);
  assert.equal(r.income, 0);
  assert.equal(r.net, 0);
  assert.deepEqual(r.categoryTotals, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/spendingAggregate.test.ts`
Expected: FAIL — `Cannot find module './spendingAggregate.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/spendingAggregate.ts`:

```ts
export interface AggregateInput {
  type: string;
  amount: number;
  category: string;
}

export interface AggregateResult {
  spend: number;
  income: number;
  net: number;
  categoryTotals: { name: string; value: number }[];
}

// Mirrors the exact type-branching rule getHomeData always used: expense adds
// to spend, income adds to income, refund subtracts from spend. Any other
// type (balance_adjustment, or a future type) contributes nothing — there is
// deliberately no trailing else/default branch, same as the original inline
// loop this was extracted from.
export function aggregateTransactions(txns: AggregateInput[]): AggregateResult {
  let spend = 0;
  let income = 0;
  const categoryTotals = new Map<string, number>();

  for (const t of txns) {
    if (t.type === 'expense') {
      spend += t.amount;
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
    } else if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'refund') {
      spend -= t.amount;
    }
  }

  return {
    spend,
    income,
    net: income - spend,
    categoryTotals: Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/spendingAggregate.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spendingAggregate.ts src/lib/spendingAggregate.test.ts
git commit -m "Add pure spending-aggregation function with tests"
```

---

### Task 2: Refactor `getHomeData` to use the shared aggregator

**Files:**
- Modify: `src/app/actions/transactions.ts`

**Interfaces:**
- Consumes: `aggregateTransactions` from Task 1.
- Produces: no change to `getHomeData`'s existing return shape or values — this is a pure refactor.

- [ ] **Step 1: Import the shared function**

Add to the imports in `src/app/actions/transactions.ts`:

```ts
import { aggregateTransactions } from '@/lib/spendingAggregate';
```

- [ ] **Step 2: Replace the inline loop**

Change:

```ts
  let monthSpend = 0;
  let monthIncome = 0;
  let todaySpend = 0;
  const categoryTotals = new Map<string, number>();

  for (const t of monthTxns) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') {
      monthSpend += amt;
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + amt);
      if (t.date >= todayStart && t.date <= todayEnd) todaySpend += amt;
    } else if (t.type === 'income') {
      monthIncome += amt;
    } else if (t.type === 'refund') {
      monthSpend -= amt;
      if (t.date >= todayStart && t.date <= todayEnd) todaySpend -= amt;
    }
  }

  const categoryData = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    monthSpend,
    todaySpend,
    monthIncome,
    monthBalance: monthIncome - monthSpend,
    categoryData,
    recent,
  };
```

to:

```ts
  const monthResult = aggregateTransactions(
    monthTxns.map((t) => ({ type: t.type, amount: Number(t.amount) || 0, category: t.category }))
  );

  // todaySpend needs a same-day sub-filter aggregateTransactions doesn't do —
  // kept as its own small loop rather than folded into the shared function.
  let todaySpend = 0;
  for (const t of monthTxns) {
    if (t.date < todayStart || t.date > todayEnd) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') todaySpend += amt;
    else if (t.type === 'refund') todaySpend -= amt;
  }

  return {
    monthSpend: monthResult.spend,
    todaySpend,
    monthIncome: monthResult.income,
    monthBalance: monthResult.net,
    categoryData: monthResult.categoryTotals,
    recent,
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Regression check**

This refactor must not change `getHomeData`'s output. Read through the old vs new logic once more by hand: for every transaction in `monthTxns`, the old loop and `aggregateTransactions` apply the identical `expense`/`income`/`refund` rule with the identical `Number(t.amount) || 0` coercion — confirm this by comparing the two code blocks side by side, not by running the app (no test harness exists for this function; this is a logic-equivalence review, not a live test).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/transactions.ts
git commit -m "Refactor getHomeData to use the shared spending aggregator"
```

---

### Task 3: `getOverviewData` server action

**Files:**
- Create: `src/app/actions/overview.ts`

**Interfaces:**
- Consumes: `aggregateTransactions` (Task 1); `getAccountBalances` and `computeNetWorth` (already exist, `src/app/actions/accounts.ts` and `src/lib/accountTypes.ts` — signatures: `getAccountBalances(): Promise<AccountBalance[]>`, `computeNetWorth(accounts: {type:string; balance:number}[]): {netWorth:number; totalAssets:number; totalLiabilities:number}`).
- Produces: `getOverviewData(period: OverviewPeriod): Promise<OverviewData>`, consumed by Task 8 (`/overview/page.tsx`).

- [ ] **Step 1: Write the file**

Create `src/app/actions/overview.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Hand-trace the safeguards**

No live DB access is available for this task (matches the constraint noted in the balance-adjustment plan — this environment has no test database). Verify by reading the code:
- Zero transactions this month: `rows = []`, `dailyTrend` still has `today` entries (all zero-spend, since `Array.from({length: today}, ...)` always runs regardless of `rows`), `dailyAverage = 0 / Math.max(1, today) = 0`, not `NaN`.
- January (`now.getMonth() = 0`): `monthsElapsed = 0 + 1 = 1`, `monthlyAverage = spend / 1`, not divided by 12.
- Zero transactions ever: `yearBuckets` stays empty, `yearlyTrend = []`. `netWorth` still resolves since `getAccountBalances()` doesn't depend on transaction history.
- Transactions only in 2023 and 2026: `yearBuckets` has exactly 2 keys, `yearlyTrend` has exactly 2 entries, sorted ascending.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/overview.ts
git commit -m "Add getOverviewData server action for Month/Year/All periods"
```

---

### Task 4: History page reads `allTime` from the URL

**Files:**
- Modify: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `listHistoryItems`'s existing `allTime?: boolean` param (already implemented, unused by this page today).
- Produces: `/history?allTime=true` now actually shows all-time results, consumed by Task 8's "View all →" link in All mode.

- [ ] **Step 1: Add `allTime` to the searchParams type and destructuring**

Change:

```ts
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; category?: string; account?: string }>;
}) {
  const params = await searchParams;
  const [data, categories, accountNames] = await Promise.all([
    listHistoryItems({
      query:    params.q,
      month:    params.month,
      category: params.category,
      account:  params.account,
    }),
```

to:

```ts
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; category?: string; account?: string; allTime?: string }>;
}) {
  const params = await searchParams;
  const [data, categories, accountNames] = await Promise.all([
    listHistoryItems({
      query:      params.q,
      month:      params.month,
      category:   params.category,
      account:    params.account,
      allTime:    params.allTime === 'true',
    }),
```

Note `allTime` arrives as the string `"true"` from the URL query string, not a boolean — the `=== 'true'` comparison is the coercion, matching how every other value in this same `searchParams` type is already a string.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Known limitation — do not fix in this task**

`MonthFilter` (`src/components/MonthFilter.tsx`) is unaware of `allTime` — it will keep displaying the current month's label even when `allTime=true` is active and the list below it shows everything. This is an accepted, out-of-scope rough edge (flagged in the spec) — do not modify `MonthFilter` as part of this task.

- [ ] **Step 4: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "History page: read and pass through allTime search param"
```

---

### Task 5: `TrendBars` shared bar-chart component

**Files:**
- Create: `src/components/TrendBars.tsx`

**Interfaces:**
- Produces: `<TrendBars items={{ key: string; value: number; href?: string }[]} labelEvery?: number />`. Used by Task 7 three ways: 12 items for Year mode (`labelEvery=1`, each with an `href` to `/history?month=YYYY-MM`), up to 31 items for Month mode (`labelEvery=5`, no `href`), and N items for All mode (`labelEvery=1`, no `href`).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

const CHART_HEIGHT = 128; // px

export interface TrendBarItem {
  key: string;
  value: number;
  href?: string;
}

interface TrendBarsProps {
  items: TrendBarItem[];
  labelEvery?: number;
}

export function TrendBars({ items, labelEvery = 1 }: TrendBarsProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  const max = Math.max(1, ...items.map((i) => i.value));
  const maxIndex = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0);
  const hasSpend = items.some((i) => i.value > 0);
  const gapClass = items.length > 20 ? 'gap-0.5' : items.length > 6 ? 'gap-1.5' : 'gap-3';

  return (
    <div className={`flex items-end ${gapClass}`} style={{ height: CHART_HEIGHT + 20 }}>
      {items.map((item, i) => {
        const heightPx = item.value > 0 ? Math.max(6, (item.value / max) * CHART_HEIGHT) : 3;
        const isMax = hasSpend && i === maxIndex;
        const Tag = item.href ? 'button' : 'div';

        return (
          <Tag
            key={item.key}
            {...(item.href ? { type: 'button' as const, onClick: () => router.push(item.href!) } : {})}
            className="flex-1 flex flex-col items-center justify-end gap-1.5 active:scale-[0.97] transition-transform"
            style={{ height: CHART_HEIGHT + 20 }}
          >
            <motion.div
              className="w-full rounded-t-full"
              style={{ background: isMax ? 'var(--accent)' : 'var(--ink)' }}
              initial={{ height: 0 }}
              animate={{ height: heightPx }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            />
            {i % labelEvery === 0 && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-ink-faint shrink-0">
                {item.key}
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This checks the conditional `Tag`/spread-props pattern type-checks — if it doesn't, the fallback is two separate render branches, one `<button>` one `<div>`, rather than a dynamic tag; do that instead if TypeScript rejects the dynamic-tag approach, and note it in your report.)

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendBars.tsx
git commit -m "Add shared TrendBars bar-chart visualization"
```

---

### Task 6: `CategoryBlocks` component

**Files:**
- Create: `src/components/CategoryBlocks.tsx`

**Interfaces:**
- Produces: `<CategoryBlocks data={{ name: string; value: number }[]} />` — same data shape as `aggregateTransactions`' `categoryTotals` / `CategoryBreakdown`'s existing prop, but a distinct size-by-value shape presentation. Used by Task 7 for all three modes' "Top Categories" section.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';

interface CategoryBlocksProps {
  data: { name: string; value: number }[];
}

const MAX_SHOWN = 5;
const MIN_SIZE = 64;
const MAX_SIZE = 132;

export function CategoryBlocks({ data }: CategoryBlocksProps) {
  if (data.length === 0) {
    return (
      <p className="text-2xl font-bold tracking-tighter text-ink-faint leading-tight py-2">
        NO SPENDING<br />YET.
      </p>
    );
  }

  const top = data.slice(0, MAX_SHOWN);
  const max = top[0].value;

  return (
    <div className="flex flex-wrap items-end gap-4">
      {top.map((entry, i) => {
        const size = max > 0 ? MIN_SIZE + (entry.value / max) * (MAX_SIZE - MIN_SIZE) : MIN_SIZE;
        const isTop = i === 0;

        return (
          <motion.div
            key={entry.name}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
            className="flex flex-col items-center justify-center text-center shrink-0 px-2"
            style={{
              width: size,
              height: size,
              borderRadius: isTop ? '48% 52% 50% 50% / 52% 48% 52% 48%' : '9999px',
              background: isTop ? 'var(--accent)' : 'var(--sand)',
            }}
          >
            <span className={`text-[8px] font-bold uppercase tracking-widest truncate max-w-full ${isTop ? 'text-white/80' : 'text-ink-faint'}`}>
              {entry.name}
            </span>
            <span className={`text-sm font-bold tabular-nums ${isTop ? 'text-white' : 'text-ink'}`}>
              {formatCurrency(entry.value)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryBlocks.tsx
git commit -m "Add CategoryBlocks size-by-value category visualization"
```

---

### Task 7: `BottomNav` + Home entry link

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a working `Overview →` link on Home (target route doesn't exist until Task 8 — this task can land and typecheck independently; the link will 404 until Task 8 merges, which is fine within this plan's own sequencing since tasks land in order).

- [ ] **Step 1: Update BottomNav's Home match function**

In `src/components/BottomNav.tsx`, change:

```ts
const TABS = [
  { href: '/',         icon: Home,       label: 'Home',     match: (p: string) => p === '/' },
  { href: '/accounts', icon: Wallet,     label: 'Accounts', match: (p: string) => p.startsWith('/accounts') },
  { href: '/history',  icon: ListFilter, label: 'History',  match: (p: string) => p === '/history' },
];
```

to:

```ts
const TABS = [
  { href: '/',         icon: Home,       label: 'Home',     match: (p: string) => p === '/' || p === '/overview' },
  { href: '/accounts', icon: Wallet,     label: 'Accounts', match: (p: string) => p.startsWith('/accounts') },
  { href: '/history',  icon: ListFilter, label: 'History',  match: (p: string) => p === '/history' },
];
```

- [ ] **Step 2: Add the Home entry link**

In `src/app/page.tsx`, add the import:

```ts
import { ArrowRight, Settings2 } from 'lucide-react';
```
(already imports `ArrowRight` — no new icon import needed here.)

Change:

```tsx
          <section className="pb-8 border-b border-line">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">By category</h2>
            <CategoryBreakdown data={categoryData} />
          </section>
```

to:

```tsx
          <section className="pb-8 border-b border-line">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">By category</h2>
            <CategoryBreakdown data={categoryData} />
            <Link href="/overview" className="mt-4 inline-flex items-center gap-0.5 text-xs text-ink-faint hover:text-ink transition-colors">
              Overview <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
```

(`Link` is already imported at the top of this file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx src/app/page.tsx
git commit -m "Add Overview entry link on Home; BottomNav highlights Home on /overview"
```

---

### Task 8: `OverviewClient` + `/overview` page

**Files:**
- Create: `src/components/OverviewClient.tsx`
- Create: `src/app/overview/page.tsx`

**Interfaces:**
- Consumes: `getOverviewData` (Task 3), `TrendBars` (Task 5), `CategoryBlocks` (Task 6), `ResponsiveAmount` (existing), `OverviewData`/`OverviewPeriod` types (Task 3).
- Produces: the `/overview` route itself — the last piece before manual verification (Task 9).

- [ ] **Step 1: Write `OverviewClient`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { animate, AnimatePresence, motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { CategoryBlocks } from '@/components/CategoryBlocks';
import { formatCurrency } from '@/lib/utils';
import type { OverviewData, OverviewPeriod } from '@/app/actions/overview';

interface OverviewClientProps {
  month: OverviewData;
  year: OverviewData;
  all: OverviewData;
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function AnimatedAmount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.35,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <ResponsiveAmount value={display} baseSize={56} minSize={28} />;
}

export function OverviewClient({ month, year, all }: OverviewClientProps) {
  const [mode, setMode] = useState<OverviewPeriod>('month');
  const data = mode === 'month' ? month : mode === 'year' ? year : all;

  const trendItems: TrendBarItem[] =
    mode === 'month'
      ? (data.dailyTrend ?? []).map((d) => ({ key: String(d.day).padStart(2, '0'), value: d.spend }))
      : mode === 'year'
        ? (data.monthlyTrend ?? []).map((m) => ({
            key: MONTH_NAMES[m.month - 1],
            value: m.spend,
            href: `/history?month=${year.label}-${String(m.month).padStart(2, '0')}`,
          }))
        : (data.yearlyTrend ?? []).map((y) => ({ key: String(y.year), value: y.spend }));

  const labelEvery = mode === 'month' ? 5 : 1;

  const viewAllHref =
    mode === 'month'
      ? `/history?month=${month.monthKey}`
      : mode === 'all'
        ? '/history?allTime=true'
        : '/history'; // year mode: known deviation, see spec — falls back to History's own current-month default

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-4">Overview</p>

      <div className="flex gap-2 mb-8">
        {(['month', 'year', 'all'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${
              mode === m ? 'bg-ink text-paper' : 'bg-sand text-ink-soft'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <section className="pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-3">
              {data.label} SPENDING
            </p>
            <AnimatedAmount value={data.spend} />
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-ink-faint">Income <span className="font-bold text-ink tabular-nums">{formatCurrency(data.income)}</span></span>
              <span className="text-ink-faint">
                Net <span className={`font-bold tabular-nums ${data.net >= 0 ? 'text-ink' : 'text-accent'}`}>
                  {data.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(data.net))}
                </span>
              </span>
              {data.dailyAverage !== undefined && (
                <span className="text-ink-faint">Daily avg <span className="font-bold text-ink tabular-nums">{formatCurrency(data.dailyAverage)}</span></span>
              )}
              {data.monthlyAverage !== undefined && (
                <span className="text-ink-faint">Avg/month <span className="font-bold text-ink tabular-nums">{formatCurrency(data.monthlyAverage)}</span></span>
              )}
              {data.netWorth !== undefined && (
                <span className="text-ink-faint">Net worth <span className="font-bold text-ink tabular-nums">{formatCurrency(data.netWorth)}</span></span>
              )}
            </div>
          </section>

          <section className="pb-8 border-b border-line">
            <TrendBars items={trendItems} labelEvery={labelEvery} />
          </section>

          <section className="pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">Top Categories</h2>
            <CategoryBlocks data={data.categoryTotals} />
            {data.categoryTotals.length > 0 && (
              <Link href={viewAllHref} className="mt-4 inline-flex items-center gap-0.5 text-xs text-ink-faint hover:text-ink transition-colors">
                View all →
              </Link>
            )}
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/overview/page.tsx`:

```tsx
import { getOverviewData } from '@/app/actions/overview';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

export default async function OverviewPage() {
  const [month, year, all] = await Promise.all([
    getOverviewData('month'),
    getOverviewData('year'),
    getOverviewData('all'),
  ]);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      <section className="pt-2 lg:pt-8">
        <OverviewClient month={month} year={year} all={all} />
      </section>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If the `AnimatedAmount` component's `animate(display, value, {...})` plain-number-tweening call doesn't typecheck against `motion/react`'s types, fall back to a simpler non-animated `<ResponsiveAmount value={data.spend} .../>` (drop the count-up for `spend` specifically) and note this substitution clearly in your report — the count-up is a motion nicety, not a functional requirement.

- [ ] **Step 4: Commit**

```bash
git add src/components/OverviewClient.tsx src/app/overview/page.tsx
git commit -m "Add Overview page: mode switching, trend, and category visualizations"
```

---

### Task 9: Visual verification with mock data

**Files:**
- Temporary only (not committed as part of the feature): a throwaway preview route and a temporary `proxy.ts` exclusion, both reverted at the end of this task.

**Interfaces:**
- Consumes: `OverviewClient` (Task 8) directly, fed hand-built mock `OverviewData` for all three periods — this feature is entirely read-only, so unlike the balance-adjustment feature this CAN be verified in a real browser without logging in, by bypassing auth for a temporary route the same way earlier UI work in this project verified `QuickAddIsland`.

- [ ] **Step 1: Set up the temporary preview**

Temporarily add a route exclusion to `src/proxy.ts`'s matcher (the same pattern used previously in this project for exactly this purpose — add `|devpreview-overview` to the negative-lookahead group), and create `src/app/devpreview-overview/page.tsx` that renders `<OverviewClient>` with three hand-built `OverviewData` objects (realistic numbers: a month with ~15-20 days of varied daily spend including some zero-spend days, a year with all 12 months populated with varied amounts including one clear maximum month, an all-time view with 2-4 years of data with a gap year to verify the "only years with data" safeguard visually, and at least 4 categories so `CategoryBlocks` shows its full 3-5 range). Do not import from any server action — the mock data is inline literals in this file.

- [ ] **Step 2: Run the dev server and check every mode**

Start the dev server, navigate to `/devpreview-overview`, and verify against the spec:
- No card/border/shadow wraps any visualization.
- No axis lines, no gridlines, no legend.
- Only ink/paper/sand/accent colors appear anywhere — no per-category colors.
- Year mode: 12 rounded-top bars, visible gaps, the highest-spend month is accent-colored, others ink-colored, month labels under every bar.
- Month mode: bars spring in, labels appear only every 5th day, zero-spend days render as a visible stub not a gap.
- All mode: bars only for years with data (confirm the mock's gap year produces no bar for that year).
- Category blocks: the #1 category is visibly larger, accent-colored, and has the asymmetric corner radius; sizes scale visibly by value; no more than 5 shown even if the mock has more.
- Tap a bar in Year mode — confirm the press-scale feedback and that it attempts to navigate to `/history?month=...` (the destination page itself doesn't need to load real data for this check, just confirm the URL it navigates to is correct).
- Switch between Month/Year/All — confirm the cross-fade transition (not a hard cut) and that the big number visibly counts up/down rather than snapping.
- Resize to a narrow mobile width if not already testing at one — confirm the 31-bar month view doesn't overflow or wrap.

Fix anything that doesn't match before proceeding — this is the actual design QA for the entire feature, not optional.

- [ ] **Step 3: Revert the temporary preview**

```bash
git diff src/proxy.ts  # confirm only the devpreview-overview exclusion is present, revert it
rm -rf src/app/devpreview-overview
```

Restore `src/proxy.ts` to not include the temporary exclusion (it should end up identical to how Task 4 left it — verify with `git diff` showing no changes to `proxy.ts` after reverting).

- [ ] **Step 4: Final typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms the devpreview route's removal didn't leave any dangling reference).

- [ ] **Step 5: Report**

No commit for this task — it's verification-only and its temporary artifacts are reverted, not shipped. Report what was checked, what (if anything) was fixed as a result, and confirm the working tree is clean of the temporary preview (`git status` shows no trace of `devpreview-overview` or a modified `proxy.ts`).
