# Desktop Overview + Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/overview` as a two-column desktop surface — categories as sized circles on the left, a right panel that shows a trailing 12-month trend by default and a category drill-down when one is selected — and establish the shared desktop conventions the other two surfaces will reuse.

**Architecture:** All desktop treatment lives behind the existing `≥1024px` `d-*` utility layer in `globals.css`; mobile markup is untouched. Two new pure aggregation functions join `spendingAggregate.ts` and are unit-tested before any UI exists. Two new server actions wrap them. `CategoryBlocks` and `TrendBars` gain variant inputs rather than being forked, so mobile call sites keep today's values. Selection lives in the URL.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind v4, drizzle-orm + postgres-js, motion, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-03-desktop-review-surfaces-design.md`

## Global Constraints

- Desktop breakpoint is `min-width: 1024px`, implemented as `d-*` utilities in `globals.css` **outside** `@layer` so they beat Tailwind utilities. Do not scatter `lg:` prefixes.
- **Mobile output must not change.** Every change is additive at the desktop breakpoint.
- **No new dependency.** See Task 8 for the one place this bites.
- Radius scale: 16 / 24 / pill. Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Colours are tokens only: `--ink`, `--ink-soft`, `--ink-faint`, `--paper`, `--sand`, `--line`, `--accent`. One accent colour; it marks the largest member of a set and nothing else.
- No cards, no shadows, no gradients. Structure comes from hairline rules and whitespace.
- Circles in a selectable set are at least 38px and their names render **outside** the circle.
- Filter sets wrap. Never `overflow-x-auto`.
- A calendar date is a `"YYYY-MM-DD"` string. Never construct a `Date` from one. Use `src/lib/dates.ts`.
- Run tests with `npx tsx --test src/lib/*.test.ts`. Typecheck with `npx tsc --noEmit`.

## Scope note

The spec covers three independent surfaces and sequences them. This plan is **surface one only**: the shared foundation plus `/overview`. `/history` and `/accounts` get their own plans, written after this one lands — they reuse the primitives from Tasks 5–8, and those primitives should be shaped by real use before a second plan commits to their API.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/spendingAggregate.ts` (modify) | Pure aggregation. Gains trailing-month bucketing and category share. |
| `src/lib/spendingAggregate.test.ts` (modify) | Tests for the above. |
| `src/app/actions/overview.ts` (modify) | Server actions: trailing trend, category detail. |
| `src/app/globals.css` (modify) | Desktop two-column utilities. |
| `src/components/CategoryBlocks.tsx` (modify) | Selectable, variable-scale circles with outside labels. |
| `src/components/TrendBars.tsx` (modify) | Height variant. |
| `src/components/MonthPicker.tsx`, `YearPicker.tsx` (modify) | Centred on desktop, bottom sheet on mobile. |
| `src/components/TrendPanel.tsx` (create) | Right column, default state. |
| `src/components/CategoryDetailPanel.tsx` (create) | Right column, selected state. |
| `src/components/OverviewClient.tsx` (modify) | Two-column layout, selection state. |
| `src/app/overview/page.tsx` (modify) | Reads `?category=`, fetches panel data. |

---

### Task 1: Trailing-month bucketing

Produces the data behind the default right panel: the last N calendar months ending at a given month, including months with no transactions.

**Files:**
- Modify: `src/lib/spendingAggregate.ts`
- Test: `src/lib/spendingAggregate.test.ts`

**Interfaces:**
- Consumes: `aggregateTransactions(txns: AggregateInput[]): AggregateResult` (existing).
- Produces: `trailingMonths(rows: DatedInput[], endYear: number, endMonth: number, count: number): MonthBucket[]` where `DatedInput = AggregateInput & { date: string }` and `MonthBucket = { year: number; month: number; key: string; spend: number }`. `key` is `"YYYY-MM"`. Oldest first.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/spendingAggregate.test.ts`:

