# Desktop History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/history`'s filters in the app's geometric language — categories as circles sized by spend, accounts as bars — and give each row a proportion rule, so the page reads as the same design system as Overview and Accounts.

**Architecture:** The filter circles reuse `CategoryBlocks` and `circleSizes` rather than growing a second circle implementation. One new server action supplies the amounts the sizing needs. Rows gain one optional prop, as they did for the ledger. Everything stays behind the existing `≥1024px` `d-*` layer except the filter wrapping, which is a correctness fix and applies at every width.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind v4, drizzle-orm + postgres-js, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-03-desktop-review-surfaces-design.md`

## Global Constraints

- Desktop breakpoint is `min-width: 1024px`, as `d-*` utilities in `globals.css` **outside** `@layer`. Do not scatter `lg:` prefixes.
- **Filter sets wrap. Never `overflow-x-auto`.** This is the reported bug.
- Circles in a selectable set are at least 38px, names render **outside** the circle, and adjacent ranks differ by at least 8px — `circleSizes` already guarantees the last two.
- A number is never truncated. When a line is tight, the label gives way.
- Colours are tokens only: `--ink`, `--ink-soft`, `--ink-faint`, `--paper`, `--sand`, `--line`, `--accent`. One accent, marking the selection.
- No cards, no shadows, no gradients. Structure from hairline rules and whitespace.
- A calendar date is a `"YYYY-MM-DD"` string; use `src/lib/dates.ts` and never build a `Date` from one.
- Run tests with `npx tsx --test src/lib/*.test.ts`, typecheck with `npx tsc --noEmit`, lint baseline is 6 problems / 2 errors — do not add a seventh.
- Mobile output changes only where this plan says so (the filters), and that change is the bug fix.

## Design decisions this plan locks in

**Filter amounts come from the period alone** — not from the category, account or search filters. Sizing the circles from the fully filtered set would collapse them to a single circle the moment you pick one. The circles answer "which categories are large this month", which stays true while you explore.

**The proportion rule is scaled within the visible result set**, against the largest absolute amount on screen, and is omitted when the set has one row — a full-width rule implying a comparison that does not exist.

**Spec amendment — the reset is text, not a circle.** The spec asks for an
"All" circle. In a set where size is the data, a circle whose size means
nothing is the one shape in the group that lies. A text control reads as what
it is: not a category.

**The sidebar cannot hold an 8px ladder past about seven categories.** The
column is 15rem, so the circles run 44–96px — a 52px band, which fits six
steps of 8px. `circleSizes` shares the band out evenly beyond that rather than
failing, so twelve categories land ~4.7px apart. That is accepted here and
would not be on Overview: every filter circle carries its name underneath, so
size is a secondary cue, where on the Overview chart it is the only one. If
the tail ever needs to read precisely, raise `MAX_SIZE` before anything else.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/actions/history.ts` (modify) | `getFilterTotals` — per-category and per-account spend for a period. |
| `src/lib/proportions.ts` (create) | Pure: amounts → 0–1 rule widths. |
| `src/lib/proportions.test.ts` (create) | Tests for the above. |
| `src/components/CategoryFilter.tsx` (modify) | Circles via `CategoryBlocks`, plus an All reset. |
| `src/components/AccountFilter.tsx` (modify) | Horizontal bars, wrapping. |
| `src/components/HistoryList.tsx` (modify) | Computes proportions, passes them down. |
| `src/components/{SwipeableTransactionRow,SwipeableTransferRow,AdjustmentRow}.tsx` (modify) | One optional `proportion`. |
| `src/app/history/page.tsx` (modify) | Fetches totals, passes to the filters. |

---

### Task 1: `proportions` — rule widths

**Files:**
- Create: `src/lib/proportions.ts`
- Test: `src/lib/proportions.test.ts`

**Interfaces:**
- Produces: `proportions(amounts: number[]): (number | null)[]` — each 0–1 against the largest absolute value, `null` for every entry when there are fewer than two.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { proportions } from './proportions.ts';

test('each amount is its share of the largest', () => {
  assert.deepEqual(proportions([100, 50, 25]), [1, 0.5, 0.25]);
});

test('sign is ignored — the rule shows size, not direction', () => {
  assert.deepEqual(proportions([-100, 50]), [1, 0.5]);
});

test('a single row gets no rule, because there is nothing to compare it to', () => {
  assert.deepEqual(proportions([42]), [null]);
});

test('an empty set gives an empty set', () => {
  assert.deepEqual(proportions([]), []);
});

test('all-zero amounts give no rules rather than dividing by zero', () => {
  assert.deepEqual(proportions([0, 0]), [null, null]);
});

test('order is preserved so rules stay aligned with their rows', () => {
  assert.deepEqual(proportions([10, 100, 55]), [0.1, 1, 0.55]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/proportions.test.ts`
Expected: FAIL — `Cannot find module './proportions.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Rule widths for a list of amounts, each against the largest on screen.
 *
 * Scaled within the visible result set rather than globally: the rule answers
 * "how big is this next to the others here", which is the question a list of
 * one cannot pose — hence null rather than a full-width rule implying a
 * comparison that does not exist.
 */
