# Shared Period Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Overview and History navigate to any historical month/year (not just "current"), with the period living in the URL, via one shared `PeriodNavigator`/`MonthPicker`/`YearPicker` set of components used by both pages.

**Architecture:** Overview moves from eagerly prefetching month+year+all up front (only viable when every mode showed exactly one fixed "current" thing) to a single URL-driven fetch per page load — `/overview` reads `period`/`month`/`year` from `searchParams`, resolves an anchor `Date`, and fetches just that one period. `getOverviewData` gains an `anchor` parameter it already had the shape for internally. History gets a new `year` filter mirroring its existing `month`/`allTime` params. Both pages' navigation goes through `router.push` wrapped in `startTransition` so the page shell never unmounts/flickers between period changes — only the data-dependent content re-renders.

**Tech Stack:** Next.js 16 (App Router, Server Components, `useTransition`), Drizzle ORM/Postgres, `date-fns` (already a dependency), `motion/react`, `@radix-ui/react-dialog` (via the existing `src/components/ui/dialog.tsx` wrapper — repurposed as a bottom sheet via inline positioning styles, no new dependency). No test framework — the one genuinely tricky pure logic (the elapsed-days/months anchor fix) is verified by hand-trace against real date-fns semantics; the rest is read-only UI verified live in a browser with mock data, same as the previous Overview plan's Task 9.

**Spec:** `docs/superpowers/specs/2026-09-10-period-navigation-design.md`

## Global Constraints

- **PeriodNavigator's arrows: large tap target (~44×44px via padding), small icon (`h-3.5 w-3.5`, thin stroke).** The row must stay visually compact — the icon shrinking is what keeps it looking editorial, not chunky.
- **Never disable a month/year in a picker for lacking transaction data.** The only disabled state anywhere is "later than the current real month/year" (an actual future period, not an empty historical one).
- **No page flicker on period navigation.** The page shell (title, mode tabs, `PeriodNavigator`) must not remount between navigations — only the data-dependent section (hero number, trend, categories) re-renders/re-animates, keyed by the new period+anchor.
- **Consistent period-context handoff**: Year-mode bars → `/overview?period=month&month=...` (not History). Month mode's "View all" → `/history?month=...`. Year mode's "View all" → `/history?year=...`. All mode's "View all" → `/history?allTime=true`.
- **No change to `aggregateTransactions` or any expense/income/refund/category math.** This plan only touches which period gets fetched and how it's picked.
- **Don't touch:** Accounts, balance-adjustment code, CategoryBreakdown (Home's own component, separate from Overview's CategoryBlocks), any file not listed in a task below.

---

## File Structure

| File | Change |
|---|---|
| `src/app/actions/overview.ts` | `getOverviewData` gains `anchor` param; fixes the elapsed-days/months bug for non-current anchors; adds `getAvailableYears()`. |
| `src/app/actions/transactions.ts` | `listTransactions` gains a `year?: number` filter. |
| `src/app/actions/history.ts` | `listHistoryItems` threads `year` through. |
| `src/components/PeriodNavigator.tsx` | **New.** Shared `[←] label [→]` row. |
| `src/components/MonthPicker.tsx` | **New.** Bottom-sheet month grid. |
| `src/components/YearPicker.tsx` | **New.** Bottom-sheet year list. |
| `src/components/OverviewClient.tsx` | Rewritten: single `data`/`period` props (not month+year+all), URL-driven navigation, pickers wired in. |
| `src/app/overview/page.tsx` | Rewritten: reads `searchParams`, resolves anchor, single fetch. |
| `src/components/HistoryPeriodNav.tsx` | **New.** Small wrapper: `PeriodNavigator` + `MonthPicker` wired to History's `?month=` param. |
| `src/app/history/page.tsx` | Swaps `MonthFilter` for `HistoryPeriodNav`; reads `year` from `searchParams`. |
| `src/components/MonthFilter.tsx` | **Deleted** once nothing imports it. |