```ts
import { trailingMonths } from './spendingAggregate.ts';

const row = (date: string, amount: number) =>
  ({ date, amount, type: 'expense', category: 'Food' });

test('trailingMonths returns exactly count buckets, oldest first', () => {
  const out = trailingMonths([], 2026, 9, 12);
  assert.equal(out.length, 12);
  assert.equal(out[0].key, '2025-10');
  assert.equal(out[11].key, '2026-09');
});

test('trailingMonths crosses a year boundary without skipping a month', () => {
  const out = trailingMonths([], 2026, 2, 4).map((b) => b.key);
  assert.deepEqual(out, ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('trailingMonths sums spend into the right bucket', () => {
  const out = trailingMonths([row('2026-09-27', 100), row('2026-09-02', 50), row('2026-08-15', 20)], 2026, 9, 3);
  assert.deepEqual(out.map((b) => [b.key, b.spend]), [['2026-07', 0], ['2026-08', 20], ['2026-09', 150]]);
});

test('trailingMonths ignores rows outside the window', () => {
  const out = trailingMonths([row('2024-01-05', 999), row('2026-09-01', 10)], 2026, 9, 2);
  assert.equal(out.reduce((s, b) => s + b.spend, 0), 10);
});

test('trailingMonths applies the same type rules as aggregateTransactions', () => {
  const rows = [
    { date: '2026-09-01', amount: 100, type: 'expense', category: 'Food' },
    { date: '2026-09-02', amount: 30, type: 'refund', category: 'Food' },
    { date: '2026-09-03', amount: 500, type: 'income', category: 'Salary' },
    { date: '2026-09-04', amount: 7, type: 'balance_adjustment', category: 'Other' },
  ];
  assert.equal(trailingMonths(rows, 2026, 9, 1)[0].spend, 70);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/spendingAggregate.test.ts`
Expected: FAIL — `trailingMonths` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/spendingAggregate.ts`:

```ts
export interface DatedInput extends AggregateInput {
  /** Calendar date, "YYYY-MM-DD". */
  date: string;
}

export interface MonthBucket {
  year: number;
  month: number;
  /** "YYYY-MM" */
  key: string;
  spend: number;
}

/**
 * The `count` calendar months ending at (endYear, endMonth), oldest first.
 * Months with no transactions are present with spend 0 — a trend with gaps
 * punched out of it reads as a different shape than the real one.
 */
