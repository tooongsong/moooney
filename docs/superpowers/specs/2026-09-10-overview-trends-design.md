# Overview / Trends — Design Spec

Status: approved by user (architecture + 3 safeguards + detailed visual language), pre-implementation

## Problem / Goal

MOOONEY has no way to see spending/income beyond the current month — Home only
shows this-month numbers, Accounts only shows current balances. Add a light
"Overview" view inside the existing Home flow (not a new bottom-nav tab) that
answers: how much did I spend/earn this month / this year / ever, and what's
the trend?

## Non-goals

- No new bottom-nav tab — reached only via a link on Home.
- No swipe/prior-period navigation in v1 (confirmed) — each mode shows only
  the current month / current year / all-time. A later iteration can add an
  anchor-date param without changing this version's data shapes.
- No budgets, no forecasting, no per-account breakdowns, no accounting
  reports — Accounts page keeps owning Net Worth/Assets/Liabilities exactly
  as today; this feature is Cash Flow only.
- No new transaction-calculation logic duplicated from Home — see Data Layer.
- No generic dashboard chart aesthetic (pie/donut, dense line charts, card
  grids, legends, axes) — see Visual Design, which is binding, not optional
  polish.

## Information architecture

- Home's existing "By Category" section gets one new line below it: a small
  `Overview →` link (same visual weight/pattern as the existing "View all →"
  link on Recent transactions), navigating to `/overview`.
- `/overview` is a new top-level route, same shell pattern as `/accounts` and
  `/history` (own page, own `<BottomNav />`).
- `BottomNav`'s Home tab match function changes from `p => p === '/'` to
  `p => p === '/' || p === '/overview'` — Overview is reached from Home and
  is conceptually part of it, so Home stays highlighted while on it. This is
  the one pre-existing file this feature touches outside its own new files.
- Default mode on load: Month.

## Data layer

### Shared aggregation, not duplicated logic

`getHomeData` (`src/app/actions/transactions.ts`) currently inlines a loop
that branches per-transaction on `type` (`expense` adds to spend and
category totals, `income` adds to income, `refund` subtracts from spend,
anything else — including `balance_adjustment` — is silently ignored by
having no matching branch). This loop is extracted, unchanged in behavior,
into a new pure function:

`src/lib/spendingAggregate.ts`:
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
    // any other type (balance_adjustment, future types) contributes nothing —
    // same "no matching branch" exclusion getHomeData already relied on.
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