---

### Task 1: Data layer — anchor parameter and the elapsed-time bug fix

**Files:**
- Modify: `src/app/actions/overview.ts`

**Interfaces:**
- Produces: `getOverviewData(period: OverviewPeriod, anchor: Date = new Date())`; `getAvailableYears(): Promise<number[]>` — consumed by Task 6 (Overview's YearPicker wiring).

- [ ] **Step 1: Update imports**

Change:
```ts
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
```
to:
```ts
import { startOfMonth, endOfMonth, startOfYear, endOfYear, isSameMonth, isSameYear, getDaysInMonth } from 'date-fns';
```

- [ ] **Step 2: Fix `getMonthOverview` — rename `now` to `anchor`, fix the elapsed-days bug**

Change the full function to:
```ts
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
```

- [ ] **Step 3: Fix `getYearOverview` — rename `now` to `anchor`, fix the elapsed-months bug**

Change the full function to:
```ts
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
```

- [ ] **Step 4: Update `getOverviewData` to accept and thread the anchor**

Change:
```ts
export async function getOverviewData(period: OverviewPeriod): Promise<OverviewData> {
  const user = await getUser();
  const now = new Date();
  if (period === 'month') return getMonthOverview(user.id, now);
  if (period === 'year') return getYearOverview(user.id, now);
  return getAllOverview(user.id);
}
```
to:
```ts
export async function getOverviewData(period: OverviewPeriod, anchor: Date = new Date()): Promise<OverviewData> {
  const user = await getUser();
  if (period === 'month') return getMonthOverview(user.id, anchor);
  if (period === 'year') return getYearOverview(user.id, anchor);
  return getAllOverview(user.id);
}
```

- [ ] **Step 5: Add `getAvailableYears`**

Append to the file:
```ts
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
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`getAllOverview` is unchanged by this task — it takes no anchor, per the spec's non-goal that All mode has no anchor concept.)

- [ ] **Step 7: Hand-trace the fix**

No live DB in this environment — verify by reading the code:
- Anchor = current real month → `isSameMonth` true → `today = realNow.getDate()`, identical to today's existing behavior (regression-safe for the common case).
- Anchor = 3 months ago → `isSameMonth` false → `today = getDaysInMonth(anchor)` (28-31), `dailyTrend` has that many entries, none skipped by the `day > today` guard.
- Anchor = a year 2 years ago → `isSameYear` false → `monthsElapsed = 12`, `monthlyAverage = spend / 12`.
- Anchor = the current real year → `isSameYear` true → `monthsElapsed = realNow.getMonth() + 1`, identical to today's existing behavior.

- [ ] **Step 8: Commit**

```bash
git add src/app/actions/overview.ts
git commit -m "Add anchor param to getOverviewData; fix elapsed-time math for past periods"
```

---

### Task 2: History gets a `year` filter

**Files:**
- Modify: `src/app/actions/transactions.ts`
- Modify: `src/app/actions/history.ts`

**Interfaces:**
- Produces: `listTransactions`/`listHistoryItems` gain `year?: number`, consumed by Task 7 (History page reading `?year=` from the URL).

- [ ] **Step 1: Add `year` to `listTransactions`**

Change:
```ts
export async function listTransactions({
  query,
  month,
  category,
  account,
  allTime,
  includeAdjustments,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
  includeAdjustments?: boolean;
}) {
  const user = await getUser();

  let dateFilter;
  if (!allTime) {
    const parsed = month ? parse(month, 'yyyy-MM', new Date()) : new Date();
    dateFilter = and(
      gte(transactions.date, startOfMonth(parsed)),
      lte(transactions.date, endOfMonth(parsed)),
    );
  }

  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      dateFilter,
      category ? eq(transactions.category, category) : undefined,
      account ? eq(transactions.paymentMethod, account) : undefined,
      query ? or(like(transactions.merchant, `%${query}%`), like(transactions.description, `%${query}%`)) : undefined,
      includeAdjustments ? undefined : ne(transactions.type, BALANCE_ADJUSTMENT_TYPE),
    ),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
  });
}
```
to:
```ts
export async function listTransactions({
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
}) {
  const user = await getUser();

  let dateFilter;
  if (!allTime) {
    if (month) {
      const parsed = parse(month, 'yyyy-MM', new Date());
      dateFilter = and(gte(transactions.date, startOfMonth(parsed)), lte(transactions.date, endOfMonth(parsed)));
    } else if (year) {
      const parsed = new Date(year, 0, 1);
      dateFilter = and(gte(transactions.date, startOfYear(parsed)), lte(transactions.date, endOfYear(parsed)));
    } else {
      const parsed = new Date();
      dateFilter = and(gte(transactions.date, startOfMonth(parsed)), lte(transactions.date, endOfMonth(parsed)));
    }
  }

  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      dateFilter,
      category ? eq(transactions.category, category) : undefined,
      account ? eq(transactions.paymentMethod, account) : undefined,
      query ? or(like(transactions.merchant, `%${query}%`), like(transactions.description, `%${query}%`)) : undefined,
      includeAdjustments ? undefined : ne(transactions.type, BALANCE_ADJUSTMENT_TYPE),
    ),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
  });
}
```
Note `month` takes precedence over `year` when both are present (the `if (month) ... else if (year) ...` chain), per the spec.

Add `startOfYear, endOfYear` to this file's existing `date-fns` import (it already imports `startOfMonth, endOfMonth, startOfDay, endOfDay, parse` — add the two year ones to that same import line).

- [ ] **Step 2: Thread `year` through `listHistoryItems`**

In `src/app/actions/history.ts`, change:
```ts
export async function listHistoryItems({
  query,
  month,
  category,
  account,
  allTime,
  includeAdjustments,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
  includeAdjustments?: boolean;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, category, account, allTime, includeAdjustments }),
    category ? Promise.resolve([]) : listTransfers({ query, month, account, allTime }),
  ]);