export function trailingMonths(
  rows: DatedInput[],
  endYear: number,
  endMonth: number,
  count: number,
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const index = new Map<string, DatedInput[]>();

  for (let i = count - 1; i >= 0; i--) {
    const offset = endMonth - 1 - i;
    const year = endYear + Math.floor(offset / 12);
    const month = ((offset % 12) + 12) % 12 + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    buckets.push({ year, month, key, spend: 0 });
    index.set(key, []);
  }

  for (const r of rows) {
    const bucket = index.get(r.date.slice(0, 7));
    if (bucket) bucket.push(r);
  }

  for (const b of buckets) {
    b.spend = aggregateTransactions(index.get(b.key)!).spend;
  }

  return buckets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/spendingAggregate.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spendingAggregate.ts src/lib/spendingAggregate.test.ts
git commit -m "Add trailing-month bucketing for the overview trend panel"
```

---

### Task 2: Category share and day bucketing

The numbers behind the selected-category panel: that category's total, its share of the period's spend, and a per-day series.

**Files:**
- Modify: `src/lib/spendingAggregate.ts`
- Test: `src/lib/spendingAggregate.test.ts`

**Interfaces:**
- Consumes: `DatedInput`, `aggregateTransactions` from Task 1.
- Produces: `categoryBreakdown(rows: DatedInput[], category: string, daysInPeriod: number, firstDay: string): CategoryBreakdown` where `CategoryBreakdown = { total: number; share: number; count: number; daily: { day: number; spend: number }[] }`. `share` is 0–1. `firstDay` is the period's first calendar date, `"YYYY-MM-DD"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/spendingAggregate.test.ts`:

```ts
import { categoryBreakdown } from './spendingAggregate.ts';

const d = (date: string, amount: number, category: string, type = 'expense') =>
  ({ date, amount, category, type });

test('categoryBreakdown totals only the named category', () => {
  const rows = [d('2026-09-01', 100, 'Food'), d('2026-09-02', 40, 'Transit'), d('2026-09-03', 60, 'Food')];
  const out = categoryBreakdown(rows, 'Food', 30, '2026-09-01');
  assert.equal(out.total, 160);
  assert.equal(out.count, 2);
});

test('categoryBreakdown share is the fraction of total period spend', () => {
  const rows = [d('2026-09-01', 75, 'Food'), d('2026-09-02', 25, 'Transit')];
  assert.equal(categoryBreakdown(rows, 'Food', 30, '2026-09-01').share, 0.75);
});

test('categoryBreakdown share is 0 when the period has no spend', () => {
  assert.equal(categoryBreakdown([], 'Food', 30, '2026-09-01').share, 0);
});

test('categoryBreakdown returns one entry per day of the period', () => {
  const out = categoryBreakdown([d('2026-09-05', 10, 'Food')], 'Food', 30, '2026-09-01');
  assert.equal(out.daily.length, 30);
  assert.equal(out.daily[0].day, 1);
  assert.equal(out.daily[4].spend, 10);
  assert.equal(out.daily[29].spend, 0);
});

test('categoryBreakdown applies refunds to the category it names', () => {
  const rows = [d('2026-09-01', 100, 'Food'), d('2026-09-02', 30, 'Food', 'refund')];
  assert.equal(categoryBreakdown(rows, 'Food', 30, '2026-09-01').total, 70);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/spendingAggregate.test.ts`
Expected: FAIL — `categoryBreakdown` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/spendingAggregate.ts`:

```ts
export interface CategoryBreakdown {
  total: number;
  /** Fraction of the period's total spend, 0–1. */
  share: number;
  /** Number of transactions counted, so an empty drill-down can say so. */
  count: number;
  daily: { day: number; spend: number }[];
}

export function categoryBreakdown(
  rows: DatedInput[],
  category: string,
  daysInPeriod: number,
  firstDay: string,
): CategoryBreakdown {
  const mine = rows.filter((r) => r.category === category);
  const total = aggregateTransactions(mine).spend;
  const periodSpend = aggregateTransactions(rows).spend;
  const offset = Number(firstDay.slice(8, 10));

  const byDay = new Map<number, DatedInput[]>();
  for (const r of mine) {
    const day = Number(r.date.slice(8, 10)) - offset + 1;
    if (day < 1 || day > daysInPeriod) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r);
  }

  return {
    total,
    share: periodSpend > 0 ? total / periodSpend : 0,
    count: mine.length,
    daily: Array.from({ length: daysInPeriod }, (_, i) => ({
      day: i + 1,
      spend: aggregateTransactions(byDay.get(i + 1) ?? []).spend,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/spendingAggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spendingAggregate.ts src/lib/spendingAggregate.test.ts
git commit -m "Add category breakdown aggregation for the overview drill-down"
```

---

### Task 3: `getTrailingTrend` server action

**Files:**
- Modify: `src/app/actions/overview.ts`

**Interfaces:**
- Consumes: `trailingMonths` (Task 1); `nowPartsIn`, `safeTimeZone`, `monthRange` from `src/lib/dates.ts`; the file's existing `getUser()`.
- Produces: `getTrailingTrend(months?: number): Promise<{ buckets: MonthBucket[]; average: number; peak: number }>`. Default 12.

- [ ] **Step 1: Write the implementation**

Append to `src/app/actions/overview.ts`:

```ts
import { trailingMonths, type MonthBucket } from '@/lib/spendingAggregate';

/**
 * The trailing-N-month trend behind the overview's default right panel. The
 * window ends at the user's current month, not the server's.
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/overview.ts
git commit -m "Add getTrailingTrend action for the overview default panel"
```

---

### Task 4: `getCategoryDetail` server action

**Files:**
- Modify: `src/app/actions/overview.ts`

**Interfaces:**
- Consumes: `categoryBreakdown` (Task 2); `monthRange`, `yearRange`, `daysInMonth`, `nowPartsIn`, `safeTimeZone` from `src/lib/dates.ts`; `LIST_COLUMNS`-shaped rows.
- Produces:

```ts
getCategoryDetail(
  category: string,
  period: OverviewPeriod,
  anchorParams?: { month?: string; year?: string },
): Promise<{
  category: string;
  total: number;
  share: number;
  count: number;
  daily: { day: number; spend: number }[];
  transactions: { id: string; merchant: string; date: string; amount: number; paymentMethod: string | null }[];
}>
```

- [ ] **Step 1: Write the implementation**

Append to `src/app/actions/overview.ts`:

```ts
import { categoryBreakdown } from '@/lib/spendingAggregate';
import { daysInMonth } from '@/lib/dates';
import { desc } from 'drizzle-orm';

const DETAIL_TRANSACTION_LIMIT = 50;

export async function getCategoryDetail(
  category: string,
  period: OverviewPeriod,
  anchorParams: { month?: string; year?: string } = {},
) {
  const user = await getUser();
  const tz = safeTimeZone(user.user_metadata?.timezone as string | undefined);
  const now = nowPartsIn(tz);

  let start: string;
  let end: string;
  let days: number;

  if (period === 'year') {
    const y = Number(anchorParams.year);
    const year = Number.isInteger(y) && y <= now.year ? y : now.year;
    [start, end] = yearRange(year);
    days = 12; // year mode buckets by month, not day
  } else if (period === 'all') {
    start = '0001-01-01';
    end = '9999-12-31';
    days = 12;
  } else {
    const match = /^(\d{4})-(\d{2})$/.exec(anchorParams.month ?? '');
    const year = match ? Number(match[1]) : now.year;
    const month = match ? Number(match[2]) : now.month;
    [start, end] = monthRange(year, month);
    days = daysInMonth(year, month);
  }

  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      gte(transactions.date, start),
      lte(transactions.date, end),
    ),
    columns: {
      id: true, type: true, amount: true, category: true,
      date: true, merchant: true, paymentMethod: true,
    },
    orderBy: [desc(transactions.date)],
  });

  const breakdown = categoryBreakdown(
    rows.map((r) => ({ type: r.type, amount: Number(r.amount) || 0, category: r.category, date: r.date })),
    category,
    days,
    start,
  );

  return {
    category,
    total: breakdown.total,
    share: breakdown.share,
    count: breakdown.count,
    daily: breakdown.daily,
    transactions: rows
      .filter((r) => r.category === category && r.type !== BALANCE_ADJUSTMENT_TYPE)
      .slice(0, DETAIL_TRANSACTION_LIMIT)
      .map((r) => ({
        id: r.id,
        merchant: r.merchant,
        date: r.date,
        amount: Number(r.amount) || 0,
        paymentMethod: r.paymentMethod,
      })),
  };
}
```

Add `import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';` if the file does not already import it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/overview.ts
git commit -m "Add getCategoryDetail action for the overview drill-down"
```

---

### Task 5: Desktop two-column utilities

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS classes `d-split`, `d-split-main`, `d-split-panel`, `d-panel-rule`, `d-desktop-only`. The wrapping-filter and hover-delete utilities the spec also calls for belong to the `/history` plan — nothing in this plan uses them, and a utility with no caller is a guess about its own shape.

- [ ] **Step 1: Add the utilities**

First, beside the existing `.d-sidebar { display: none; }` line **outside** the media query:

```css
.d-desktop-only { display: none; }
```

Then inside the existing `@media (min-width: 1024px)` block, after the `.d-pt` rule:

```css
  /* Overview/Accounts master–detail: a wider main column than d-row gives,
     with the panel taking the remaining width rather than a fixed 20rem. */
  .d-split       { display: flex; align-items: flex-start; gap: 2.5rem; }
  .d-split-main  { width: 44%; flex-shrink: 0; }
  .d-split-panel { flex: 1; min-width: 0; }
  .d-panel-rule  { border-left: 1px solid var(--line); padding-left: 2rem; }

  /* The panel is desktop-only, mirroring how .d-mobile-only hides the phone
     chrome above this breakpoint. */
  .d-desktop-only { display: block; }
```

- [ ] **Step 2: Verify mobile is unaffected**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, 14 routes compile. The rules live inside the `min-width: 1024px` media query, so no mobile selector changes.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "Add desktop split-layout and wrapping-set utilities"
```

---

### Task 6: `CategoryBlocks` — selectable circles with outside labels

**Files:**
- Modify: `src/components/CategoryBlocks.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CategoryBlocksProps` gains `maxSize?: number` (default 132), `minSize?: number` (default 64), `selected?: string | null`, `onSelect?: (name: string | null) => void`, `labelOutside?: boolean` (default false). Existing call sites pass none of these and must render identically.

- [ ] **Step 1: Replace the component body**

```tsx
'use client';

import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';

interface CategoryBlocksProps {
  data: { name: string; value: number }[];
  /** Desktop passes a larger ceiling; the phone keeps 132. */
  maxSize?: number;
  minSize?: number;
  /** When provided the circles become controls. */
  selected?: string | null;
  onSelect?: (name: string | null) => void;
  /** Labels outside the circle so long category names are not cramped. */
  labelOutside?: boolean;
}

const MAX_SHOWN = 5;
const ORGANIC_RADIUS = '48% 52% 50% 50% / 52% 48% 52% 48%';

export function CategoryBlocks({
  data,
  maxSize = 132,
  minSize = 64,
  selected = null,
  onSelect,
  labelOutside = false,
}: CategoryBlocksProps) {
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
        const size = max > 0 ? minSize + (entry.value / max) * (maxSize - minSize) : minSize;
        // Without a selection the first circle leads, as it always has. With
        // one, the accent follows the selection instead.
        const isAccent = selected === null ? i === 0 : selected === entry.name;
        const isSelected = selected === entry.name;

        const circle = (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
            className="flex flex-col items-center justify-center text-center shrink-0 px-2"
            style={{
              width: size,
              height: size,
              borderRadius: isAccent ? ORGANIC_RADIUS : '9999px',
              background: isAccent ? 'var(--accent)' : 'var(--sand)',
            }}
          >
            {!labelOutside && (
              <span className={`text-[8px] font-bold uppercase tracking-widest truncate max-w-full ${isAccent ? 'text-white/80' : 'text-ink-faint'}`}>
                {entry.name}
              </span>
            )}
            <span className={`text-sm font-bold tabular-nums ${isAccent ? 'text-white' : 'text-ink'}`}>
              {formatCurrency(entry.value)}
            </span>
          </motion.div>
        );

        const label = labelOutside ? (
          <span className={`text-[8px] font-bold uppercase tracking-widest text-center max-w-[7rem] ${isSelected ? 'text-accent' : 'text-ink-soft'}`}>
            {entry.name}
          </span>
        ) : null;

        if (!onSelect) {
          return (
            <div key={entry.name} className="flex flex-col items-center gap-1.5">
              {circle}
              {label}
            </div>
          );
        }

        return (
          <button
            key={entry.name}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : entry.name)}
            className="flex flex-col items-center gap-1.5 cursor-pointer"
          >
            {circle}
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify existing call sites are unchanged**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0. `OverviewClient` passes only `data`, so it keeps 64–132px circles, labels inside, no selection, accent on the first — identical to before.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryBlocks.tsx
git commit -m "Make CategoryBlocks selectable and scalable without changing phone output"
```

---

### Task 7: `TrendBars` — height variant

**Files:**
- Modify: `src/components/TrendBars.tsx`

**Interfaces:**
- Produces: `TrendBarsProps` gains `height?: number` (default 128). Existing call sites pass none and keep 128.

- [ ] **Step 1: Make the constant a prop**

In `src/components/TrendBars.tsx`, delete `const CHART_HEIGHT = 128;` and change the signature and body:

```tsx
interface TrendBarsProps {
  items: TrendBarItem[];
  labelEvery?: number;
  /** Desktop panels use a taller chart; the phone keeps 128. */
  height?: number;
}

export function TrendBars({ items, labelEvery = 1, height = 128 }: TrendBarsProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  const max = Math.max(1, ...items.map((i) => i.value));
  const maxIndex = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0);
  const hasSpend = items.some((i) => i.value > 0);
  const gapClass = items.length > 20 ? 'gap-0.5' : items.length > 6 ? 'gap-1.5' : 'gap-3';
```

Then replace every remaining `CHART_HEIGHT` in the file with `height` (there are three: the wrapper `style`, the `heightPx` calculation, and the `Tag` `style`).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendBars.tsx
git commit -m "Let TrendBars take a height instead of hard-coding 128"
```

---

### Task 8: Pickers stop being bottom sheets on desktop

`MonthPicker` and `YearPicker` hard-code `position: fixed; bottom: 0; left: 0; right: 0` with `rounded-t-3xl` and `env(safe-area-inset-bottom)` — a drawer rising from the bottom of a 27" monitor.

**Spec amendment, decided here:** the spec says these "anchor to their trigger". True anchoring needs `@radix-ui/react-popover` or roughly forty lines of manual rect measurement with viewport-edge handling, and the spec also says no new dependency. Those two cannot both hold. This task takes the cheap half: on desktop the picker becomes a **centred dialog** — Radix Dialog's own default, so it is a conditional on the inline style and nothing else. The user's eyes stop travelling to the bottom of the screen, which was the actual complaint. Anchoring stays available as an upgrade and is marked in the code.

**Files:**
- Modify: `src/components/MonthPicker.tsx`
- Modify: `src/components/YearPicker.tsx`

**Interfaces:**
- Props unchanged for both components.

- [ ] **Step 1: Make the sheet styling mobile-only in `MonthPicker`**

Replace the `<DialogContent …>` opening tag:

```tsx
      <DialogContent
        showCloseButton={false}
        className="
          border-0 p-6 gap-4 bg-paper-card
          max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
          max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
          max-lg:translate-x-0 max-lg:translate-y-0
          lg:rounded-3xl lg:max-w-sm
        "
      >
```

The inline `style` prop is removed entirely — it applied at every width, which is why the sheet survived on desktop. Radix's default centring now applies above `lg`.

- [ ] **Step 2: Make the same change in `YearPicker`**

In `src/components/YearPicker.tsx`, replace its `<DialogContent …>` opening tag with exactly this — the same shell, since both pickers are the same object at different granularity:

```tsx
      <DialogContent
        showCloseButton={false}
        className="
          border-0 p-6 gap-4 bg-paper-card
          max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
          max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
          max-lg:translate-x-0 max-lg:translate-y-0
          lg:rounded-3xl lg:max-w-sm
        "
      >
```

Its `style` prop goes too. Do not extract a shared shell component in this task — the two differ in body content, and merging them is a separate decision that should be made with both in front of you.

- [ ] **Step 3: Leave the upgrade path in the code**

Immediately above the `<DialogContent>` in `MonthPicker.tsx`:

```tsx
      {/* ponytail: centred dialog on desktop rather than anchored to the
          trigger — anchoring needs @radix-ui/react-popover or manual rect
          measurement. Upgrade if the jump to screen centre reads as abrupt. */}
```

- [ ] **Step 4: Verify both widths**

Run: `npx tsc --noEmit && npm run build`, then start the preview and check at 1440px and at 375px: centred box above `lg`, bottom sheet below it, in both pickers.

- [ ] **Step 5: Commit**

```bash
git add src/components/MonthPicker.tsx src/components/YearPicker.tsx
git commit -m "Centre the month and year pickers on desktop instead of rising from the bottom"
```

---

### Task 9: `TrendPanel` — the default right column

**Files:**
- Create: `src/components/TrendPanel.tsx`

**Interfaces:**
- Consumes: `getTrailingTrend`'s return shape (Task 3), `TrendBars` with `height` (Task 7).
- Produces: `TrendPanel({ buckets, average, peak }: { buckets: MonthBucket[]; average: number; peak: number })`.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { formatCurrency } from '@/lib/utils';
import type { MonthBucket } from '@/lib/spendingAggregate';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function TrendPanel({
  buckets,
  average,
  peak,
}: {
  buckets: MonthBucket[];
  average: number;
  peak: number;
}) {
  const items: TrendBarItem[] = buckets.map((b) => ({
    key: MONTH_INITIALS[b.month - 1],
    value: b.spend,
    href: `/overview?period=month&month=${b.key}`,
  }));

  return (
    <section>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mb-4">
        Past {buckets.length} months
      </p>

      <TrendBars items={items} height={176} />

      <div className="border-t border-line mt-6 pt-4 flex gap-10">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Monthly average</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(average)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Peak</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(peak)}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendPanel.tsx
git commit -m "Add TrendPanel, the overview right column's default state"
```

---

### Task 10: `CategoryDetailPanel` — the selected right column

**Files:**
- Create: `src/components/CategoryDetailPanel.tsx`

**Interfaces:**
- Consumes: `getCategoryDetail`'s return shape (Task 4), `TrendBars` with `height` (Task 7).
- Produces: `CategoryDetailPanel({ detail }: { detail: Awaited<ReturnType<typeof getCategoryDetail>> })`.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import Link from 'next/link';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { getCategoryDetail } from '@/app/actions/overview';

type Detail = Awaited<ReturnType<typeof getCategoryDetail>>;

export function CategoryDetailPanel({ detail }: { detail: Detail }) {
  const items: TrendBarItem[] = detail.daily.map((d) => ({ key: String(d.day), value: d.spend }));
  const labelEvery = detail.daily.length > 20 ? 7 : 1;

  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent truncate">
            {detail.category} · {detail.count} {detail.count === 1 ? 'entry' : 'entries'}
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-tight mt-1">
            {formatCurrency(detail.total)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Share of spend</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{Math.round(detail.share * 100)}%</p>
        </div>
      </div>

      <div className="mt-6">
        <TrendBars items={items} height={96} labelEvery={labelEvery} />
      </div>

      <div className="border-t border-ink mt-6">
        {detail.transactions.length === 0 ? (
          <p className="py-4 text-sm text-ink-faint">No entries in this period.</p>
        ) : (
          detail.transactions.map((t) => (
            <Link
              key={t.id}
              href={`/history/${t.id}`}
              className="flex items-baseline justify-between gap-4 py-3 border-b border-line last:border-0 hover:bg-sand/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{t.merchant}</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-ink-faint mt-0.5">
                  {formatDate(t.date, { day: 'numeric', month: 'short' })}
                  {t.paymentMethod ? ` · ${t.paymentMethod}` : ''}
                </span>
              </span>
              <span className="text-base font-bold tabular-nums shrink-0">
                −{formatCurrency(t.amount)}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryDetailPanel.tsx
git commit -m "Add CategoryDetailPanel, the overview right column's selected state"
```

---

### Task 11: Two-column `/overview` with URL-backed selection

**Files:**
- Modify: `src/app/overview/page.tsx`
- Modify: `src/components/OverviewClient.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 5, 6, 7, 9, 10.
- Produces: `/overview?category=<name>` selects a category. `OverviewClientProps` gains `trend` and `detail`.

- [ ] **Step 1: Fetch panel data in the page**

In `src/app/overview/page.tsx`, add to the imports:

```tsx
import { getTrailingTrend, getCategoryDetail } from '@/app/actions/overview';
```

Widen `searchParams` to include `category?: string`, then replace the data-fetching block:

```tsx
  const category = params.category?.trim() || null;

  const [data, { year: currentYear, month: currentMonth }, trend, detail] = await Promise.all([
    getOverviewData(period, { month: params.month, year: params.year }),
    getCurrentPeriod(),
    getTrailingTrend(12),
    category
      ? getCategoryDetail(category, period, { month: params.month, year: params.year })
      : Promise.resolve(null),
  ]);
```

Pass both through: `<OverviewClient … trend={trend} detail={detail} />`.

- [ ] **Step 2: Add the props and selection handler to `OverviewClient`**

Extend the props interface:

```tsx
import type { getTrailingTrend, getCategoryDetail } from '@/app/actions/overview';
import { TrendPanel } from '@/components/TrendPanel';
import { CategoryDetailPanel } from '@/components/CategoryDetailPanel';

interface OverviewClientProps {
  data: OverviewData;
  period: OverviewPeriod;
  currentYear: number;
  currentMonth: number;
  trend: Awaited<ReturnType<typeof getTrailingTrend>>;
  detail: Awaited<ReturnType<typeof getCategoryDetail>> | null;
}
```

Inside the component, next to the existing navigation helpers:

```tsx
  function selectCategory(name: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (name) params.set('category', name);
    else params.delete('category');
    router.push(`/overview?${params.toString()}`);
  }
```

Use the same `router` and `searchParams` the file already holds for `goToMode`. If `searchParams` is not already in scope, add `const searchParams = useSearchParams();` alongside the existing `useRouter()`.

Changing period must clear the selection — a category chosen in one month should not silently carry into another. In `goToMode`, `prevPeriod` and `nextPeriod`, delete `category` from the params before pushing:

```tsx
    params.delete('category');
```

- [ ] **Step 3: Wrap the body in the split layout**

The existing single column becomes `d-split-main`; the panel is new. Keep the mode chips and `PeriodNavigator` above the split so they govern both columns. Replace the `<AnimatePresence>` block's wrapper with:

```tsx
      <div className="d-split">
        <div className="d-split-main">
          {/* hero section and the income/net/average row stay exactly as they are */}

          <section className="pb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">
              Top Categories
            </h2>
            <CategoryBlocks
              data={data.categoryTotals}
              maxSize={168}
              selected={detail?.category ?? null}
              onSelect={selectCategory}
              labelOutside
            />
          </section>
        </div>

        <div className="d-split-panel d-panel-rule d-desktop-only">
          {detail ? <CategoryDetailPanel detail={detail} /> : <TrendPanel {...trend} />}
        </div>
      </div>
```

`d-desktop-only` comes from Task 5, so the panel does not render on a phone at all.

Everything inside `d-split-main` — the `{data.label} SPENDING` heading, `AnimatedAmount`, the income / net / daily-average row, and the existing `TrendBars` section — keeps its current markup unchanged. The phone therefore renders exactly what it renders today, stacked, and only the right-hand panel is new.

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, 14 routes.

- [ ] **Step 5: Commit**

```bash
git add src/app/overview/page.tsx src/components/OverviewClient.tsx
git commit -m "Rebuild /overview as a two-column desktop surface with category drill-down"
```

---

### Task 12: Verify across widths and confirm mobile is untouched

**Files:** none modified unless a defect is found.

- [ ] **Step 1: Start the preview**

Use `preview_start` with the `moooney-dev` configuration. Do not run the dev server through a shell.

- [ ] **Step 2: Check the three desktop widths**

At 1280, 1440 and 1920: the content stays centred at its max width, extra width becomes margin, and no horizontal page scroll appears. Confirm with `resize_window` plus a screenshot at each.

- [ ] **Step 3: Exercise the panel's two states**

Click a category: the panel shows its total, share percentage, day bars and entries, and the URL gains `?category=`. Click the same circle again: the selection clears and the trend returns. Navigate to the previous month: the selection clears.

- [ ] **Step 4: Confirm mobile output is unchanged**

`resize_window` to the `mobile` preset, reload, and compare `/overview` against `git stash`-ed current `main`. The hero, `TrendBars` and `CategoryBlocks` must be pixel-identical: 132px circle ceiling, labels inside, no panel.

- [ ] **Step 5: Check both colour schemes**

`resize_window` with `colorScheme: 'dark'` and again with `'light'`. The accent circle, the outlined shapes and the hairline rules must all hold up.

- [ ] **Step 6: Full verification**

```bash
npx tsc --noEmit && npx tsx --test src/lib/*.test.ts && npm run build && npx eslint src
```

Expected: tsc exit 0, all tests pass, 14 routes compile, and eslint reports no more than the 6 problems / 2 errors that exist on `main` today — `ThemeToggle.tsx` and `MonthPicker.tsx` both carry a pre-existing `react-hooks/set-state-in-effect` error. Do not add a seventh.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A src
git commit -m "Fix defects found verifying the desktop overview"
```
