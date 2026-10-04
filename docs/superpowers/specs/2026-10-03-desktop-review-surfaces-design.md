# Desktop Review Surfaces — Design Spec

Status: approved by user (scope, layout, visual direction, per-page treatment), pre-implementation

## Problem / Goal

MOOONEY was built mobile-first and several of its components were dropped into
the desktop layout untouched. The user reports that "a lot of places still use
the phone design, so things get cut off" — the concrete example being category
selection on History.

Six components carry no `lg:` breakpoint at all: `CategoryFilter`,
`AccountFilter`, `MonthPicker`, `YearPicker`, `PeriodNavigator`,
`SwipeableTransactionRow`. They are phone components rendered inside a desktop
shell.

The goal is not to patch those six. The user chose a genuine desktop redesign of
the surfaces they use to *review* their money on a computer, in the app's own
visual language, so the desktop app reads as one design system rather than an
enlarged phone.

## Scope

The user ranked what they want to do at a desktop:

1. **Drill down** — click a category, see the transactions behind it
2. **Reconcile** — net worth and account balances together
3. **Trend** — a continuous multi-month view
4. **Compare** — period against period

This spec covers those. Three surfaces change:

| Surface | Role |
| --- | --- |
| `/overview` | Where the money went — drill-down and trend |
| `/accounts` | Reconciliation — net worth, balances, per-account flow |
| `/history` | Reading individual records |

## Non-goals

- **Bulk editing is a separate project.** Multi-select, bulk category change and
  bulk delete were explicitly deferred to their own spec. They need new
  server actions (every mutation today is single-record: `updateTransaction(id)`,
  `deleteTransaction(id)`) plus an undo affordance, and they should be built on
  top of the desktop skeleton this spec establishes, not beside it.
- **Mobile does not change.** Every treatment here is behind the existing
  `≥1024px` breakpoint. The bottom sheets, the swipe gestures and the Dynamic
  Island Quick Add stay exactly as they are on phones.
- **No period comparison in this version.** It ranked last and the right-hand
  panel is already carrying two states; adding a third would make it a mode
  switcher. A later iteration can add it without changing these data shapes.
- **No dense data table.** The project's design system rules out the
  "traditional finance app look" explicitly, and the acceptance question for
  every page is whether it reads like a Swiss editorial poster. Adding columns
  to fill desktop width is the obvious move and the wrong one.
- **No new dependency.** Everything here is layout, existing primitives and
  CSS.

## Visual language

Binding, not optional polish. Derived from the existing `CategoryBlocks` and
`TrendBars`, which this spec scales up rather than replaces.

- **Primitives**: circles sized by value; thick bars with pill tops
  (`rounded-t-full`). The largest member of any set is `--accent`; the rest are
  `--sand` or `--ink`.
- **The top circle keeps its organic radius**
  (`48% 52% 50% 50% / 52% 48% 52% 48%`) — it is what makes the set read as drawn
  rather than charted.
- **Type scale is extreme**: hero amounts around 76px against 9px uppercase
  labels at ~2.2px letter-spacing. The number is the visual.
- **Structure comes from hairline rules and whitespace, never cards.** No
  shadows, no gradients, no glassmorphism.
- **One accent colour.** Red is load-bearing precisely because it is scarce. A
  colour-field variant that filled half the screen with it was considered and
  rejected: once red is the background, nothing can be emphasised against it,
  and this is a page opened daily.
- **Sizes scale beyond the phone's ceiling.** `CategoryBlocks` caps circles at
  132px for a phone; desktop goes to ~168px. That headroom is the point of the
  redesign.

## Layout conventions (shared)

- **Fixed max width, centred.** The user views on several different monitors and
  asked that extra width become margin rather than stretch. Existing `d-max-*`
  utilities already do this; the content inside them is what changes.
- **Circles are controls.** Minimum 38px, names rendered *outside* the circle.
  Putting the label inside is why long category names were cramped, and
  undersized circles are why the filter was hard to hit.
- **Filter sets wrap; they never scroll horizontally.** This is the root cause
  of the reported bug — see Defects below.
- **Pickers are popovers on desktop.** `MonthPicker` and `YearPicker` hard-code
  `position: fixed; bottom: 0; left: 0; right: 0` with `rounded-t-3xl` and
  `env(safe-area-inset-bottom)`. On a wide screen that is a full-width drawer
  rising from the bottom of the monitor to choose a month. On desktop they
  anchor to their trigger; on mobile they stay bottom sheets.
- **Delete is reachable with a mouse.** `SwipeableTransactionRow` is the only
  delete affordance in a list, and desktop has no swipe. Rows reveal a delete
  control on hover; the swipe stays for touch.

## Defects this fixes

Found while surveying, all currently live:

1. `CategoryFilter.tsx:22` and `AccountFilter.tsx:22` —
   `flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6`. A horizontal scroll
   strip with a hidden scrollbar, placed inside the 15rem (`d-col-nav`) sidebar.
   Past roughly the second pill, categories are invisible *and* unreachable with
   a mouse, with nothing to indicate more exist. **This is the reported bug.**