```
to:
```ts
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
    category ? Promise.resolve([]) : listTransfers({ query, month, account, allTime }),
  ]);
```
(`listTransfers` is NOT given a `year` param — out of scope, transfers aren't part of this feature, and the existing code already only passes `month`/not `year` to it; leave it exactly as-is.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/transactions.ts src/app/actions/history.ts
git commit -m "Add year filter to listTransactions/listHistoryItems"
```

---

### Task 3: `PeriodNavigator` component

**Files:**
- Create: `src/components/PeriodNavigator.tsx`

**Interfaces:**
- Produces: `<PeriodNavigator label={string} onPrev={() => void} onNext={() => void} nextDisabled?={boolean} onLabelClick={() => void} />` — consumed by Task 6 (Overview) and Task 7 (History).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PeriodNavigatorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  onLabelClick: () => void;
}

export function PeriodNavigator({ label, onPrev, onNext, nextDisabled, onLabelClick }: PeriodNavigatorProps) {
  return (
    <div className="flex items-center gap-1 -ml-2.5">
      <button
        type="button"
        onClick={onPrev}
        className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink transition-colors"
        aria-label="Previous period"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onLabelClick}
        className="text-sm font-bold uppercase tracking-widest text-ink px-1"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink transition-colors disabled:opacity-25"
        aria-label="Next period"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
```

`-ml-2.5` compensates for the enlarged left button's own padding so the row's visual left edge still aligns with surrounding page content — the same compensation trick `MonthFilter.tsx` already used (`-ml-2`/`-mr-2`), just tuned for the larger tap target.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PeriodNavigator.tsx
git commit -m "Add shared PeriodNavigator component with proper touch targets"
```

---

### Task 4: `MonthPicker` component

**Files:**
- Create: `src/components/MonthPicker.tsx`

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogTitle` from `src/components/ui/dialog.tsx` (existing); `cn` from `src/lib/utils.ts` (existing).
- Produces: `<MonthPicker open selectedYear selectedMonth onSelect onClose />` — consumed by Task 6 (Overview) and Task 7 (History).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface MonthPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number; // 1-12
  onSelect: (year: number, month: number) => void;
}

export function MonthPicker({ open, onClose, selectedYear, selectedMonth, onSelect }: MonthPickerProps) {
  const [gridYear, setGridYear] = useState(selectedYear);

  // Re-sync the grid's year to whatever is actually selected each time the
  // sheet opens, so reopening it doesn't show wherever it was left scrolled to.
  useEffect(() => {
    if (open) setGridYear(selectedYear);
  }, [open, selectedYear]);

  const now = new Date();
  const isCurrentYear = gridYear === now.getFullYear();

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="rounded-t-3xl rounded-b-none border-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] gap-4 bg-paper-card max-w-none w-full"
        style={{ position: 'fixed', top: 'auto', bottom: 0, left: 0, right: 0, transform: 'none' }}
      >
        <DialogTitle className="sr-only">Select month</DialogTitle>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setGridYear((y) => y - 1)}
            className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="text-base font-bold tabular-nums text-ink">{gridYear}</span>
          <button
            type="button"
            onClick={() => setGridYear((y) => y + 1)}
            disabled={isCurrentYear}
            className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink disabled:opacity-25"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, i) => {
            const monthNum = i + 1;
            const isFuture = gridYear === now.getFullYear() && monthNum > now.getMonth() + 1;
            const isSelected = gridYear === selectedYear && monthNum === selectedMonth;
            return (
              <button
                key={label}
                type="button"
                disabled={isFuture}
                onClick={() => onSelect(gridYear, monthNum)}
                className={cn(
                  'h-14 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-25',
                  isSelected ? 'bg-accent text-white' : 'bg-sand text-ink-soft active:bg-ink/10'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

The `style` prop on `DialogContent` (not just `className`) is deliberate: `DialogContent`'s own default className centers it (`top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]`), and inline styles always win over className regardless of how Tailwind's class-merging handles arbitrary-value conflicts — this guarantees the bottom-sheet positioning actually applies rather than depending on className override order.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Self-review**

Confirm: is every month button's `disabled` state driven ONLY by `isFuture` (never by whether that month has transactions)? Does reopening the picker after selecting a different month re-sync `gridYear` to the new selection (not stay on whatever year was last scrolled to)?

- [ ] **Step 4: Commit**

```bash
git add src/components/MonthPicker.tsx
git commit -m "Add shared MonthPicker bottom sheet"
```

---

### Task 5: `YearPicker` component

**Files:**
- Create: `src/components/YearPicker.tsx`

**Interfaces:**
- Consumes: same `Dialog`/`DialogContent`/`DialogTitle`/`cn` as Task 4.
- Produces: `<YearPicker open selectedYear availableYears onSelect onClose />` — consumed by Task 6 (Overview only; History has no year mode).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface YearPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  availableYears: number[]; // years with ≥1 transaction, ascending
  onSelect: (year: number) => void;
}

export function YearPicker({ open, onClose, selectedYear, availableYears, onSelect }: YearPickerProps) {
  const currentYear = new Date().getFullYear();
  // Always show at least 5 years (current back to current-4); extend further
  // back automatically if real data goes back further. Never gated on data
  // existing — this only informs the range, per the spec.
  const earliest = Math.min(availableYears[0] ?? currentYear, currentYear - 4);
  const years: number[] = [];
  for (let y = currentYear; y >= earliest; y--) years.push(y);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="rounded-t-3xl rounded-b-none border-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] gap-2 bg-paper-card max-w-none w-full max-h-[70vh] overflow-y-auto"
        style={{ position: 'fixed', top: 'auto', bottom: 0, left: 0, right: 0, transform: 'none' }}
      >
        <DialogTitle className="sr-only">Select year</DialogTitle>
        <div className="flex flex-col gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onSelect(y)}
              className={cn(
                'h-14 rounded-2xl text-base font-bold tabular-nums transition-colors',
                y === selectedYear ? 'bg-accent text-white' : 'bg-sand text-ink-soft active:bg-ink/10'
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Self-review**

Confirm: for `availableYears = []` (brand-new account), does the list still render exactly 5 years (`currentYear` down to `currentYear - 4`)? Is no year in the rendered list ever disabled?

- [ ] **Step 4: Commit**

```bash
git add src/components/YearPicker.tsx
git commit -m "Add shared YearPicker bottom sheet"
```

---

### Task 6: Overview page + client rewrite — URL-driven navigation

**Files:**
- Modify: `src/components/OverviewClient.tsx` (full rewrite)
- Modify: `src/app/overview/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getOverviewData`, `getAvailableYears`, `OverviewData`, `OverviewPeriod` (Task 1); `PeriodNavigator` (Task 3); `MonthPicker` (Task 4); `YearPicker` (Task 5); `TrendBars`/`TrendBarItem`, `CategoryBlocks`, `ResponsiveAmount` (all pre-existing, unchanged).
- Produces: the `/overview` route's new URL contract (`?period=month&month=YYYY-MM`, `?period=year&year=YYYY`, `?period=all`).

- [ ] **Step 1: Rewrite `src/app/overview/page.tsx`**

```tsx
import { getOverviewData, type OverviewPeriod } from '@/app/actions/overview';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

