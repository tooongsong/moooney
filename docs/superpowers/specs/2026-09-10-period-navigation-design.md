# Shared Period Navigation (Overview + History) — Design Spec

Status: approved by user (architecture + 4 safeguards), pre-implementation

## Problem / Goal

Overview currently only shows the current month/current year/all-time — no
way to look at a past period. History can only step one month at a time via
tiny, hard-to-tap arrows, with no way to jump straight to an arbitrary month.
Build one shared time-navigation system (arrows + a tap-to-open picker) used
by both pages, with the selected period living in the URL so it survives
refresh and back/forward.

## Non-goals

- No calendar-style date-range picker, no custom "from/to" ranges — just
  whole months and whole years, matching the app's existing month-based
  transaction model.
- No change to All mode (still lifetime, no anchor concept applies to it).
- No change to `aggregateTransactions` or any expense/income/refund logic —
  this is entirely about *which* period's data gets fetched and how the user
  picks it, not how a period's numbers are computed.
- Don't touch Accounts, balance adjustment, or any unrelated page.

## Root cause: History's arrow tap target (user's question 5)

Read `src/components/MonthFilter.tsx:26-43` directly. The prev/next buttons
are real `<button>` elements — the *whole* padded area is already clickable,
not just the SVG icon glyph — so this isn't a pointer-events, z-index, or
overlapping-element bug. The actual cause is size: `p-2` (8px) around a
16px icon gives roughly a 32×32px hit target, under the ~44×44px minimum
usable touch-target size. `MonthFilter` is being replaced outright (see
below), so this gets fixed by construction in the new shared component
rather than patched in place.

## URL design

**Overview** (`/overview`):
- `?period=month&month=YYYY-MM` — a specific month. Missing/invalid →
  defaults to the current month.
- `?period=year&year=YYYY` — a specific year. Missing/invalid → defaults to
  the current year.
- `?period=all` — lifetime, no anchor param applies.
- No params at all → `period=month`, current month (today's behavior,
  unchanged for a first visit).
- A `month`/`year` value later than the real current month/year is clamped
  to the current one when computing data (defensive parsing — a hand-edited
  or stale URL should degrade gracefully, never crash or show a nonsensical
  future period).

**History** (`/history`): unchanged shape, still just `?month=YYYY-MM` (no
`period` key — History has no year/all concept). A **new** `?year=YYYY`
filter is added (see Safeguard 4 below) specifically so Overview's Year mode
can hand off full period context to History, matching every other period
type. This is a small, targeted addition mirroring the existing `month`/
`allTime` params exactly — not a general date-range feature.

## Data layer

### `getOverviewData` gains an anchor parameter

```ts
export async function getOverviewData(period: OverviewPeriod, anchor: Date = new Date()): Promise<OverviewData>
```