2. `-mx-6 px-6` full-bleed appears in nine files; inside a narrow desktop column
   it bleeds content out of its container.
3. `/overview` has no desktop layout at all — only a 64rem cap. The one page
   that is entirely charts is a narrow strip on a wide screen.
4. `/accounts` (48rem) and `/manage` (no `d-*` classes at all) are likewise
   untouched phone layouts.

## Per-surface design

### `/overview` — master–detail

Two columns inside the centred container.

**Left column** — period chips (Month / Year / All), `PeriodNavigator`, the hero
amount, a small income / net / daily-average row, then categories as a set of
circles sized by spend. The selected category becomes the accent-coloured
organic blob.

**Right column has two states.** This is how the trend requirement is satisfied
without finding it separate real estate:

- *Default (nothing selected)* — the continuous 12-month trend, with monthly
  average and peak below a hairline rule.
- *Selected* — that category's label and total, **its share of total spend as a
  percentage**, a per-day bar chart for the period, and the matching
  transactions.

The share percentage was lifted from the rejected colour-field variant; it is
the one thing that version did better.

Clicking the selected category again clears the selection and returns the right
column to the trend. Changing period clears it too: a category selected in one
month should not silently carry into another.

### `/accounts` — reconciliation

Reconciliation lives here rather than as a band under Overview. Both placements
were designed; this one was chosen because the "see everything on one page"
promise cannot be kept on a 13" laptop — the band is pushed below the fold,
which is a scroll instead of a page change, having given up compositional
clarity for nothing. `/accounts` also has no desktop layout yet, so the work is
needed regardless.

Net worth as the hero number. Accounts as circles sized by balance, with
**liabilities drawn as outlined circles in accent** rather than filled — a flat
way to separate sign without introducing a second colour. Right column: the
selected account's monthly in/out, a bar chart and its recent entries, with a
vertical account-name label.

With nothing selected the right column shows combined monthly in/out across all
active accounts, so the page is useful before the first click. Archived accounts
stay excluded, as they are today.

### `/history` — geometric filters, readable rows

The user chose the full redesign over the minimal fix, after a recommendation
for the minimal one. The concern behind that recommendation — that History is a
page for reading records, where turning filters into shapes can make "click that
category" harder — is addressed inside the design rather than set aside:

- Circles are at least 38px and names sit outside them.
- The set **wraps**, so nothing is clipped or unreachable.
- An "All" circle stays as an explicit reset.

Left column: search, period navigation, categories as circles, accounts as
horizontal bars. Right column: the filtered total above a rule, then rows.

History's right column has one state, not two: it always lists whatever the
current filters select, which with no category chosen is every entry in the
period. The proportion rule is scaled against the largest amount in the current
result set, and is omitted entirely when a result set has one row, where a
full-width rule would imply a comparison that isn't there.

**Row treatment: uniform type size, with a thin proportion rule.** Amount type
stays at one size; a hairline under each merchant name encodes that entry's
share, the largest in accent. The alternative — scaling amount type by value —
was rejected because the scale is relative to the current view, so the same $82
transaction renders at a different size under a different filter, and readers
read type size as absolute magnitude. A rule reads as a proportion and cannot be
misread as anything else.

## Implementation notes

- Desktop treatments extend the existing `d-*` utilities in `globals.css`
  (outside `@layer`, `min-width: 1024px`). Prefer adding to that vocabulary over
  scattering `lg:` prefixes, matching how Home and History already work.
- `CategoryBlocks` and `TrendBars` gain size/variant inputs rather than being
  forked; mobile call sites keep today's values.
- `/overview` and `/accounts` select state belongs in the URL, matching the
  existing `?period=`/`?month=` convention, so a drill-down is linkable and the
  back button works.
- `/manage` is out of scope but will look increasingly odd as the only remaining
  pure-phone page; worth its own small pass afterwards.

## Verification

- Each surface checked at 1280, 1440 and 1920 widths, confirming extra width
  becomes margin and no horizontal scroll appears.
- Every category and account in a filter set reachable by mouse with no
  horizontal scrolling — a regression check for the reported bug, with enough
  categories to exceed one row.
- Pickers anchor to their trigger above 1024px and remain bottom sheets below.
- Delete reachable without a pointer gesture on desktop; swipe still works on
  touch.
- Mobile layouts diffed against current behaviour and unchanged.
- Light and dark mode for the accent-coloured and outlined shapes.
- Existing unit tests stay green; this is presentation work and should not
  require changes to aggregation logic.

## Sequencing

The three surfaces are independent and should be separate phases, in this order:
`/overview` first (it establishes the scaled-up primitives the other two reuse),
then `/history` (it carries the reported bug), then `/accounts`. The shared
conventions — popover pickers, hover delete, wrapping filter sets — land with
the first surface that needs them.

## Open questions

None. Scope, layout, visual direction, reconciliation placement and row
treatment are all decided.