function parseAnchor(period: OverviewPeriod, month: string | undefined, year: string | undefined): Date {
  const now = new Date();
  if (period === 'month' && month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (match) {
      const candidate = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      if (candidate.getTime() <= now.getTime()) return candidate;
    }
  }
  if (period === 'year' && year) {
    const y = Number(year);
    if (Number.isInteger(y) && y <= now.getFullYear()) return new Date(y, 0, 1);
  }
  return now;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const period: OverviewPeriod = params.period === 'year' ? 'year' : params.period === 'all' ? 'all' : 'month';
  const anchor = parseAnchor(period, params.month, params.year);
  const data = await getOverviewData(period, anchor);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      <section className="pt-2 lg:pt-8">
        <OverviewClient data={data} period={period} />
      </section>

      <BottomNav />
    </div>
  );
}
```

`parseAnchor` is a defensive parser: a missing, malformed, or future-dated `month`/`year` param silently falls back to the current real period rather than crashing or showing a nonsensical future view — this is the "clamp" behavior the spec calls for.

- [ ] **Step 2: Rewrite `src/components/OverviewClient.tsx`**

```tsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { subMonths, addMonths } from 'date-fns';
import { animate, AnimatePresence, motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { CategoryBlocks } from '@/components/CategoryBlocks';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { getAvailableYears, type OverviewData, type OverviewPeriod } from '@/app/actions/overview';
import { formatCurrency } from '@/lib/utils';

interface OverviewClientProps {
  data: OverviewData;
  period: OverviewPeriod;
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

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m };
}