`getMonthOverview`/`getYearOverview` already take a `Date` parameter
internally (today they're just always called with `new Date()`) — so this is
threading an existing parameter through, not new plumbing.

**A real bug this surfaces, caught during design, not left for review to
find:** both functions compute "how much of this period has elapsed" from
that same `Date` parameter — `getMonthOverview`'s `today = now.getDate()`
(used for `dailyTrend`'s day count and `dailyAverage`'s denominator) and
`getYearOverview`'s `monthsElapsed = now.getMonth() + 1` (used for
`monthlyAverage`'s denominator). Both formulas silently assumed `now` really
was "now." Once `now` can be an arbitrary anchor (e.g. March 2024, entirely
in the past), those formulas break: constructing the anchor as day-1 of
March 2024 would make `today = 1`, showing only one day of a month that's
completely over, and would make `monthsElapsed` reflect the anchor's own
month index instead of the fact that a past year is *fully* elapsed.

**Fix:** both functions must distinguish "the anchor's period is the current
real period" from "the anchor's period is fully in the past":
```ts
import { isSameMonth, isSameYear, getDaysInMonth } from 'date-fns';

// inside getMonthOverview(userId, anchor):
const realNow = new Date();
const today = isSameMonth(anchor, realNow) ? realNow.getDate() : getDaysInMonth(anchor);

// inside getYearOverview(userId, anchor):
const realNow = new Date();
const monthsElapsed = isSameYear(anchor, realNow) ? realNow.getMonth() + 1 : 12;
```
A fully-past month shows all its days in `dailyTrend`/`dailyAverage`; a
fully-past year divides by 12, not by the anchor's own month number. The
current-period behavior (today's actual behavior) is exactly the `isSameMonth`/
`isSameYear` branch, so this is additive, not a change to existing output for
"today."

`label`/`monthKey` inside each function switch from `now` to `anchor`
(same formulas, different variable name) — no other change to either
function's body.

### History: a `year` filter, mirroring `allTime`

`listTransactions`/`listHistoryItems` gain a `year?: number` param, applied
as a `[startOfYear, endOfYear]` date-range filter — structurally identical to
how `month`/`allTime` already work, just a different range. `year` and
`month` are mutually exclusive in practice (Overview only ever sends one),
but if both were somehow present, `month` should win (it's the more specific
filter) — implemented as: only apply the `year` range when `month` is absent.

## Shared components

Three new files, used by both pages, replacing `MonthFilter.tsx` entirely
(deleted, not deprecated-in-place — its one caller, `src/app/history/page.tsx`,
switches to the new components).

### `PeriodNavigator`

```tsx
interface PeriodNavigatorProps {
  label: string;             // e.g. "SEP 2026" or "2026" — caller formats it
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;    // true when already at the current real period
  onLabelClick: () => void;  // opens the relevant picker
}
```

`[←]  label  [→]`. Per Safeguard 1: each arrow's actual `<button>` is sized
for a real touch target (`min-h-11 min-w-11` / roughly 44×44px, achieved via
padding — not by inflating the icon), while the icon glyph inside stays
small and light (`h-3.5 w-3.5`, `stroke-[1.75]`, `text-ink-faint`) so the row
still reads as compact, editorial typography rather than a chunky control.
The label itself is a tap target too (`onLabelClick`), styled as plain bold
text with no button chrome (no border/background) so it doesn't look like a
settings-page dropdown.

### `MonthPicker`

A bottom sheet (reusing the existing `Dialog`/`DialogContent`/`DialogOverlay`
primitives from `src/components/ui/dialog.tsx` — same underlying Radix
dependency already used elsewhere in this codebase, just with `DialogContent`
given bottom-anchored positioning classes instead of its default centered
modal position, e.g. `fixed inset-x-0 bottom-0 top-auto translate-y-0
rounded-t-3xl rounded-b-none` — no new dependency, no new animation library).

```tsx
interface MonthPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number;   // 1-12
  onSelect: (year: number, month: number) => void;
}
```

Header row: `← {year} →` (year-scoping arrows, no floor — the user
explicitly wants to be able to browse back to an empty historical year; the
only bound is not going past the current real year going forward, since a
future month has nothing to show and isn't "historical"). Below it, a 3×4
grid of month abbreviations (JAN…DEC). Per Safeguard 2: **no month is ever
disabled or dimmed for lacking transactions** — every month in the current
grid year is tappable, including future months within a *past* browsed year
that's still fully in the past... concretely: the only real constraint is
that a month later than the current real month, in the current real year, is
disabled (that one case is "the actual future," not "an empty past period" —
those are different things and only the former is excluded). The currently
selected month (matching `selectedYear`/`selectedMonth`) is visually
distinct (accent-filled, matching the app's existing #1/active convention)
from all others (neutral). Tapping a month calls `onSelect` and the caller
closes the sheet (picker doesn't self-close on select — caller decides,
consistent with how `EditBalanceDialog`'s two-step flow already separates
"selection" from "the effect of selecting").

### `YearPicker`

Same bottom-sheet mechanism, simpler content: a vertical list of years.

```tsx
interface YearPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  availableYears: number[];  // years with ≥1 transaction, ascending — caller supplies this
  onSelect: (year: number) => void;
}
```

Per Safeguard 2 ("prioritize years with data, but still allow reasonable
navigation beyond them"): the rendered list is the union of `availableYears`
and a padding range so the list is never sparse/gappy for a new account —
`[min(availableYears[0] ?? currentYear, currentYear - 4) .. currentYear]`,
i.e. always at least 5 years shown (current year and 4 back) even with zero
transaction history, extended further back automatically if real data goes
back further. No year in that computed range is disabled — "prioritize"
means "the list is informed by real data so it's not an arbitrary/wrong
range," not "gate navigation on data existing." No forward/future years
past the current real year (same "historical, not future" framing as
`MonthPicker`).

`availableYears` is cheap to get: it's exactly the `year` field of
`getAllOverview`'s existing `yearlyTrend` array (`src/app/actions/overview.ts`)
— the Overview page already fetches All-mode-shaped data infrastructure
elsewhere in the app; for this feature, `YearPicker`'s caller queries the
same distinct-years-with-data logic (a lightweight reuse of the existing
grouping approach, not a new calculation).

**Why `MonthPicker`'s year-stepper has no floor but `YearPicker`'s list is a
bounded range:** they're different UI shapes solving different problems. The
year-stepper is a single ±1 control the user presses repeatedly — it can't
"look broken," it just takes more taps to go further back, which is
self-limiting. A year *list*, by contrast, would either be absurdly long
(rendering every year since 1970) or need an arbitrary cutoff no better than
a data-informed one — so it uses the computed range instead. Both satisfy
Safeguard 2 (never disable a period for lacking data); they just satisfy it
with UI shapes suited to how each is browsed.

## Page wiring

### Overview: URL-driven, single fetch, stable shell (Safeguard 3)

`src/app/overview/page.tsx` (Server Component) reads `searchParams: {period?,
month?, year?}`, resolves the effective `OverviewPeriod` + anchor `Date`
(defaulting/clamping per the URL design above), and calls `getOverviewData(period,
anchor)` **once** — replacing the current three-eager-fetches design (that
design was only valid when every mode showed exactly one fixed "current"
thing; it can't be prefetched exhaustively once any month/year is reachable).

To avoid flicker (Safeguard 3): the page's shell — the "OVERVIEW" title, the
MONTH/YEAR/ALL segmented control, and the `PeriodNavigator` row — renders
from a client component whose own JSX is structurally identical across
navigations (same component tree, same keys), so React's reconciliation
doesn't remount it even though the Server Component "re-ran" for a new URL.
Only the data-dependent inner content (the hero number, the trend chart, Top
Categories) sits inside the existing `AnimatePresence`, now keyed by a
composite string derived from the URL (`` `${period}-${month ?? year ?? 'all'}` ``)
instead of local `mode` state — this preserves exactly the crossfade
behavior already built and reviewed, just re-driven by the URL instead of
`useState`. Arrow taps and picker selections call `router.push` wrapped in
`startTransition` (from `react`), so the previous content stays visible
(not blanked/spinner'd) while the next RSC payload loads — the standard
Next.js App Router pattern for this exact complaint.

Switching top-level mode (the MONTH/YEAR/ALL tabs) has exactly one special
case, to avoid combinatorial guessing about every tab-to-tab transition:
Month → Year carries over the currently-viewed month's year (e.g. viewing
March 2024, tapping YEAR lands on `year=2024`, not the current real year) —
this is the one transition explicitly exercised by "drill into a month, then
zoom out to its year." Every other tab switch (Year → Month, anything → All,
first load on any tab) defaults to the current real month/year. No other
carried-over state.

### Overview: Year mode's Jan–Dec bars

Change from `/history?month=YYYY-MM` to `/overview?period=month&month=YYYY-MM`
(Safeguard 4, and directly requested) — drilling into a month shows that
month's own Overview (spend/income/net/categories/daily trend) first, not
straight to a transaction list.

### Overview: "View all →" (Safeguard 4 — consistent period context)

- Month mode → `/history?month={monthKey}` (unchanged from before).
- Year mode → `/history?year={year}` (previously a known, documented
  deviation with no year filter available — now resolved by History's new
  `year` param above, so this is no longer a gap).
- All mode → `/history?allTime=true` (unchanged).

### History: replaces `MonthFilter` with `PeriodNavigator` + `MonthPicker`

`src/app/history/page.tsx`'s filter section swaps `<MonthFilter />` for a
small client wrapper that renders `<PeriodNavigator>` (label click opens
`<MonthPicker>`) wired to the page's existing `?month=` URL param via
`router.push`, using the exact same `startTransition`-wrapped navigation
pattern as Overview for a non-flickering update of the transaction list
below it. `MonthFilter.tsx` is deleted once nothing imports it.

### Cross-navigation round-trip (Safeguard 4)

- Overview's Year-mode bar → `/overview?period=month&month=YYYY-MM` (its own
  page, not History) — see above.
- Overview's "View all →" in month mode → `/history?month=YYYY-MM` — History
  opens already scoped to that exact month, no extra clicking.
- History's month picker/arrows never need to hand context back to Overview
  (there's no "back to Overview" affordance being added — out of scope,
  not requested).
- Browser back/forward: since every navigation is a real URL change (via
  `router.push`, not `replace`), the browser's native history stack already
  restores the previous period correctly on back/forward — this falls out of
  using real URL navigation rather than needing separate handling.

## Testing / verification

- Navigate Overview to a month with zero transactions in a year that itself
  has other months with data: `dailyTrend` still renders (all-zero stubs),
  `dailyAverage` is `0`, not `NaN` (existing safeguard, still holds for an
  arbitrary anchor).
- Navigate Overview to a fully-past month (e.g. 3 months ago): `dailyTrend`
  has one entry per day *in that month* (28-31, not clipped to "today's"
  day-of-month), `dailyAverage` divides by that month's real day count.
- Navigate Overview to a fully-past year: `monthlyAverage` divides by 12,
  not by the anchor's own month index.
- MonthPicker: open it while viewing the current month — every month in the
  grid is tappable except months after the current one in the current year;
  a month in an empty past year is fully selectable and, once selected,
  shows an all-zero Overview, not an error or a disabled state.
- YearPicker: for a brand-new account with zero transactions, the list still
  shows at least 5 years (current back to current−4), all selectable.
- History `?year=2025` (no `month`) shows all 2025 transactions; `?month=`
  present alongside `?year=` makes `month` win.
- Tap the Year-mode Nov bar → lands on `/overview?period=month&month=YYYY-11`
  showing that month's own Overview, not History.
- From that page, tap "View all →" → lands on `/history?month=YYYY-11`.
- Switch Overview from Month (viewing March 2024) to Year mode → year picker
  context is 2024, not the current real year.
- Use browser back after two Overview navigations → lands on the
  intermediate period, URL and displayed data match.
- Rapidly tap next-month twice → no flicker/blank frame between the two
  transitions (shell stays mounted throughout, verified by checking the
  shell's DOM node identity doesn't change across the navigation in a
  browser test, not just by eyeballing it).