export function proportions(amounts: number[]): (number | null)[] {
  if (amounts.length < 2) return amounts.map(() => null);
  const max = Math.max(...amounts.map((a) => Math.abs(a)));
  if (max <= 0) return amounts.map(() => null);
  return amounts.map((a) => Math.abs(a) / max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/proportions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proportions.ts src/lib/proportions.test.ts
git commit -m "Add proportion widths for history row rules"
```

---

### Task 2: `getFilterTotals` — the amounts behind the filter shapes

**Files:**
- Modify: `src/app/actions/history.ts`

**Interfaces:**
- Consumes: `monthRange`, `yearRange`, `nowPartsIn`, `safeTimeZone` from `src/lib/dates.ts`; `aggregateTransactions` from `src/lib/spendingAggregate.ts`; the file's own `getUser` pattern — `history.ts` currently has none, so copy the four-line helper the other action files use.
- Produces:

```ts
getFilterTotals(params: { month?: string; year?: number; allTime?: boolean }): Promise<{
  categories: { name: string; value: number }[];   // descending
  accounts: { name: string; value: number }[];     // descending
}>
```

- [ ] **Step 1: Write the implementation**

Append to `src/app/actions/history.ts`, adding the imports it needs:

```ts
import { and, eq, gte, lte } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { monthRange, yearRange, nowPartsIn, safeTimeZone } from '@/lib/dates';
import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';

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

  const byCategory = aggregateTransactions(
    spend.map((r) => ({ type: r.type, amount: Number(r.amount) || 0, category: r.category })),
  ).categoryTotals;

  // Same rules, keyed by account instead of category.
  const byAccount = aggregateTransactions(
    spend.map((r) => ({
      type: r.type,
      amount: Number(r.amount) || 0,
      category: r.paymentMethod ?? 'Unassigned',
    })),
  ).categoryTotals;

  return { categories: byCategory, accounts: byAccount };
}
```

`history.ts` currently imports only `Transfer`, `listTransactions` and
`listTransfers`, and has no `getUser` — every import above is new, including:

```ts
import { aggregateTransactions } from '@/lib/spendingAggregate';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify against the live database**

Write a scratch script under the scratchpad directory that calls the same query and prints category and account totals for one month, and check the category figures match what `/overview` shows for that month. Delete the script afterwards. Do not add it to the repo.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/history.ts
git commit -m "Add getFilterTotals for the history filter shapes"
```

---

### Task 3: `CategoryFilter` — circles, wrapping, with a reset

This is the reported bug: `flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6` inside a 15rem sidebar hides most categories behind a scrollbar that is itself hidden.

**Files:**
- Modify: `src/components/CategoryFilter.tsx`

**Interfaces:**
- Consumes: `CategoryBlocks` with `maxSize`, `minSize`, `selected`, `onSelect`, `labelOutside`.
- Produces: `CategoryFilter({ categories }: { categories: { name: string; value: number }[] })` — the prop changes from `string[]`.

- [ ] **Step 1: Replace the component**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CategoryBlocks } from '@/components/CategoryBlocks';

/** Smaller than Overview's: this is a sidebar control, not the page's subject. */
const MAX_SIZE = 96;
const MIN_SIZE = 44;

export function CategoryFilter({ categories }: { categories: { name: string; value: number }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('category');

  function select(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('category', value);
    else params.delete('category');
    router.push(`?${params.toString()}`);
  }

  if (categories.length === 0) {
    return <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">No spending this period</p>;
  }

  return (
    <div className="space-y-3">
      <CategoryBlocks
        data={categories}
        maxSize={MAX_SIZE}
        minSize={MIN_SIZE}
        selected={current}
        onSelect={select}
        labelOutside
      />
      {current && (
        <button
          type="button"
          onClick={() => select(null)}
          className="text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
        >
          Clear category
        </button>
      )}
    </div>
  );
}
```

The reset is a text control rather than an extra circle: a circle whose size means nothing sitting in a set where size is the data would be the one shape in the group that lies.

- [ ] **Step 2: Typecheck and check the caller**

Run: `npx tsc --noEmit`
Expected: one error at `src/app/history/page.tsx`, where `categories` is still `string[]`. Task 6 fixes it; leave it for now and move on only if that is the single remaining error.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryFilter.tsx
git commit -m "Rebuild the category filter as sized circles that wrap"
```

---

### Task 4: `AccountFilter` — bars, wrapping

**Files:**
- Modify: `src/components/AccountFilter.tsx`

**Interfaces:**
- Consumes: `circleSizes` is NOT used here — bars scale linearly on width, where length is read directly and needs no area correction.
- Produces: `AccountFilter({ accounts }: { accounts: { name: string; value: number }[] })` — the prop changes from `string[]`.

- [ ] **Step 1: Replace the component**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

export function AccountFilter({ accounts }: { accounts: { name: string; value: number }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('account');

  function select(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('account', value);
    else params.delete('account');
    router.push(`?${params.toString()}`);
  }

  if (accounts.length === 0) return null;

  // Bar length is read directly, so it scales linearly — the square-root
  // correction circles need would understate the differences here.
  const max = Math.max(...accounts.map((a) => a.value), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {accounts.map((a) => {
        const selected = current === a.name;
        return (
          <button
            key={a.name}
            type="button"
            aria-pressed={selected}
            onClick={() => select(selected ? null : a.name)}
            className="group flex items-center gap-2 text-left"
          >
            <span
              className="h-4 rounded-full shrink-0 transition-colors"
              style={{
                width: `${Math.max(8, (a.value / max) * 72)}px`,
                background: selected ? 'var(--accent)' : 'var(--ink)',
              }}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-widest truncate ${
                selected ? 'text-accent' : 'text-ink-soft group-hover:text-ink'
              }`}
            >
              {a.name}
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-ink-faint shrink-0 ml-auto">
              {formatCurrency(a.value)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

Accounts stack rather than wrap: their names are long and a row of bars would be unreadable at sidebar width.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only at `src/app/history/page.tsx`, fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountFilter.tsx
git commit -m "Rebuild the account filter as proportional bars"
```

---

### Task 5: Proportion rules on the rows

**Files:**
- Modify: `src/components/SwipeableTransactionRow.tsx`
- Modify: `src/components/SwipeableTransferRow.tsx`
- Modify: `src/components/AdjustmentRow.tsx`
- Modify: `src/components/HistoryList.tsx`

**Interfaces:**
- Consumes: `proportions` (Task 1).
- Produces: each row component takes `proportion?: number | null` alongside the existing optional `balanceAfter`.

- [ ] **Step 1: Add the prop to `SwipeableTransactionRow`**

Add to its props interface, beneath `balanceAfter`:

```tsx
  /** 0–1 against the largest amount on screen. A hairline under the merchant
   *  name, so magnitude reads without the amount type changing size. */
  proportion?: number | null;
```

Add it to the destructured parameters, then immediately after the meta `<span>` that closes the left-hand column, insert:

```tsx
          {proportion != null && (
            <span
              aria-hidden
              className="block h-[2px] rounded-full mt-1.5 transition-[width]"
              style={{
                width: `${Math.max(2, proportion * 100)}%`,
                background: proportion >= 1 ? 'var(--accent)' : 'var(--ink)',
              }}
            />
          )}
```

- [ ] **Step 2: Add the identical prop and markup to `SwipeableTransferRow`**

Add to its props interface, beneath `balanceAfter`:

```tsx
  /** 0–1 against the largest amount on screen. A hairline under the merchant
   *  name, so magnitude reads without the amount type changing size. */
  proportion?: number | null;
```

Add it to the destructured parameters, then after its meta `<span>`, insert exactly:

```tsx
            {proportion != null && (
              <span
                aria-hidden
                className="block h-[2px] rounded-full mt-1.5 transition-[width]"
                style={{
                  width: `${Math.max(2, proportion * 100)}%`,
                  background: proportion >= 1 ? 'var(--accent)' : 'var(--ink)',
                }}
              />
            )}
```

- [ ] **Step 3: Add the prop and markup to `AdjustmentRow`**

Add to its props type, beneath `balanceAfter`:

```tsx
  /** 0–1 against the largest amount on screen. A hairline under the merchant
   *  name, so magnitude reads without the amount type changing size. */
  proportion?: number | null;
```

Add `proportion` to the destructured parameters, then after its meta `<span>`
insert:

```tsx
        {proportion != null && (
          <span
            aria-hidden
            className="block h-[2px] rounded-full mt-1.5 transition-[width]"
            style={{
              width: `${Math.max(2, proportion * 100)}%`,
              background: proportion >= 1 ? 'var(--accent)' : 'var(--ink)',
            }}
          />
        )}
```

- [ ] **Step 4: Compute the proportions in `HistoryList`**

Add the import and derive them from the rendered set:

```tsx
import { proportions } from '@/lib/proportions';
```

Inside the component, above the `return`:

```tsx
  // Against the largest amount actually on screen — a rule that answers
  // "how big is this next to the others here" must be scaled to here.
  const rules = proportions(items.map((i) => Number(i.amount) || 0));
```

Then pass `proportion={rules[index]}` to each row, taking the index from the existing `items.map((item, index) => …)` — change the callback signature if it does not already take one.

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npx tsx --test src/lib/*.test.ts`
Expected: exit 0 except the known `history/page.tsx` errors from Tasks 3–4; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SwipeableTransactionRow.tsx src/components/SwipeableTransferRow.tsx src/components/AdjustmentRow.tsx src/components/HistoryList.tsx
git commit -m "Give history rows a proportion rule"
```

---

### Task 6: Wire the page

**Files:**
- Modify: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `getFilterTotals` (Task 2), the new filter props (Tasks 3–4).

- [ ] **Step 1: Fetch the totals and drop the name-only calls**

Replace the imports of `getAllCategories` and `getPaymentMethodNames` with:

```tsx
import { getFilterTotals } from '@/app/actions/history';
```

keeping the existing `listHistoryItems` import from that module. Then replace the fetch block:

```tsx
  const [{ year: currentYear, month: currentMonth }, data, filterTotals] = await Promise.all([
    getCurrentPeriod(),
    listHistoryItems({
      query:      params.q,
      month:      params.month,
      year:       params.year ? Number(params.year) : undefined,
      category:   params.category,
      account:    params.account,
      allTime:    params.allTime === 'true',
    }),
    getFilterTotals({
      month:   params.month,
      year:    params.year ? Number(params.year) : undefined,
      allTime: params.allTime === 'true',
    }),
  ]);
```

and the two filter elements:

```tsx
          <CategoryFilter categories={filterTotals.categories} />
          {filterTotals.accounts.length > 0 && <AccountFilter accounts={filterTotals.accounts} />}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, 14 routes. No remaining errors anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "Feed the history filters their amounts"
```

---

### Task 7: Verify, including the reported bug

**Files:** none modified unless a defect is found.

- [ ] **Step 1: Build a throwaway preview**

Create `src/app/dev-preview/page.tsx` rendering `CategoryFilter`,
`AccountFilter` and `HistoryList`, gated twice: add `dev-preview` to the
matcher in `src/proxy.ts`, and `if (process.env.NODE_ENV !== 'development')
notFound();` in the page. Start the dev server with `preview_start`, never
through a shell.

Use these category figures — a real August, where one category runs away with
it and two sit 7% apart:

```ts
const CATEGORIES = [
  { name: 'Car', value: 23088.19 },
  { name: 'Home Improvement', value: 1332.0 },
  { name: 'Travel', value: 646.8 },
  { name: 'Housing', value: 600.0 },
  { name: 'Groceries', value: 338.04 },
  { name: 'Shopping', value: 119.41 },
];
```

and a second set of twelve, to exercise the band running out of room: the
twelve built-in category names from `src/lib/categories.ts` at values
`2000 - i * 150`. Accounts: `BOA0788 7499.20`, `CHA6527 7360.00`,
`BOA5839 7250.27`, `BOA5800 3311.05`, `CMB7181 1523.51`.

- [ ] **Step 2: Confirm the reported bug is gone**

With twelve categories in a 15rem column: every circle is reachable, the set wraps to multiple rows, and `overflow-x` on the container is not `auto` or `scroll`. Check by measuring, not by screenshot — read `scrollWidth` against `clientWidth` and assert they match.

- [ ] **Step 3: Check the three desktop widths and the phone**

1280, 1440, 1920 and 375: no horizontal page scroll, the filter column holds its circles, rows keep the amount un-truncated.

- [ ] **Step 4: Check the proportion rules**

The largest row's rule is full width and in accent; a single-row result has no rule at all; rules line up left with the merchant name.

- [ ] **Step 5: Check both colour schemes**

`resize_window` with `colorScheme: 'dark'` then `'light'`. The bars, circles and rules all have to hold.

- [ ] **Step 6: Remove the harness and verify it left nothing**

```bash
rm -rf src/app/dev-preview
```

Restore `src/proxy.ts` and confirm with `git diff` that it is byte-identical to the committed version, and that `grep -rn "dev-preview" src/` returns nothing.

- [ ] **Step 7: Full verification**

```bash
rm -rf .next && npx tsc --noEmit && npx tsx --test src/lib/*.test.ts && npm run build && npx eslint src
```

Expected: tsc exit 0, all tests pass, 14 routes, and eslint at 6 problems / 2 errors — the pre-existing `ThemeToggle.tsx` and `MonthPicker.tsx` findings. Do not add a seventh.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A src
git commit -m "Fix defects found verifying the history rebuild"
```