export function OverviewClient({ data, period }: OverviewClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { year: viewYear, month: viewMonth } =
    period === 'month' && data.monthKey
      ? parseMonthKey(data.monthKey)
      : { year: period === 'year' ? Number(data.label) : currentYear, month: currentMonth };

  function navigate(params: Record<string, string>) {
    startTransition(() => router.push(`/overview?${new URLSearchParams(params).toString()}`));
  }

  function goToMode(nextMode: OverviewPeriod) {
    if (nextMode === period) return;
    if (nextMode === 'year' && period === 'month') {
      navigate({ period: 'year', year: String(viewYear) });
    } else if (nextMode === 'all') {
      navigate({ period: 'all' });
    } else if (nextMode === 'month') {
      navigate({ period: 'month', month: `${currentYear}-${String(currentMonth).padStart(2, '0')}` });
    } else {
      navigate({ period: 'year', year: String(currentYear) });
    }
  }

  function prevPeriod() {
    if (period === 'month') {
      const d = subMonths(new Date(viewYear, viewMonth - 1, 1), 1);
      navigate({ period: 'month', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    } else if (period === 'year') {
      navigate({ period: 'year', year: String(viewYear - 1) });
    }
  }

  function nextPeriod() {
    if (period === 'month') {
      const d = addMonths(new Date(viewYear, viewMonth - 1, 1), 1);
      navigate({ period: 'month', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    } else if (period === 'year') {
      navigate({ period: 'year', year: String(viewYear + 1) });
    }
  }

  const isCurrentPeriod =
    period === 'month' ? viewYear === currentYear && viewMonth === currentMonth
    : period === 'year' ? viewYear === currentYear
    : true;

  async function openYearPicker() {
    const years = await getAvailableYears();
    setAvailableYears(years);
    setYearPickerOpen(true);
  }

  const trendItems: TrendBarItem[] =
    period === 'month'
      ? (data.dailyTrend ?? []).map((d) => ({ key: String(d.day).padStart(2, '0'), value: d.spend }))
      : period === 'year'
        ? (data.monthlyTrend ?? []).map((m) => ({
            key: MONTH_NAMES[m.month - 1],
            value: m.spend,
            href: `/overview?period=month&month=${viewYear}-${String(m.month).padStart(2, '0')}`,
          }))
        : (data.yearlyTrend ?? []).map((y) => ({ key: String(y.year), value: y.spend }));

  const labelEvery = period === 'month' ? 5 : 1;

  const viewAllHref =
    period === 'month' ? `/history?month=${data.monthKey}`
    : period === 'all' ? '/history?allTime=true'
    : `/history?year=${viewYear}`;

  const navigatorLabel =
    period === 'month'
      ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(viewYear, viewMonth - 1, 1)).toUpperCase()
      : String(viewYear);

  const contentKey = period === 'month' ? `month-${data.monthKey}` : period === 'year' ? `year-${data.label}` : 'all';

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-4">Overview</p>

      <div className="flex gap-2 mb-6">
        {(['month', 'year', 'all'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => goToMode(m)}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${
              period === m ? 'bg-ink text-paper' : 'bg-sand text-ink-soft'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {period !== 'all' && (
        <div className="mb-4">
          <PeriodNavigator
            label={navigatorLabel}
            onPrev={prevPeriod}
            onNext={nextPeriod}
            nextDisabled={isCurrentPeriod}
            onLabelClick={() => (period === 'month' ? setMonthPickerOpen(true) : openYearPicker())}
          />
        </div>
      )}

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

      <AnimatePresence mode="wait">
        <motion.div
          key={contentKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
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

      {period === 'month' && (
        <MonthPicker
          open={monthPickerOpen}
          onClose={() => setMonthPickerOpen(false)}
          selectedYear={viewYear}
          selectedMonth={viewMonth}
          onSelect={(y, m) => {
            setMonthPickerOpen(false);
            navigate({ period: 'month', month: `${y}-${String(m).padStart(2, '0')}` });
          }}
        />
      )}
      {period === 'year' && (
        <YearPicker
          open={yearPickerOpen}
          onClose={() => setYearPickerOpen(false)}
          selectedYear={viewYear}
          availableYears={availableYears}
          onSelect={(y) => {
            setYearPickerOpen(false);
            navigate({ period: 'year', year: String(y) });
          }}
        />
      )}
    </div>
  );
}
```

Key differences from the version this replaces: `mode` local state is gone entirely — `period` is now a prop derived from the URL by the Server Component; there is only ever one `data` object (not three); every navigation goes through `navigate()` → `router.push` inside `startTransition`, not `setState`; the `AnimatePresence` key is derived from `period`+the anchor actually shown (`contentKey`), not from `mode` alone, so navigating between two different months (both `period === 'month'`) still re-triggers the crossfade/re-animation, not just switching between the three top-level modes.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Self-review**

Confirm: does `goToMode('year')` from month mode use `viewYear` (the currently-viewed month's year), not `currentYear`? Does every other mode transition use `currentYear`/`currentMonth`? Does `prevPeriod`/`nextPeriod` do nothing when `period === 'all'` (no anchor concept there — confirm the `PeriodNavigator` isn't even rendered in that case, per the `period !== 'all'` guard)? Is `getAvailableYears()` only called when the YearPicker is actually opened (not on every render/mode)?

- [ ] **Step 5: Commit**

```bash
git add src/components/OverviewClient.tsx src/app/overview/page.tsx
git commit -m "Rewrite Overview as URL-driven single-fetch with period navigation"
```

---

### Task 7: History page — replace `MonthFilter` with shared components

**Files:**
- Create: `src/components/HistoryPeriodNav.tsx`
- Modify: `src/app/history/page.tsx`
- Delete: `src/components/MonthFilter.tsx`

**Interfaces:**
- Consumes: `PeriodNavigator` (Task 3), `MonthPicker` (Task 4).
- Produces: History's `?month=` URL behavior, unchanged externally; adds reading `?year=` for the new filter from Task 2.

- [ ] **Step 1: Create `HistoryPeriodNav`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { subMonths, addMonths, startOfMonth, format } from 'date-fns';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import { MonthPicker } from '@/components/MonthPicker';

export function HistoryPeriodNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const now = new Date();
  const param = searchParams.get('month');
  const currentDate = param
    ? (() => { const [y, m] = param.split('-').map(Number); return new Date(y, m - 1, 1); })()
    : startOfMonth(now);
  const isCurrentMonth = format(currentDate, 'yyyy-MM') === format(now, 'yyyy-MM');

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', format(date, 'yyyy-MM'));
    params.delete('year'); // month is more specific than year; picking a month always clears any year filter
    startTransition(() => router.push(`?${params.toString()}`));
  }

  return (
    <>
      <PeriodNavigator
        label={format(currentDate, 'MMMM yyyy').toUpperCase()}
        onPrev={() => navigate(subMonths(currentDate, 1))}
        onNext={() => navigate(addMonths(currentDate, 1))}
        nextDisabled={isCurrentMonth}
        onLabelClick={() => setPickerOpen(true)}
      />
      <MonthPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedYear={currentDate.getFullYear()}
        selectedMonth={currentDate.getMonth() + 1}
        onSelect={(y, m) => {
          setPickerOpen(false);
          navigate(new Date(y, m - 1, 1));
        }}
      />
    </>
  );
}
```

This mirrors `MonthFilter.tsx`'s exact date logic (same variable names, same URL-param reading) — only the rendering changed, so History's month-stepping behavior is unchanged except for the touch-target fix and the new tap-to-pick affordance.

- [ ] **Step 2: Update `src/app/history/page.tsx`**

Change the import:
```ts
import { MonthFilter } from '@/components/MonthFilter';
```
to:
```ts
import { HistoryPeriodNav } from '@/components/HistoryPeriodNav';
```

Change the searchParams type and the `listHistoryItems` call:
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
to:
```ts
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; year?: string; category?: string; account?: string; allTime?: string }>;
}) {
  const params = await searchParams;
  const [data, categories, accountNames] = await Promise.all([
    listHistoryItems({
      query:      params.q,
      month:      params.month,
      year:       params.year ? Number(params.year) : undefined,
      category:   params.category,
      account:    params.account,
      allTime:    params.allTime === 'true',
    }),
```

Change the JSX:
```tsx
          <MonthFilter />
```
to:
```tsx
          <HistoryPeriodNav />
```

- [ ] **Step 3: Delete `MonthFilter.tsx`**

```bash
rm src/components/MonthFilter.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — confirms nothing else imports the deleted file.

- [ ] **Step 5: Grep for stragglers**

Run: `grep -rn "MonthFilter" src/`
Expected: no results.

- [ ] **Step 6: Commit**

```bash
git add src/components/HistoryPeriodNav.tsx src/app/history/page.tsx
git add -u src/components/MonthFilter.tsx
git commit -m "Replace History's MonthFilter with shared PeriodNavigator + MonthPicker"
```

---

### Task 8: Visual verification with mock data

**Files:**
- Temporary only (not committed): a throwaway preview route and a temporary `proxy.ts` exclusion, both reverted at the end.

**Interfaces:**
- Consumes: `OverviewClient` and `HistoryPeriodNav` directly, fed hand-built mock data — this feature is entirely read-only, so (per the precedent already established for the previous Overview plan's Task 9) live browser verification is possible without login.

- [ ] **Step 1: Set up the temporary preview**

Add a route exclusion to `src/proxy.ts`'s matcher (same pattern as before — add `|devpreview-periodnav`), and create `src/app/devpreview-periodnav/page.tsx` rendering `<OverviewClient data={...} period="month" />` with a "switch period" control of your own (query params work fine, this is a throwaway page) so you can exercise month/year/all with realistic mock `OverviewData` objects — reuse the mock-data shapes from the previous plan's Task 9 report as a starting point if useful, extended to include at least one entry a few months in the past, since this task specifically needs to verify PAST period rendering, not just "current."

- [ ] **Step 2: Run the dev server and check every requirement**

Work through:
- **Touch targets (Safeguard 1):** measure the arrow buttons' actual clickable bounding box (via `getBoundingClientRect` on the `<button>`, not just the icon) — confirm ≥44×44px, while the icon itself renders visually small.
- **Pickers never disable for lack of data (Safeguard 2):** open MonthPicker on a mock month, navigate the year-header back several years, confirm every month is tappable (not disabled) except future months in the current real year. Open YearPicker with an empty `availableYears: []` mock — confirm it still lists 5 years, none disabled.
- **No flicker (Safeguard 3):** click prev/next repeatedly — confirm the "OVERVIEW" title, the MONTH/YEAR/ALL tabs, and the `PeriodNavigator` row never disappear/remount between clicks (check DOM node identity, not just visual appearance) — only the trend/category section below should re-animate.
- **Cross-navigation hrefs (Safeguard 4):** in Year mode, confirm a bar's link target is `/overview?period=month&month=YYYY-MM` (not `/history`). Confirm month mode's "View all" href is `/history?month=...`, year mode's is `/history?year=...`, all mode's is `/history?allTime=true`.
- **Elapsed-time correctness:** with a mock month a few months in the past, confirm the daily trend shows the FULL number of days in that month, not just 1-2 days.
- **History:** verify `HistoryPeriodNav`'s arrows have the same fixed touch target, and that clicking the month label opens the shared `MonthPicker`.

Fix anything in `PeriodNavigator.tsx`, `MonthPicker.tsx`, `YearPicker.tsx`, `OverviewClient.tsx`, or `HistoryPeriodNav.tsx` that doesn't match — this task is the design/functional QA gate for the whole feature, not a smoke test. Note any fix clearly in your report.

- [ ] **Step 3: Revert the temporary preview**

```bash
rm -rf src/app/devpreview-periodnav
git diff src/proxy.ts  # confirm only the devpreview-periodnav exclusion is present, revert it
```

- [ ] **Step 4: Final typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Report**

No commit for the preview/revert cycle itself. If you fixed anything in a real component file during Step 2, commit that as its own real commit and say so in your report. Confirm `git status` shows no trace of `devpreview-periodnav` or a modified `proxy.ts`.