`getHomeData` is modified to call `aggregateTransactions(monthTxns)` instead
of its inline loop and derive `monthSpend`/`monthIncome`/`monthBalance`/
`categoryData` from the result — its return shape and values are unchanged;
this is a refactor, not a behavior change. (`todaySpend`, which needs a
same-day sub-filter the shared function doesn't do, stays as its own small
loop in `getHomeData` — not part of what's being shared.)

### New: `getOverviewData` (`src/app/actions/overview.ts`)

```ts
export type OverviewPeriod = 'month' | 'year' | 'all';

export interface OverviewData {
  period: OverviewPeriod;
  label: string;           // e.g. "SEP 2026", "2026", "ALL TIME"
  spend: number;
  income: number;
  net: number;
  categoryTotals: { name: string; value: number }[];
  // period-specific trend data — exactly one of these two is populated
  dailyTrend?: { day: number; spend: number }[];    // month mode: one entry per day-of-month elapsed so far
  monthlyTrend?: { month: number; spend: number }[]; // year mode: 12 entries, Jan-Dec, future months = 0
  yearlyTrend?: { year: number; spend: number }[];   // all mode: one entry per year that has ≥1 transaction — see safeguard below
  dailyAverage?: number;   // month mode only
  monthlyAverage?: number; // year mode only
  netWorth?: number;       // all mode only — from computeNetWorth, not recomputed here
}

export async function getOverviewData(period: OverviewPeriod): Promise<OverviewData>
```

Implementation per mode:
- **month**: query transactions for `[startOfMonth(now), endOfMonth(now)]`
  (reuses the same date-fns calls `getHomeData` already uses), run
  `aggregateTransactions`, bucket the same rows by day-of-month for
  `dailyTrend` (only days 1..today, not the whole month — there's no future
  spending to show). `dailyAverage = spend / daysElapsedInMonth`.
- **year**: query `[startOfYear(now), endOfYear(now)]`, aggregate for the
  totals, bucket by month (1-12) for `monthlyTrend` — months after the
  current one are `0`, not omitted, since the year's shape (Jan–Dec) is
  fixed and known even though only some months have happened yet.
  `monthlyAverage = spend / monthsElapsedInYear`.
- **all**: query with no date filter (`allTime`-style, matching
  `listTransactions`' existing `allTime` flag), aggregate for lifetime
  totals, bucket by calendar year for `yearlyTrend`, and separately call
  `getAccountBalances()` → `computeNetWorth()` (both already exist in
  `src/app/actions/accounts.ts` / `src/lib/accountTypes.ts`) for `netWorth`
  — not a new net-worth calculation.

### Safeguards (per your review)

1. **All mode only shows years with data.** `yearlyTrend` is built by
   grouping the actual transaction rows by `getFullYear(date)` — a year with
   zero transactions simply never produces a map entry, so it's absent from
   the array. No padding to a fixed range (e.g. "show 2020–2026 regardless").
   If there are zero transactions ever, `yearlyTrend` is `[]` and the UI
   shows its existing empty state (same pattern as `CategoryBreakdown`'s
   "NO SPENDING YET.").
2. **Averages are NaN/Infinity-safe.** `dailyAverage`/`monthlyAverage` are
   computed as `spend / Math.max(1, daysElapsed)` / `spend / Math.max(1,
   monthsElapsed)` — the denominator can never be `0` (today is always at
   least day 1 of the month and month 1 of the year), but the `Math.max(1,
   …)` guard is applied unconditionally rather than trusted to always hold,
   so a future refactor can't silently reintroduce a divide-by-zero.
3. **"View all →" preserves period context, reusing History's existing
   filters** (`listTransactions` already accepts `month` and `allTime` —
   no new History-side filter added):
   - month mode → `/history?month=YYYY-MM` (zero-padded, matching the exact
     format `listTransactions`' `month` param already parses via
     `parse(month, 'yyyy-MM', new Date())`)
   - all mode → `/history?allTime=true` — **this requires one small addition**:
     `src/app/history/page.tsx` currently destructures
     `{ q, month, category, account }` from `searchParams` and never reads
     an `allTime` key at all, so this URL would silently no-op today (fall
     back to the current-month default) without this fix. The underlying
     support already exists one layer down — `listTransactions`/
     `listHistoryItems` both already accept `allTime?: boolean` — so this is
     wiring the page to read and pass through a param that's already
     plumbed everywhere else, not new filtering logic.
   - year mode → **known deviation, see below.**

## Page structure (shared across modes)

```
OVERVIEW
[ MONTH | YEAR | ALL ]        ← 3-way segmented control, plain text labels

<label>            e.g. "2026 SPENDING"
$18,420                        ← ResponsiveAmount, reused as-is (Home's hero uses the same component)
Income  $32,400   Net  +$13,980

<one mode-specific visualization — see Visual Design>

TOP CATEGORIES
<bubble/block visualization — see Visual Design>
View all →
```

- Month mode adds a `Daily avg` value alongside Income/Net.
- Year mode adds an `Avg/month` value alongside Income/Net.
- All mode adds `Net Worth` (reusing Accounts' number, not recomputing it)
  alongside Income/Net, and has no daily/monthly average (doesn't apply to a
  lifetime view).

## Visual design — binding, not optional

This section is the actual spec for the two new visualization types (trend,
categories) and applies equally to all three modes. It restates your 12
numbered points as concrete build rules.

**No chart containers.** No card, border, shadow, or background box wraps
any visualization. Bars/bubbles sit directly in the page's own whitespace,
same as `ResponsiveAmount` and `CategoryBreakdown` already do on Home today
— this page continues that convention, doesn't introduce a new one.

**Palette discipline.** Only `var(--ink)`, `var(--paper)` /
`var(--paper-card)`, `var(--sand)`/`var(--ink-faint)` (grays), and
`var(--accent)` (the existing vermillion) — the exact same CSS variables
already defined in `globals.css`, no new colors. Category shapes are NOT
color-coded per category — every category shape is the same neutral
ink/sand tone; only size + label differentiate them. The single accent color
is reserved for one emphasis point per visualization (the highest month in
the year trend, the top category), matching how `CategoryBreakdown` already
uses accent only for its #1 row.

**Typography as part of the visualization**, not a caption underneath: the
dollar amount sits inside or immediately beside its shape (bar/bubble), in
the same bold tracking-tight numeric style used everywhere else in the app
(`font-bold tracking-tighter tabular-nums`), not a smaller "tooltip" label.
Month/day labels (`JAN`, `01`) use the existing small-caps pattern already
established (`text-[9px] font-bold uppercase tracking-widest`, the same
classes `CategoryBreakdown` and Home's section labels already use).

**No axes, no gridlines, no legend.** No Y-axis scale, no background grid.
If a value needs explaining, the label sits directly next to its shape.

### Year mode: Jan–Dec trend

`YearTrendBars` component. 12 thick, fully-rounded-top vertical bars (`border-radius`
applied only to the top two corners, full pill-round, not a sharp rect) with
visible gaps between them (not touching, not a filled bar chart). Bar height
scales by that month's spend relative to the max month in the array (same
proportional-sizing idea `CategoryBreakdown` already uses for its bar
widths). Height uses a spring-in-from-0 animation on mount (`motion/react`,
matching the spring config style already established in
`QuickAddIsland.tsx` — no linear/ease-out CSS transition, a real spring, but
restrained: no overshoot/bounce). Bars are ink-colored by default; the single
highest-spend month is accent-colored (mirroring the CategoryBreakdown #1
convention exactly). A `JAN`…`DEC` label sits below each bar; the dollar
figure appears only for the tapped/highest month, not on every bar (avoiding
tooltip-density). Tapping a bar: a quick `scale(0.97→1)` press animation,
then navigates to `/history?month=YYYY-MM` for that month.

### Month mode: daily spend

`DailyTrendRow` component. Between your two offered options (A: one bubble
per day sized by spend; B: a vertical day-by-day list with dot-runs), this
uses a horizontal calendar-strip of compact vertical bars — closer to B's
"editorial calendar" feel than A's bubbles, and deliberately reuses the same
bar grammar as `YearTrendBars` (thick, rounded tops, proportional height, no
axis) rather than introducing a third distinct shape language into the page.
A vertical day-by-day list (literally stacking up to 31 rows) would dominate
the "one main visualization" budget on a mobile-width page far more than a
compact horizontal strip does — that's the reasoning for this choice.

One bar per day-of-month elapsed so far, height scaled to that day's spend
(days with $0 render as a minimal stub, not absent — the row's day-count
stays legible). No per-day dollar labels (too dense for 28-31 items) — just
the day number underneath, every 5th day only (`01`, `05`, `10`…) to avoid
label crowding.

### Top Categories: size-by-value blocks

`CategoryBlocks` component — new, replacing a plain reuse of Home's
`CategoryBreakdown` for this page specifically (Home keeps
`CategoryBreakdown` exactly as it is today; this is a new sibling component,
not a modification of the existing one — the *data* (`categoryTotals` shape)
is shared, the *presentation* is not, since you've asked for a materially
different visual treatment here than Home's flat bar-fill rows). Top 3–5
categories only (never "all categories" on this page — "View all" is the
escape hatch to History). Each category renders as a rounded block/circle
sized by its value relative to the largest shown category — largest
category gets the biggest shape and accent color (again mirroring the
existing #1-gets-accent convention), the rest are ink/sand-toned and
proportionally smaller. Category name + dollar amount sit inside or
immediately beside the shape, not in a separate legend. Per your "80%
regular geometry / 20% organic" note: shapes are simple rounded
rectangles/circles by default (not literal blob paths) — one shape in the
set (deterministically the largest/#1) gets a subtly asymmetric corner
radius (e.g. one corner rounder than the others) as the "organic" accent
touch, rather than randomizing every shape's geometry.

### Motion (all visualizations)

- Bars: height springs from 0 on mount/mode-switch.
- Blocks/circles: scale springs from 0.85→1 on mount/mode-switch.
- Switching Month/Year/All: the outgoing visualization fades/scales out,
  the incoming one fades/scales in — a cross-fade, not a hard cut. Uses
  `motion/react`'s `AnimatePresence`, spring configs consistent with
  `QuickAddIsland.tsx`'s existing `SPRING_OPEN`/`SPRING_CLOSE` restrained
  feel (no bounce).
- Tap targets (a bar, a category block): `scale(0.97→1)` press feedback,
  matching the press-scale convention already used on buttons elsewhere in
  the app (e.g. `active:scale-95`/`active:scale-[0.97]` classes already
  present in `ManageList.tsx`, `QuickAddIsland.tsx`).
- The big spend number does a subtle count-up on mode switch (animate from
  the previous mode's value to the new one, not an instant swap) — restrained
  duration (~300-400ms), not a slot-machine effect.

## Testing / verification

- Month mode on an account with zero transactions this month: spend/income/
  net all read $0, `dailyTrend` is an array of zero-height stubs (not
  empty — "days elapsed so far" still has entries), `dailyAverage` is `0`,
  not `NaN`.
- Year mode in January (1 month elapsed): `monthlyAverage = spend / 1`,
  not divided by 12. `monthlyTrend` still has all 12 entries, months
  Feb–Dec are `0`.
- All mode for a brand-new account (zero transactions ever): `yearlyTrend`
  is `[]`, category/top-categories area shows the existing empty state,
  `netWorth` still resolves correctly from `computeNetWorth` (independent
  of transaction history).
- All mode for an account whose transactions span non-contiguous years
  (e.g. 2023 and 2026 but nothing in 2024/2025): `yearlyTrend` has exactly
  two entries (2023, 2026), not four.
- Tapping a month bar in Year mode for a month with zero transactions
  still navigates to `/history?month=YYYY-MM` (an empty History view is
  correct, not an error).
- `getHomeData`'s existing return values (`monthSpend`, `todaySpend`,
  `monthIncome`, `monthBalance`, `categoryData`, `recent`) are
  byte-for-byte identical before/after the `aggregateTransactions`
  extraction — this is a regression check on the refactor, not new
  behavior.
- Home page still renders exactly as today except for the one new
  `Overview →` link; `BottomNav` still highlights "Home" on `/` and now
  also on `/overview`, and continues to highlight "Accounts"/"History"
  correctly on their own routes (the added `|| p === '/overview'` clause
  doesn't affect the other two tabs' match functions).
- Category color check: no category-specific color mapping exists anywhere
  in the new components — grep for it during review.

## Known deviation, flagged for your visibility

Year mode's "View all →" cannot literally preserve "this year" as History's
filter, since History has no year-only filter today and adding one is
out-of-scope duplication of filtering logic. It falls back to History's
default (current month) rather than showing the whole year. If this isn't
acceptable, the alternative is a small, explicitly-scoped addition to
History's own filters (a `year` param) — flagging rather than silently
picking one.
