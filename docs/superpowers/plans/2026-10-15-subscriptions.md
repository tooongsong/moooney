# Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Subscriptions surface that shows what renews, when, and what the standing commitment costs per month — without any of it entering a spending figure.

**Architecture:** Occurrences are derived from a stored billing anchor by a pure, unit-tested module; nothing about a schedule is persisted beyond the anchor. Payment confirmation lives on the transaction that paid, through two nullable columns, and is matched at the cycle's own granularity so moving a billing day does not orphan the past. The page is a server component with filter, sort and view in the URL; only the form, the day dialog and the link picker are client components.

**Tech Stack:** Next.js 16 App Router + Server Actions, React 19, TypeScript, Tailwind v4, drizzle-orm + postgres-js on Supabase Postgres, `node:test` for unit tests, lucide-react for icons, sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-10-14-subscriptions-design.md` — read it before Task 1. The plan argues from it; where this plan and the spec disagree, the spec wins and the plan is wrong.

## Global Constraints

- **A subscription is an expectation. A transaction is a fact.** Nothing added here may change a figure on Home, Overview, History or Accounts. Those are built from `transactions` and stay that way. Task 9 verifies this against the live database.
- **Calendar dates are `"YYYY-MM-DD"` strings.** No `Date` object ever holds one. All date work goes through `src/lib/dates.ts`. Because the strings are zero-padded, `<` and `>` on them are chronological — the code relies on this.
- **Money is `numeric(12,2)`** in Postgres, typed `$type<number>()` in drizzle, rendered through `formatCurrency` / `formatSignedCurrency` from `src/lib/utils.ts`.
- **Every query names its columns.** A bare `findMany` pulls every column of every row; this project has already burned 6.5 GB of Supabase egress that way. Pass `columns: { ... }` on every read.
- **Design system:** no gradients, no card stacking, no heavy shadows, no per-item colour palette. Surfaces are `--sand` fills and `--line` rules on `--paper`. Radii 16/24/pill. Labels are `text-[9px] font-bold uppercase tracking-widest text-ink-faint`.
- **Amounts are never truncated.** Use `ResponsiveAmount` for hero figures; for inline figures give the amount `shrink-0` and let the label truncate.
- **The bottom nav keeps four tabs.** It measures 299px and clears a 320px screen by 10px. Nothing in this plan adds a fifth.
- **New wording** on this surface is "expected", "upcoming", "monthly equivalent", "annual equivalent". Never "spent" or "spending".
- **Tests** are `node:test`, run with `npm test`. A lib module that is unit-tested imports its neighbours with a relative `.ts` extension (`'./dates.ts'`), not the `@/` alias — bare `node --test` cannot resolve tsconfig paths. `allowImportingTsExtensions` is already on, and webpack resolves it in the app build.
- **Nothing in this plan writes to the database.** No INSERT, UPDATE, DELETE or
  DDL, for any reason, including throwaway probe rows and their cleanup. The
  one additive migration in Task 2 is already applied and is the last schema
  change. Read-only queries are expected and encouraged: `pg_tables`,
  `pg_policies`, `pg_constraint`, `information_schema`, row counts, checksums.
  Where a step once proved something by creating a row, it now proves it from
  an existing row, from a fixture, or by reading the code — and where it can be
  proved by none of those, it is written up for the user to run themselves and
  recorded as unverified until they do.
- **Commit after every task.** Message body explains why, not what.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/subscriptionSchedule.ts` | Pure billing arithmetic: occurrences from an anchor, period keys, normalisation. No I/O. |
| `src/lib/subscriptionSchedule.test.ts` | Its unit tests, including the re-anchor regression. |
| `supabase/migrations/0004_subscriptions.sql` | The `subscriptions` table, its RLS policy, and the two link columns on `transactions`. |
| `src/app/actions/subscriptions.ts` | Every server action for this feature. |
| `src/app/subscriptions/page.tsx` | The route: reads searchParams, fetches, composes. |
| `src/components/SubscriptionMark.tsx` | The sand circle with an emoji or an initial. |
| `src/components/SubscriptionList.tsx` | Filter/sort controls and the cycle-grouped list. |
| `src/components/SubscriptionDialog.tsx` | Add / edit / status / delete, client. |
| `src/components/SubscriptionCalendar.tsx` | The month grid and its two figures. |
| `src/components/SubscriptionDayDialog.tsx` | One day's occurrences, client. |
| `src/components/SubscriptionHistory.tsx` | Occurrence states and the link control, client. |

**Modified**

| File | Change |
|---|---|
| `src/lib/dates.ts` | Three calendar helpers: `addDays`, `daysBetween`, `weekdayOf`; `format` exported as `makeCalendarDate`. |
| `src/lib/ledger.ts`, `src/lib/accountCircles.ts` | One import each, alias → relative, so `npm test` can run their existing tests. |
| `package.json` | A `test` script. |
| `src/db/schema.ts` | The `subscriptions` table; two columns on `transactions`. |
| `src/components/DesktopSidebar.tsx` | A fifth `NAV` entry. |
| `src/components/OverviewClient.tsx` | The phone's entry row. |
| `src/app/overview/page.tsx` | Fetch the recurring total and pass it down. |

---

### Task 1: The billing arithmetic

The heart of the feature and the only part that is hard to get right. Pure functions, no database, no React. Written test-first because every bug here is a wrong date shown to the user with total confidence.

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/ledger.ts:1`
- Modify: `src/lib/accountCircles.ts:1`
- Modify: `package.json`
- Create: `src/lib/subscriptionSchedule.ts`
- Test: `src/lib/subscriptionSchedule.test.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: `CalendarDate`, `daysInMonth`, `yearOf`, `monthOf`, `dayOf` from `src/lib/dates.ts`.
- Produces:
  - `type SubscriptionCycle = 'weekly' | 'monthly' | 'yearly'`
  - `type SubscriptionStatus = 'active' | 'paused' | 'ended'`
  - `interface Schedulable { anchorDate: CalendarDate; cycle: SubscriptionCycle; status: SubscriptionStatus; stoppedOn: CalendarDate | null }`
  - `occurrencesBetween(sub: Schedulable, from: CalendarDate, to: CalendarDate, today: CalendarDate): CalendarDate[]`
  - `nextOccurrence(sub: Schedulable, from: CalendarDate, today: CalendarDate): CalendarDate | null`
  - `periodKeyOf(cycle: SubscriptionCycle, date: CalendarDate): string`
  - `monthlyEquivalent(amount: number, cycle: SubscriptionCycle): number`
  - From `src/lib/dates.ts`: `addDays(date: CalendarDate, n: number): CalendarDate`, `daysBetween(a: CalendarDate, b: CalendarDate): number`, `weekdayOf(date: CalendarDate): number`, `makeCalendarDate(year: number, month: number, day: number): CalendarDate`

- [ ] **Step 1: Make the existing tests runnable**

Two test files currently cannot run at all: `node --test` does not read tsconfig `paths`, so `@/lib/...` inside the module under test throws `ERR_MODULE_NOT_FOUND`. They have been protecting nothing. Change one import in each file.

In `src/lib/ledger.ts` line 1:

```ts
import { BALANCE_ADJUSTMENT_TYPE } from './categories.ts';
```

In `src/lib/accountCircles.ts` line 1:

```ts
import { circleSizes, type CircleSizeOptions } from './circleSizes.ts';
```

Add to `package.json` `"scripts"`, after `"lint"`:

```json
    "test": "node --test src/lib/*.test.ts",
```

- [ ] **Step 2: Run the suite and see it green**

Run: `npm test`
Expected: all five existing test files pass — `accountCircles`, `backTarget`, `circleSizes`, `dates`, `ledger`. Before this step the first and last failed to load.

- [ ] **Step 3: Write the failing tests for the date helpers**

Append to `src/lib/dates.test.ts`:

```ts
test('addDays moves by whole days and crosses a month boundary', () => {
  assert.equal(addDays('2026-01-30', 3), '2026-02-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29'); // leap year
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-06-15', 0), '2026-06-15');
});

test('addDays is immune to the host timezone, including across a DST jump', () => {
  // These two dates are chosen to fail a local-midnight-plus-24-hours
  // implementation, which is the mistake this test exists to catch.
  // 2026-11-01 in US Pacific is 25 hours long, so +24h lands back on the 1st;
  // 2026-03-08 is 23 hours, so stepping back a day from the 9th overshoots to
  // the 7th. A spring-forward *forward* step would pass either way, which is
  // why it is not the case under test.
  const prev = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(addDays('2026-11-01', 1), '2026-11-02');
    assert.equal(addDays('2026-03-09', -1), '2026-03-08');
    assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  } finally {
    // delete, not assign: `process.env.TZ = undefined` stores the string
    // "undefined" and leaves every later test in a nonexistent zone.
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
});

test('daysBetween counts whole days and is signed', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);
  assert.equal(daysBetween('2026-01-08', '2026-01-01'), -7);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);   // common year
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);   // leap year
  assert.equal(daysBetween('2026-05-05', '2026-05-05'), 0);
});

test('weekdayOf returns 0 for Sunday through 6 for Saturday', () => {
  assert.equal(weekdayOf('2026-10-11'), 0); // Sunday
  assert.equal(weekdayOf('2026-10-15'), 4); // Thursday
  assert.equal(weekdayOf('2026-10-17'), 6); // Saturday
});

test('makeCalendarDate zero-pads, so string order is date order', () => {
  assert.equal(makeCalendarDate(2026, 1, 5), '2026-01-05');
  assert.ok(makeCalendarDate(2026, 9, 30) < makeCalendarDate(2026, 10, 1));
});

test('the year is padded too, so a year under 1000 still sorts where it belongs', () => {
  assert.equal(makeCalendarDate(999, 5, 1), '0999-05-01');
  assert.equal(makeCalendarDate(1, 1, 1), '0001-01-01');
  // Unpadded this is "999-05-01", which sorts after "2026-01-01" because "9"
  // follows "2" — the same inversion that year 10000 causes at the other end.
  assert.ok(makeCalendarDate(999, 5, 1) < makeCalendarDate(2026, 1, 1));
});
```

Extend the import at the top of `src/lib/dates.test.ts` to include `addDays`, `daysBetween`, `weekdayOf` and `makeCalendarDate`.

- [ ] **Step 4: Run them and watch them fail**

Run: `npm test`
Expected: FAIL — `SyntaxError: The requested module './dates.ts' does not provide an export named 'addDays'`.

- [ ] **Step 5: Add the date helpers**

In `src/lib/dates.ts`, rename the private `format` function to `makeCalendarDate` and export it, updating its five call sites inside that file (`todayIn` ×1, `monthRange` ×2, `yearRange` ×2):

```ts
/** Build a calendar date from its parts. Month is 1-based. Zero-padded, so
 *  string comparison on the result is chronological comparison. */
export function makeCalendarDate(year: number, month: number, day: number): CalendarDate {
  // The year is padded too, not just the month and day. Without it a year
  // under 1000 builds "999-05-01", which sorts *after* "2026-01-01" and
  // quietly breaks every comparison in this module — and toCalendarDate
  // accepts any four digits, so a date field holding 0202 reaches here.
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

Then append:

```ts
/**
 * `date` shifted by `n` whole days.
 *
 * Built in UTC and read back in UTC: UTC has no DST, so a day is always
 * 86,400,000ms and nothing can land on the wrong date. The same reason
 * daysInMonth is built that way.
 */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  const d = new Date(Date.UTC(yearOf(date), monthOf(date) - 1, dayOf(date) + n));
  return makeCalendarDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `a` to `b`. Negative when `b` is the earlier one. */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  const ms =
    Date.UTC(yearOf(b), monthOf(b) - 1, dayOf(b)) -
    Date.UTC(yearOf(a), monthOf(a) - 1, dayOf(a));
  return Math.round(ms / 86_400_000);
}

/** Day of week, 0 = Sunday through 6 = Saturday. */
export function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(yearOf(date), monthOf(date) - 1, dayOf(date))).getUTCDay();
}
```

- [ ] **Step 6: Run the date tests and see them pass**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 7: Write the failing tests for the schedule module**

Create `src/lib/subscriptionSchedule.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  occurrencesBetween,
  nextOccurrence,
  periodKeyOf,
  monthlyEquivalent,
  type Schedulable,
} from './subscriptionSchedule.ts';

const TODAY = '2026-10-15';

function sub(over: Partial<Schedulable> = {}): Schedulable {
  return { anchorDate: '2026-01-15', cycle: 'monthly', status: 'active', stoppedOn: null, ...over };
}

// ── Monthly, and the month-end clamp that makes a stored cursor impossible ──

test('a monthly anchor repeats on the same day each month', () => {
  const out = occurrencesBetween(sub(), '2026-01-01', '2026-04-30', TODAY);
  assert.deepEqual(out, ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
});

test('the 31st clamps in short months and comes straight back — the anchor is never rewritten', () => {
  const out = occurrencesBetween(sub({ anchorDate: '2026-01-31' }), '2026-01-01', '2026-05-31', TODAY);
  assert.deepEqual(out, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});

test('a leap February gets the 29th', () => {
  const out = occurrencesBetween(sub({ anchorDate: '2028-01-31' }), '2028-02-01', '2028-02-29', TODAY);
  assert.deepEqual(out, ['2028-02-29']);
});

test('a monthly series crosses the year boundary', () => {
  const out = occurrencesBetween(sub({ anchorDate: '2026-11-20' }), '2026-11-01', '2027-02-28', TODAY);
  assert.deepEqual(out, ['2026-11-20', '2026-12-20', '2027-01-20', '2027-02-20']);
});

test('a monthly subscription years into its life still lands on its own day', () => {
  // Every other monthly window opens in the anchor's own year or the next one,
  // where the month count in kStart barely matters. Two years on, getting it
  // wrong skips the first occurrences in the window.
  const out = occurrencesBetween(sub({ anchorDate: '2023-11-20' }), '2026-09-01', '2026-12-31', TODAY);
  assert.deepEqual(out, ['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20']);
});

// ── Yearly ──────────────────────────────────────────────────────────────────

test('a yearly anchor repeats once a year', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-03-09', cycle: 'yearly' }), '2026-01-01', '2029-12-31', TODAY);
  assert.deepEqual(out, ['2026-03-09', '2027-03-09', '2028-03-09', '2029-03-09']);
});

test('a February 29th yearly anchor bills on the 28th in common years', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2028-02-29', cycle: 'yearly' }), '2028-01-01', '2032-12-31', TODAY);
  assert.deepEqual(out, ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
});

// ── Weekly ──────────────────────────────────────────────────────────────────

test('a weekly anchor steps 7 days across month and year boundaries', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-12-20', cycle: 'weekly' }), '2026-12-20', '2027-01-17', TODAY);
  assert.deepEqual(out, ['2026-12-20', '2026-12-27', '2027-01-03', '2027-01-10', '2027-01-17']);
});

test('a weekly window that opens mid-cycle starts at the next occurrence, not the anchor', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-01-01', cycle: 'weekly' }), '2026-01-05', '2026-01-20', TODAY);
  assert.deepEqual(out, ['2026-01-08', '2026-01-15']);
});

test('a weekly window opening 2 days into the cycle does not emit the occurrence behind it', () => {
  // A 4-day remainder is the one case where rounding to nearest happens to
  // agree with rounding up. Remainders of 1 to 3 days are where ceil matters,
  // and getting it wrong emits a date from before the window opened.
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-01-01', cycle: 'weekly' }), '2026-01-03', '2026-01-20', TODAY);
  assert.deepEqual(out, ['2026-01-08', '2026-01-15']);
});

test('a far-future weekly anchor terminates instead of running away', () => {
  // The string compare this loop used to end on is false past year 9999:
  // "10000-01-07" <= "9999-12-31" sorts true. The old loop produced 4.7
  // million dates here; the window holds three.
  const out = occurrencesBetween(
    sub({ anchorDate: '9999-12-16', cycle: 'weekly' }), '9999-12-01', '9999-12-31', TODAY);
  // Length first: should the loop ever run away again, deepEqual would spend
  // over a minute diffing millions of dates before saying so.
  assert.equal(out.length, 3);
  assert.deepEqual(out, ['9999-12-16', '9999-12-23', '9999-12-30']);
});

test('a weekly window with no occurrence in it yields nothing, not everything', () => {
  // kEnd below kStart has to mean an empty range, not an unbounded one. For the
  // loop's own bounds to be what answers, the window has to sit inside a gap:
  // 2026-01-01 is an occurrence and 2026-01-08 the next, so [01-02, 01-07] makes
  // kStart 1 and kEnd 0.
  assert.deepEqual(
    occurrencesBetween(sub({ anchorDate: '2026-01-01', cycle: 'weekly' }),
                       '2026-01-02', '2026-01-07', TODAY),
    []);
  // A window that closes before the anchor never reaches the loop: the early
  // return answers it. It is pinned here too, so neither route can drift.
  assert.deepEqual(
    occurrencesBetween(sub({ anchorDate: '2026-06-10', cycle: 'weekly' }),
                       '2026-01-01', '2026-05-31', TODAY),
    []);
});

test('a weekly subscription weeks into its life still lands on its own weekday', () => {
  // Every other weekly window opens within a week of the anchor, where the 7
  // in k cannot matter. Months in, a wrong divisor lands on a wrong weekday —
  // and 2026-01-01 is a Thursday, so these three are Thursdays too.
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-01-01', cycle: 'weekly' }), '2026-09-28', '2026-10-18', TODAY);
  assert.deepEqual(out, ['2026-10-01', '2026-10-08', '2026-10-15']);
});

// ── Window edges ────────────────────────────────────────────────────────────

test('a window opening before the anchor starts at the anchor, not before it', () => {
  const out = occurrencesBetween(sub({ anchorDate: '2026-06-10' }), '2026-01-01', '2026-08-31', TODAY);
  assert.deepEqual(out, ['2026-06-10', '2026-07-10', '2026-08-10']);
});

test('a window entirely before the anchor is empty', () => {
  assert.deepEqual(occurrencesBetween(sub({ anchorDate: '2026-06-10' }), '2026-01-01', '2026-05-31', TODAY), []);
});

test('both ends of the window are inclusive', () => {
  const out = occurrencesBetween(sub(), '2026-02-15', '2026-03-15', TODAY);
  assert.deepEqual(out, ['2026-02-15', '2026-03-15']);
});

// ── Status ──────────────────────────────────────────────────────────────────

test('an active subscription keeps going into the future', () => {
  const out = occurrencesBetween(sub({ anchorDate: '2026-10-05' }), '2026-10-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05']);
});

test('a paused subscription stops on the day it was paused', () => {
  // The whole point of storing the date: without it this runs to today and
  // keeps growing, inventing a charge for every month it stays paused.
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-05-05', status: 'paused', stoppedOn: '2026-07-20' }),
    '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-05-05', '2026-06-05', '2026-07-05']);
});

test('a paused row with no stop date falls back to today rather than running forever', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-08-05', status: 'paused' }), '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-08-05', '2026-09-05', '2026-10-05']);
});

test('an ended subscription stops at stopped_on', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-05-05', status: 'ended', stoppedOn: '2026-07-31' }),
    '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-05-05', '2026-06-05', '2026-07-05']);
});

test('an ended subscription with no stopped_on falls back to today rather than running forever', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-08-05', status: 'ended' }), '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-08-05', '2026-09-05', '2026-10-05']);
});

test('a paused subscription still stops at the end of a window that closes before today', () => {
  // Without this, `horizon` could ignore its window entirely and return the
  // status cut-off: every other status test asks for a range running past
  // today, so none of them would notice.
  const out = occurrencesBetween(
    sub({ status: 'paused' }), '2026-01-01', '2026-03-31', TODAY);
  assert.deepEqual(out, ['2026-01-15', '2026-02-15', '2026-03-15']);
});

test('an ended subscription still stops at the end of a window that closes before stopped_on', () => {
  const out = occurrencesBetween(
    sub({ status: 'ended', stoppedOn: '2026-09-30' }), '2026-01-01', '2026-03-31', TODAY);
  assert.deepEqual(out, ['2026-01-15', '2026-02-15', '2026-03-15']);
});

test('the stop date is inclusive — a charge due on the day it stopped still counts', () => {
  // Make the bound exclusive and 07-15 disappears with nothing else noticing.
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-06-15', status: 'ended', stoppedOn: '2026-07-15' }),
    '2026-01-01', '2026-12-31', TODAY);
  assert.deepEqual(out, ['2026-06-15', '2026-07-15']);
});

// ── Period keys: what makes a moved billing day safe ────────────────────────

test('a period key is the month for monthly, the year for yearly, the date for weekly', () => {
  assert.equal(periodKeyOf('monthly', '2026-02-15'), '2026-02');
  assert.equal(periodKeyOf('yearly',  '2026-02-15'), '2026');
  assert.equal(periodKeyOf('weekly',  '2026-02-15'), '2026-02-15');
});

test('moving a billing day inside the month leaves every period key unchanged', () => {
  // The scenario from the spec: the service moves billing from the 15th to the
  // 20th. Confirmations are matched by period key, so none of them is orphaned.
  const before = occurrencesBetween(sub({ anchorDate: '2026-01-15' }), '2026-01-01', '2026-06-30', TODAY);
  const after  = occurrencesBetween(sub({ anchorDate: '2026-01-20' }), '2026-01-01', '2026-06-30', TODAY);
  assert.deepEqual(
    after.map((d) => periodKeyOf('monthly', d)),
    before.map((d) => periodKeyOf('monthly', d)),
  );
  assert.notDeepEqual(after, before); // the dates really did move
});

// ── nextOccurrence ──────────────────────────────────────────────────────────

test('nextOccurrence finds the first occurrence on or after the given date', () => {
  assert.equal(nextOccurrence(sub({ anchorDate: '2026-01-20' }), '2026-10-15', TODAY), '2026-10-20');
});

test('an occurrence falling exactly on the given date is the next one — nothing says it is paid', () => {
  assert.equal(nextOccurrence(sub({ anchorDate: '2026-01-15' }), '2026-10-15', TODAY), '2026-10-15');
});

test('nextOccurrence returns the anchor itself when the series has not started', () => {
  assert.equal(nextOccurrence(sub({ anchorDate: '2029-07-04' }), TODAY, TODAY), '2029-07-04');
});

test('nextOccurrence on a yearly subscription reaches across the whole year', () => {
  assert.equal(
    nextOccurrence(sub({ anchorDate: '2026-01-10', cycle: 'yearly' }), '2026-02-01', TODAY),
    '2027-01-10');
});

test('a yearly subscription years into its life still finds its next payment', () => {
  // Every other yearly test starts within a year of the anchor, where the
  // `/ step` in kStart cannot matter. Drop that divisor and this returns null
  // — "no next payment" for every yearly subscription over about 13 months old.
  assert.equal(
    nextOccurrence(sub({ anchorDate: '2023-06-01', cycle: 'yearly' }), '2026-10-15', TODAY),
    '2027-06-01');
});

test('a paused subscription has no next payment, though its past occurrences remain', () => {
  assert.equal(nextOccurrence(sub({ status: 'paused' }), TODAY, TODAY), null);
  assert.deepEqual(
    occurrencesBetween(sub({ status: 'paused' }), '2026-09-01', '2026-12-31', TODAY),
    ['2026-09-15', '2026-10-15'],
  );
});

test('an ended subscription has no next payment either', () => {
  assert.equal(
    nextOccurrence(sub({ status: 'ended', stoppedOn: '2026-09-30' }), TODAY, TODAY), null);
});

// ── Normalisation ───────────────────────────────────────────────────────────

test('a monthly amount normalises to itself', () => {
  assert.equal(monthlyEquivalent(15.99, 'monthly'), 15.99);
});

test('a yearly amount normalises to a twelfth', () => {
  assert.equal(monthlyEquivalent(120, 'yearly'), 10);
});

test('a weekly amount normalises by the average month, not by four weeks', () => {
  // 365.25 / 7 / 12 = 4.348214…, so $10/week is $43.48/month, not $40.
  assert.ok(Math.abs(monthlyEquivalent(10, 'weekly') - 43.48) < 0.01);
});
```

- [ ] **Step 8: Run them and watch them fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './subscriptionSchedule.ts'`.

- [ ] **Step 9: Write the schedule module**

Create `src/lib/subscriptionSchedule.ts`:

```ts
/**
 * When a subscription bills.
 *
 * Every occurrence is derived from one stored anchor and nothing else. There
 * is deliberately no `next_billing_date` column: a stored cursor drifts. A
 * subscription billed on the 31st, advanced into February, lands on the 28th —
 * and every later month inherits the 28th, because the cursor is now the only
 * record of the intent. Deriving from the anchor makes that impossible.
 *
 * Relative imports with a .ts extension, not the @/ alias: `node --test` does
 * not read tsconfig paths, and this module has to be testable.
 */
import {
  addDays,
  daysBetween,
  daysInMonth,
  dayOf,
  makeCalendarDate,
  monthOf,
  yearOf,
  type CalendarDate,
} from './dates.ts';

export type SubscriptionCycle = 'weekly' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'ended';

export const SUBSCRIPTION_CYCLES: SubscriptionCycle[] = ['weekly', 'monthly', 'yearly'];
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active', 'paused', 'ended'];

/** The parts of a subscription this module needs. Keeps it free of the DB row. */
export interface Schedulable {
  anchorDate: CalendarDate;
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  stoppedOn: CalendarDate | null;
}

/** Where the series stops, given its status. `today` is the user's today. */
function horizon(sub: Schedulable, to: CalendarDate, today: CalendarDate): CalendarDate {
  if (sub.status === 'active') return to;
  // Paused and ended ask the same question — when did this stop billing — so
  // they share one date and one branch.
  //
  // Clamping a paused subscription at `today` instead would grow phantom
  // occurrences for as long as it stayed paused: pause on 20 October, and by
  // December the 5th of November and the 5th of December are in the past,
  // unconfirmed, and entirely imaginary.
  //
  // Falling back to `today` covers a row that stopped before this column
  // existed; never `to`, which would run a stopped subscription forever.
  const stop = sub.stoppedOn ?? today;
  return stop < to ? stop : to;
}

/**
 * Every occurrence in [from, to], both ends inclusive.
 *
 * Dates are zero-padded strings, so `<` and `>` on them are chronological.
 */
export function occurrencesBetween(
  sub: Schedulable,
  from: CalendarDate,
  to: CalendarDate,
  today: CalendarDate,
): CalendarDate[] {
  const lo = from > sub.anchorDate ? from : sub.anchorDate;
  const hi = horizon(sub, to, today);
  if (hi < lo) return [];

  const out: CalendarDate[] = [];

  if (sub.cycle === 'weekly') {
    // Both bounds computed up front, as integers, the way the monthly and
    // yearly paths already do.
    //
    // The previous version looped while `addDays(anchor, 7k) <= hi`, which
    // leans on this module's one load-bearing assumption: that zero-padded
    // dates compare chronologically as strings. That assumption dies at year
    // 10000, where "10000-01-07" <= "9999-12-31" is true because "1" sorts
    // before "9". A loop ending on that compare runs to year 99990: anchored
    // in 9999 it built 4.7 million dates and 1.9GB, 1.65 seconds on every
    // page load, for five real occurrences.
    //
    // Integer bounds cannot run away regardless of what the strings do.
    const kStart = Math.max(0, Math.ceil(daysBetween(sub.anchorDate, lo) / 7));
    const kEnd = Math.floor(daysBetween(sub.anchorDate, hi) / 7);
    for (let k = kStart; k <= kEnd; k++) out.push(addDays(sub.anchorDate, 7 * k));
    return out;
  }

  const y0 = yearOf(sub.anchorDate);
  const m0 = monthOf(sub.anchorDate);
  const d0 = dayOf(sub.anchorDate);
  const step = sub.cycle === 'yearly' ? 12 : 1;

  const monthsToLo = (yearOf(lo) - y0) * 12 + (monthOf(lo) - m0);
  const monthsToHi = (yearOf(hi) - y0) * 12 + (monthOf(hi) - m0);
  // One period early: within lo's own period the clamped day may fall before
  // lo, and for a yearly cycle the period containing lo starts up to 11 months
  // before it. The range check below discards anything that is actually out.
  const kStart = Math.max(0, Math.floor(monthsToLo / step) - 1);
  const kEnd = Math.floor(monthsToHi / step);

  for (let k = kStart; k <= kEnd; k++) {
    const total = m0 - 1 + k * step;
    const y = y0 + Math.floor(total / 12);
    const m = (total % 12) + 1;
    // The clamp, and the whole reason the anchor is never rewritten: a 31st
    // subscription bills on the 28th in February and on the 31st again in March.
    const date = makeCalendarDate(y, m, Math.min(d0, daysInMonth(y, m)));
    if (date >= lo && date <= hi) out.push(date);
  }
  return out;
}

/**
 * The next payment expected on or after `from`, or null if none is.
 *
 * Only an active subscription expects a payment. A paused one keeps its past
 * occurrences — occurrencesBetween still returns them — but is owed nothing,
 * and an ended one is owed nothing at all.
 */
export function nextOccurrence(
  sub: Schedulable,
  from: CalendarDate,
  today: CalendarDate,
): CalendarDate | null {
  if (sub.status !== 'active') return null;
  // 400 days clears a yearly cycle with room for a leap day. An anchor further
  // out than that has not started, so it is its own next occurrence.
  const far = addDays(from, 400);
  const to = sub.anchorDate > far ? sub.anchorDate : far;
  return occurrencesBetween(sub, from, to, today)[0] ?? null;
}

/**
 * The key a payment is matched on.
 *
 * Matching by exact date would orphan every past confirmation the moment a
 * service moved its billing day. A monthly subscription has exactly one
 * occurrence per month and a yearly one exactly one per year, so the calendar
 * period is an unambiguous key and survives the move. A week has no calendar
 * period of its own, so weekly falls back to the date.
 */
export function periodKeyOf(cycle: SubscriptionCycle, date: CalendarDate): string {
  if (cycle === 'monthly') return date.slice(0, 7);
  if (cycle === 'yearly') return date.slice(0, 4);
  return date;
}

// The average month, not four weeks: 52 weeks a year is 12 four-week months
// plus four leftover weeks, which would understate a weekly cost by 8%.
const WEEKS_PER_MONTH = 365.25 / 7 / 12;

/** What this amount costs per month, normalised across cycles. A rate, not a
 *  forecast of any particular calendar month. */
export function monthlyEquivalent(amount: number, cycle: SubscriptionCycle): number {
  if (cycle === 'weekly') return amount * WEEKS_PER_MONTH;
  if (cycle === 'yearly') return amount / 12;
  return amount;
}
```

- [ ] **Step 10: Run the tests and see them pass**

Run: `npm test`
Expected: PASS — every file, including the new schedule assertions.

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `.next/dev/types` produces stale errors, stop the dev server and `rm -rf .next` first — this has bitten this project before.

- [ ] **Step 12: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/subscriptionSchedule.ts \
        src/lib/subscriptionSchedule.test.ts src/lib/ledger.ts \
        src/lib/accountCircles.ts package.json
git commit -m "Derive subscription occurrences from a single anchor

A stored next-billing cursor drifts: advance a 31st subscription through
February and it lands on the 28th, which every later month then inherits.
There is no cursor. Every occurrence is computed from the anchor, with the day
clamped to the month's length, so February borrows the 28th and March takes
the 31st straight back.

Payments match on a period key rather than an exact date — the month for
monthly, the year for yearly — which is what lets a service move its billing
day without orphaning everything already confirmed.

Also makes npm test work: two test files could never load, because node --test
does not read tsconfig paths and the modules they cover imported through @/."
```

---

### Task 2: The table and the link columns

One new table and two nullable columns. The link lives on the transaction because the transaction *is* the payment.

**Files:**
- Create: `supabase/migrations/0004_subscriptions.sql`
- Modify: `src/db/schema.ts`
- Modify: `src/app/actions/manage.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `subscriptions` table and `Subscription` / `NewSubscription` types from `@/db/schema`; `transactions.subscriptionId` (`string | null`) and `transactions.subscriptionPeriod` (`string | null`).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_subscriptions.sql`:

```sql
-- Subscriptions: what renews, and when.
--
-- A subscription is an expectation; a transaction is a fact. Nothing in this
-- table is ever summed into a spending figure. The money appears in
-- `transactions` when it is actually spent, exactly as it always has.
--
-- There is no next_billing_date. Every occurrence is derived from anchor_date
-- by src/lib/subscriptionSchedule.ts, because a stored cursor drifts: advance
-- a 31st subscription through February and it lands on the 28th, which every
-- later month then inherits.

create table if not exists subscriptions (
  id                text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  emoji             text,
  amount            numeric(12,2) not null,
  cycle             text not null default 'monthly',   -- weekly | monthly | yearly
  anchor_date       date not null,                     -- first payment, not row creation
  status            text not null default 'active',    -- active | paused | ended
  stopped_on        date,                              -- the day billing stopped, paused or ended
  category          text,                              -- a name from getAllCategories()
  payment_method_id text references payment_methods(id),
  website           text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Guarded: `create policy` has no IF NOT EXISTS, and this file runs as one
-- transaction, so an unguarded one aborts a re-run before anything after it.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'subscriptions'
       and policyname = 'own subscriptions'
  ) then
    create policy "own subscriptions" on subscriptions for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists subscriptions_user_idx on subscriptions (user_id);


-- The payment link. `on delete set null`, not cascade: deleting a subscription
-- must never delete a real expense — the money was still spent.
--
-- The foreign key is added separately, and guarded. An inline REFERENCES on an
-- ADD COLUMN IF NOT EXISTS is not covered by the IF NOT EXISTS: Postgres lifts
-- it into its own ADD CONSTRAINT subcommand during parse analysis, so a second
-- run skips the column and then adds transactions_subscription_id_fkey1 beside
-- the first. 0002 has the same latent bug.
alter table transactions
  add column if not exists subscription_id     text,
  add column if not exists subscription_period date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'transactions'::regclass
       and conname = 'transactions_subscription_id_fkey'
  ) then
    alter table transactions
      add constraint transactions_subscription_id_fkey
      foreign key (subscription_id) references subscriptions(id) on delete set null;
  end if;
end $$;

create index if not exists transactions_subscription_idx
  on transactions (subscription_id) where subscription_id is not null;
```

No CHECK constraints on `cycle` or `status`: `payment_methods.type` is typed as a drizzle enum with a plain `text` column behind it, and this follows that.

- [ ] **Step 2: Apply it — ALREADY DONE, do not run this again**

This ran once, on 2026-10-15, and the table and columns are live. It is recorded here so the migration's history is readable, not as a step to repeat: the standing constraint is that nothing writes to the database, and that includes re-applying an idempotent migration.

The guard added to `create policy` since then is for a fresh database or a restore, not for this one.

For the record, this is how it was applied. `DIRECT_URL`'s host no longer resolves; `DATABASE_URL` is the Supabase pooler and DDL runs fine over it.

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
import { readFileSync } from 'fs';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
await sql.unsafe(readFileSync('supabase/migrations/0004_subscriptions.sql','utf8')).simple();
await sql.end();
console.log('applied');
"
```

Expected: `applied`. (The Supabase Dashboard → SQL Editor works too, as migration 0002's header notes.)

- [ ] **Step 3: Verify the table, the policy and the columns**

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='subscriptions'\").simple());
console.table(await sql.unsafe(\"select policyname from pg_policies where tablename='subscriptions'\").simple());
console.table(await sql.unsafe(\"select column_name, data_type, is_nullable from information_schema.columns where table_name='transactions' and column_name like 'subscription%'\").simple());
await sql.end();
"
```

Expected: `subscriptions` with `rowsecurity: true`; policy `own subscriptions`; two columns, `subscription_id` (text, YES) and `subscription_period` (date, YES).

Then check what each foreign key does on delete, because the two differ on purpose:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select conrelid::regclass as tbl, conname, confdeltype from pg_constraint where contype='f' and (conrelid='subscriptions'::regclass or (conrelid='transactions'::regclass and conname like '%subscription%'))\").simple());
await sql.end();
"
```

Expected three rows: `transactions.subscription_id` is `n` (SET NULL), `subscriptions.payment_method_id` is `a` (NO ACTION), and `subscriptions.user_id` is `c` (CASCADE, so deleting the auth user takes their subscriptions).

That `a` is deliberate. `on delete set null` there would let an account be deleted out from under a subscription, silently clearing a field the user filled in. Step 6 guards it in application code instead, the way the account's transactions are already guarded.

RLS without a policy denies everything, and a policy without RLS enforces nothing. Both lines must appear.

- [ ] **Step 4: Add the drizzle table**

In `src/db/schema.ts`, insert this block directly after the `PaymentMethod` type export and before `export const transactions`, so the `transactions` reference below resolves to something already declared:

```ts
export const subscriptions = pgTable('subscriptions', {
  id:              text('id').primaryKey(),
  userId:          uuid('user_id').notNull(),
  name:            text('name').notNull(),
  emoji:           text('emoji'),
  amount:          numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  cycle:           text('cycle', { enum: ['weekly', 'monthly', 'yearly'] }).notNull().default('monthly'),
  // The billing anchor. Occurrences derive from it; it is never rewritten by
  // the passage of time, only by the user editing the first payment date.
  anchorDate:      date('anchor_date', { mode: 'string' }).notNull(),
  status:          text('status', { enum: ['active', 'paused', 'ended'] }).notNull().default('active'),
  stoppedOn:       date('stopped_on', { mode: 'string' }),
  category:        text('category'),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
  website:         text('website'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
```

Then add two fields to the existing `transactions` table, after `receiptUrl`:

```ts
  // Which subscription this payment settled, and which occurrence of it. The
  // link lives here because this row is the payment.
  subscriptionId:     text('subscription_id')
    .references(() => subscriptions.id, { onDelete: 'set null' }),
  subscriptionPeriod: date('subscription_period', { mode: 'string' }),
```

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean. The build is the real check — it proves the new table did not break drizzle's relational query inference for the existing ones.

- [ ] **Step 6: Stop an account being deleted out from under a subscription**

`deletePaymentMethod` hard-deletes an account that has no transactions. With the new foreign key that becomes a raw constraint error — an unhandled 500, since the function has no try/catch — the first time a subscription points at that account.

The function already has the right answer for this shape of problem one branch up: an account with transactions is archived instead of deleted. Give subscriptions the same treatment.

In `src/app/actions/manage.ts`, add `subscriptions` to the `@/db/schema` import, then replace `deletePaymentMethod` entirely:

```ts
export async function deletePaymentMethod(id: string) {
  // RLS does not apply on this path: the app connects as `postgres`, which has
  // rolbypassrls, so every query here scopes itself to the caller.
  const user = await getUser();

  const account = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)),
    columns: { id: true },
  });
  // Not the caller's account, or no such account: a silent no-op, as in
  // archivePaymentMethod.
  if (!account) return { success: true };

  // An account is archived rather than deleted when any row still references
  // it. Every foreign key to payment_methods is NO ACTION, so an unguarded
  // delete raises a raw constraint error — an unhandled 500, since there is no
  // try/catch here.
  const linked = await db.query.transactions.findFirst({
    where: eq(transactions.paymentMethodId, account.id),
    columns: { id: true },
  });
  if (linked) return archivePaymentMethod(id);

  // Archiving beats making the key `on delete set null`: the account stays
  // findable, and the subscription keeps the field the user filled in rather
  // than silently losing it.
  const subscribed = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.paymentMethodId, account.id),
    columns: { id: true },
  });
  if (subscribed) return archivePaymentMethod(id);

  const transferred = await db.query.transfers.findFirst({
    where: or(eq(transfers.fromAccountId, account.id), eq(transfers.toAccountId, account.id)),
    columns: { id: true },
  });
  if (transferred) return archivePaymentMethod(id);

  await db.delete(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)));
  revalidateAccounts();
  return { success: true };
}
```

`transfers` and `or` need adding to the imports — `transfers` from `@/db/schema`, `or` from `drizzle-orm`.

Three things changed beyond the subscriptions check, and all three are deliberate:

1. **Ownership scoping.** `deletePaymentMethod` took an id and deleted it, with no `getUser()` and no `userId` filter. RLS does not save it: `DATABASE_URL` connects as `postgres`, which has `rolbypassrls`, so RLS is defence in depth for the Supabase API and nothing at all for this path. `updatePaymentMethod` and `archivePaymentMethod` both scope correctly; this one did not.
2. **Transfers.** `transfers.from_account_id` and `transfers.to_account_id` reference `payment_methods` with NO ACTION too, and nothing checked them. An account with a transfer and no transactions already raised a raw constraint error before this branch existed. Guarding two of the three referencing tables and not the third would be arbitrary.
3. **Early return on a missing account.** The old code fell through to the delete when the lookup found nothing, which worked only because the delete then matched nothing either.

The `columns:` on every read is the project's standing rule, and the first two were missing it — a bare `findFirst` on `transactions` pulls every column of the row it finds.

- [ ] **Step 7: Read the guard against its own call graph**

Writing to the database is not available, so this guard cannot be exercised end to end here. Verify it the way you would verify a branch you cannot reach in a test:

1. `archivePaymentMethod` is defined in the same file and already returns the shape `deletePaymentMethod` returns. Confirm every archive branch returns it, not a bare `true`.
0. Ownership: confirm `getUser()` is called, and that `userId` appears in the `where` of both the lookup and the delete. This is the finding that matters most — without it any signed-in user could delete another user's account by id, and RLS does not stop it.
2. `subscriptions.paymentMethodId` is the column the new `findFirst` filters on, and it is the same column the foreign key is declared over. Confirm against `src/db/schema.ts`.
3. Nothing else in the codebase deletes from `payment_methods`: `grep -rn "delete(paymentMethods)" src/` must return exactly the one call site you just guarded. If it returns more, the guard is incomplete and that is a finding.
3b. Every table that references `payment_methods` is now checked. Confirm the list is complete, read-only:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select conrelid::regclass as referencing_table, conname, confdeltype from pg_constraint where confrelid='payment_methods'::regclass and contype='f'\").simple());
await sql.end();
"
```

Expected: `transactions`, `transfers` (twice) and `subscriptions`. Any row with `confdeltype` `a` must have a corresponding check in the function. If a table appears that the function does not check, that is a finding.
4. Read-only, confirm the constraint is the one the guard exists for:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select conname, confdeltype from pg_constraint where conrelid='subscriptions'::regclass and contype='f'\").simple());
await sql.end();
"
```

Expected: `subscriptions_payment_method_id_fkey` with `confdeltype` `a`. That `a` is why the guard has to exist.

Record in your report that the end-to-end path is **unverified**, with the one sentence a person would need to check it themselves: create an account with no transactions, point a subscription at it, delete the account in Settings, and expect it to archive rather than error.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0004_subscriptions.sql src/db/schema.ts src/app/actions/manage.ts
git commit -m "Add the subscriptions table and the payment link

The link is two nullable columns on transactions rather than a join table: the
transaction is the payment, so the relation belongs on it. on delete set null,
never cascade — deleting a subscription must leave the money that was actually
spent exactly where it is.

No next_billing_date column. anchor_date is the whole schedule."
```

---

### Task 3: Server actions

Every read names its columns. This project has already spent 6.5 GB of egress on queries that did not.

**Files:**
- Create: `src/app/actions/subscriptions.ts`
- Modify: `src/lib/utils.ts` and `src/lib/utils.test.ts` — `isSingleGrapheme`
- Modify: `src/app/actions/settings.ts` — `deleteAllData` must clear subscriptions too
- Modify: `src/app/settings/ExportButtons.tsx` — the confirm copy names what is deleted

**Interfaces:**
- Consumes: `occurrencesBetween`, `nextOccurrence`, `monthlyEquivalent`, `periodKeyOf`, `Schedulable`, `SubscriptionCycle`, `SubscriptionStatus` from `@/lib/subscriptionSchedule`; `subscriptions`, `paymentMethods` from `@/db/schema`.
- Produces:
  - `interface SubscriptionRow` — see code below
  - `interface UpcomingOccurrence { subscriptionId; name; emoji; cycle; amount; date; daysAway }`
  - `interface SubscriptionsView { today; subscriptions: (SubscriptionRow & { next: CalendarDate | null })[]; monthlyTotal; annualTotal; activeCount; upcoming: UpcomingOccurrence[] }`
  - `getSubscriptionsView(): Promise<SubscriptionsView>`
  - `getRecurringMonthlyTotal(): Promise<{ monthly: number; activeCount: number }>`
  - `getAccountOptions(): Promise<{ id: string; name: string; archived: boolean }[]>` — active accounts, plus any archived one a subscription still pays from
  - `saveSubscription(input: SaveSubscriptionInput): Promise<{ success: true; id: string } | { success: false; error: string }>`
  - `setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<{ success: boolean; error?: string }>`
  - `deleteSubscription(id: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write the actions file**

Create `src/app/actions/subscriptions.ts`:

```ts
'use server';

import { randomUUID } from 'crypto';
import { and, asc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, subscriptions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { daysBetween, safeTimeZone, toCalendarDate, todayIn, type CalendarDate } from '@/lib/dates';
import { isSingleGrapheme } from '@/lib/utils';
import {
  monthlyEquivalent,
  nextOccurrence,
  SUBSCRIPTION_CYCLES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionCycle,
  type SubscriptionStatus,
} from '@/lib/subscriptionSchedule';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

// Drizzle returns Postgres `numeric` as a string at runtime despite .$type<number>().
// Same guard the accounts actions use.
function toNum(v: unknown, field?: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    console.error(`[subscriptions] non-numeric value for ${field ?? '?'}:`, v);
    return 0;
  }
  return n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Report a failed write.
 *
 * Drizzle puts the entire failed statement in its error message, and these
 * strings go straight into a toast. The real error belongs in the server log;
 * the user gets something they can act on, named for what they were doing.
 */
function failed(op: string, error: unknown, message: string) {
  console.error(`[subscriptions] ${op} failed:`, error);
  return { success: false as const, error: message };
}

// Named columns, always. notes and website are included because the edit form
// needs them and the rows are few; created_at and updated_at are not, because
// nothing renders them.
const SUB_COLUMNS = {
  id: true, name: true, emoji: true, amount: true, cycle: true,
  anchorDate: true, status: true, stoppedOn: true, category: true,
  paymentMethodId: true, website: true, notes: true,
} as const;

export interface SubscriptionRow {
  id: string;
  name: string;
  emoji: string | null;
  amount: number;
  cycle: SubscriptionCycle;
  anchorDate: CalendarDate;
  status: SubscriptionStatus;
  stoppedOn: CalendarDate | null;
  category: string | null;
  paymentMethodId: string | null;
  website: string | null;
  notes: string | null;
}

export interface UpcomingOccurrence {
  subscriptionId: string;
  name: string;
  emoji: string | null;
  cycle: SubscriptionCycle;
  amount: number;
  date: CalendarDate;
  /** Negative is in the past. 0 is today. */
  daysAway: number;
}

export interface SubscriptionsView {
  today: CalendarDate;
  subscriptions: (SubscriptionRow & { next: CalendarDate | null })[];
  /** Normalised rate, not a forecast of any calendar month. Active only. */
  monthlyTotal: number;
  annualTotal: number;
  activeCount: number;
  upcoming: UpcomingOccurrence[];
}

async function loadRows(userId: string): Promise<SubscriptionRow[]> {
  const rows = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
    columns: SUB_COLUMNS,
    orderBy: [asc(subscriptions.name)],
  });
  return rows.map((r) => ({ ...r, amount: toNum(r.amount, 'amount') })) as SubscriptionRow[];
}

export async function getSubscriptionsView(): Promise<SubscriptionsView> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  const rows = await loadRows(user.id);
  const withNext = rows.map((s) => ({ ...s, next: nextOccurrence(s, today, today) }));

  // Paused and ended contribute nothing: you are not committed to them.
  const active = rows.filter((s) => s.status === 'active');
  const monthly = active.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0);

  const upcoming = withNext
    .filter((s): s is typeof s & { next: CalendarDate } => s.next !== null)
    .sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : 0))
    .slice(0, 3)
    .map((s) => ({
      subscriptionId: s.id,
      name: s.name,
      emoji: s.emoji,
      cycle: s.cycle,
      amount: s.amount,
      date: s.next,
      daysAway: daysBetween(today, s.next),
    }));

  return {
    today,
    subscriptions: withNext,
    monthlyTotal: round2(monthly),
    annualTotal: round2(monthly * 12),
    activeCount: active.length,
    upcoming,
  };
}

/**
 * Just the figure Overview's entry row shows. Two columns of the active rows —
 * Overview already runs four queries and this one must not be the expensive one.
 */
export async function getRecurringMonthlyTotal(): Promise<{ monthly: number; activeCount: number }> {
  const user = await getUser();
  const rows = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')),
    columns: { amount: true, cycle: true },
  });
  const monthly = rows.reduce((sum, r) => sum + monthlyEquivalent(toNum(r.amount, 'amount'), r.cycle), 0);
  return { monthly: round2(monthly), activeCount: rows.length };
}

/** id + name for the form's account picker. The existing listPaymentMethods
 *  selects every column, which this does not need. */
export async function getAccountOptions(): Promise<
  { id: string; name: string; archived: boolean }[]
> {
  const user = await getUser();
  // The core builder, not db.query: the relational API aliases the table as
  // "paymentMethods", which hides the name "payment_methods" — and the
  // correlated subquery below refers to the table by that name, so Postgres
  // rejects it (42P01, "invalid reference to FROM-clause entry").
  const rows = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name, archivedAt: paymentMethods.archivedAt })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.userId, user.id),
        or(
          isNull(paymentMethods.archivedAt),
          // An archived account that a subscription still pays from stays in the
          // picker. Deleting such an account archives it rather than removing
          // it, on the promise that it stays findable — and if the picker
          // dropped it, opening that subscription would show an empty "Pays
          // from" and clear the link on the next save.
          exists(
            db
              .select({ one: sql`1` })
              .from(subscriptions)
              .where(
                and(
                  eq(subscriptions.userId, user.id),
                  eq(subscriptions.paymentMethodId, paymentMethods.id),
                ),
              ),
          ),
        ),
      ),
    )
    .orderBy(asc(paymentMethods.name));
  return rows.map(({ id, name, archivedAt }) => ({ id, name, archived: archivedAt !== null }));
}

export interface SaveSubscriptionInput {
  /** Absent for a new subscription. */
  id?: string;
  name: string;
  amount: number;
  cycle: SubscriptionCycle;
  /** The first payment date. Re-anchors the whole series when edited. */
  anchorDate: string;
  emoji?: string | null;
  category?: string | null;
  paymentMethodId?: string | null;
  website?: string | null;
  notes?: string | null;
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function saveSubscription(
  input: SaveSubscriptionInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const user = await getUser();

  const name = input.name?.trim();
  if (!name) return { success: false, error: 'Name is required' };
  // Rounded first: the column holds two decimals, so 0.004 would pass this
  // check and then store as 0.00 — a subscription that costs nothing.
  if (!Number.isFinite(input.amount) || round2(input.amount) <= 0) {
    return { success: false, error: 'Amount must be greater than zero' };
  }
  if (!SUBSCRIPTION_CYCLES.includes(input.cycle)) {
    return { success: false, error: 'Pick a billing cycle' };
  }

  let anchorDate: CalendarDate;
  try {
    // Throws on 2026-02-30 rather than silently coercing it to March.
    anchorDate = toCalendarDate(input.anchorDate);
  } catch {
    return { success: false, error: 'Enter a valid first payment date' };
  }

  // numeric(12,2) tops out at 9,999,999,999.99. Past that Postgres rejects the
  // write with an overflow error the user can do nothing with, so catch it
  // here where there is something useful to say.
  if (input.amount > 9_999_999_999.99) {
    return { success: false, error: 'Amount is too large' };
  }

  const emoji = clean(input.emoji);
  if (emoji && !isSingleGrapheme(emoji)) {
    return { success: false, error: 'Use a single emoji' };
  }

  const paymentMethodId = clean(input.paymentMethodId);

  const values = {
    name,
    emoji,
    amount: input.amount,
    cycle: input.cycle,
    anchorDate,
    category: clean(input.category),
    paymentMethodId,
    website: clean(input.website),
    notes: clean(input.notes),
    updatedAt: new Date(),
  };

  try {
    // An account id arriving from the client is not evidence the caller owns
    // that account. RLS does not apply on this path, so the check is ours.
    //
    // Inside the try, because it is a database call: outside it, a connection
    // failure here would reject the action rather than return a result the
    // form can show, and the user would get a 500 instead of a message.
    if (paymentMethodId) {
      const [owned] = await db.query.paymentMethods.findMany({
        where: and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.userId, user.id)),
        columns: { id: true },
        limit: 1,
      });
      if (!owned) return { success: false, error: 'Account not found' };
    }

    if (input.id) {
      const res = await db
        .update(subscriptions)
        .set(values)
        .where(and(eq(subscriptions.id, input.id), eq(subscriptions.userId, user.id)))
        .returning({ id: subscriptions.id });
      if (res.length === 0) return { success: false, error: 'Subscription not found' };
      revalidate();
      return { success: true, id: input.id };
    }

    const id = randomUUID();
    await db.insert(subscriptions).values({ id, userId: user.id, ...values });
    revalidate();
    return { success: true, id };
  } catch (error) {
    return failed('saveSubscription', error, 'Could not save. Please try again.');
  }
}

export async function setSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  if (!SUBSCRIPTION_STATUSES.includes(status)) return { success: false, error: 'Unknown status' };

  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));
  try {
    const res = await db
      .update(subscriptions)
      // Pausing and ending both record the day billing stopped, which is what
      // keeps a paused subscription from accruing an imaginary charge for
      // every month it stays paused. Reactivating clears it, or the series
      // would go on stopping at the old date.
      //
      // coalesce, not a plain assignment: the *first* stop is the one that
      // counts. Pause in October and end in December, and re-stamping would
      // move the stop to December and bring November's charge back as an
      // unconfirmed past occurrence — exactly what the stop date is for.
      .set({
        status,
        stoppedOn: status === 'active'
          ? null
          : sql`coalesce(${subscriptions.stoppedOn}, ${today}::date)`,
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
      .returning({ id: subscriptions.id });
    if (res.length === 0) return { success: false, error: 'Subscription not found' };
    revalidate();
    return { success: true };
  } catch (error) {
    return failed('setSubscriptionStatus', error, 'Could not update. Please try again.');
  }
}

export async function deleteSubscription(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  try {
    // `on delete set null` on transactions.subscription_id: the expenses this
    // subscription was linked to survive untouched.
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)));
    revalidate();
    return { success: true };
  } catch (error) {
    return failed('deleteSubscription', error, 'Could not delete. Please try again.');
  }
}

function revalidate() {
  revalidatePath('/subscriptions');
  // Overview carries the phone's entry row, which shows the monthly figure.
  revalidatePath('/overview');
}
```

- [ ] **Step 2: Extract the grapheme check, and test it**

The emoji rule is the one piece of non-trivial logic in this file, it already shipped wrong once, and nothing in `npm test` would catch it going wrong again — a server action that calls `getUser()` cannot be unit-tested here. The predicate itself is pure, so lift it out.

Append to `src/lib/utils.ts`:

```ts
/**
 * True when `value` is exactly one character as a person sees it.
 *
 * Code points are the wrong unit and this is the bug worth remembering: 🧑‍💻
 * is three of them, 🏳️‍🌈 four, 👨‍👩‍👧 five, 1️⃣ three. Counting code points
 * rejects half the emoji keyboard while still accepting "ab". A grapheme
 * cluster is the unit being limited, and Intl.Segmenter is the only thing
 * that knows where they end.
 */
export function isSingleGrapheme(value: string): boolean {
  return [...new Intl.Segmenter().segment(value)].length === 1;
}

/** The first character of `value` as a person sees it, or '' if there is none.
 *  Same reason as above: `value[0]` and `Array.from(value)[0]` both return a
 *  fragment of a joined emoji or a letter stripped of its accent. */
export function firstGrapheme(value: string): string {
  // Drop leading combining marks and invisible format characters first. A
  // pasted name can start with either, and segmenting from there returns a
  // stray accent or a zero-width character — a circle with nothing in it.
  const start = value.replace(/^[\p{M}\p{Cf}\s]+/u, '');
  return [...new Intl.Segmenter().segment(start)][0]?.segment ?? '';
}

/**
 * Read a typed money amount, or NaN.
 *
 * `parseFloat` is the first trap: it stops at the first character it cannot
 * read, so "1,288.88" becomes 1 — valid, positive, past every guard, and
 * silently a thousand times too small. Since the app prints amounts with
 * thousands separators, typing one back in is the obvious thing to do.
 *
 * Stripping every comma is the second trap, and the worse one, because it
 * errs upward: "11,99" is how a good part of the world writes 11.99, and it
 * would read as 1199. So a comma is accepted only where a thousands
 * separator can legally go — groups of exactly three digits, before the
 * decimal point — and anything else returns NaN, which the callers reject.
 */
export function parseAmountInput(value: string): number {
  // Trim the ends and take a leading currency symbol; do NOT delete every
  // space and $ wherever they sit, which fuses "11 99" into 1199 and "1$2"
  // into 12 — the same hundredfold error, from the same instinct to be
  // forgiving about characters whose position is the whole meaning.
  const cleaned = value.trim().replace(/^\$\s*/, '');
  if (cleaned === '') return NaN;
  // [1-9], not \d: "0,500" is 0.5 to a decimal-comma reader, and read as
  // grouping it would be 500.
  // Two fraction digits, because that is what numeric(12,2) holds. Accepting
  // more means silently rounding what someone typed, and it is also how a
  // dot-grouped integer gets in: "1.288" is 1,288 in half of Europe and
  // would store as $1.29.
  const grouped = /^[1-9]\d{0,2}(,\d{3})+(\.\d{1,2})?$/.test(cleaned);
  const plain = /^\d*\.?\d{0,2}$/.test(cleaned);
  if (!grouped && !plain) return NaN;
  // Number, not parseFloat: "." and "" become NaN rather than quietly
  // succeeding at something.
  return Number(cleaned.replace(/,/g, ''));
}
```

Then append to `src/lib/utils.test.ts`, adding `isSingleGrapheme` to its import:

```ts
test('a joined emoji is one grapheme, however many code points it is made of', () => {
  // Each of these was rejected by the code-point rule this replaced. The
  // counts are what Array.from would have returned.
  for (const [emoji, codePoints] of [
    ['🧑‍💻', 3],   // zero-width joiner
    ['🏳️‍🌈', 4],   // flag + variation selector + ZWJ
    ['👨‍👩‍👧', 5],   // two joiners
    ['1️⃣', 3],   // keycap
    ['🏋️‍♀️', 5],   // gender sign, presentation selectors
    ['👍🏽', 2],   // skin-tone modifier
    ['🇯🇵', 2],   // regional indicator pair
  ] as const) {
    assert.equal(Array.from(emoji).length, codePoints, `${emoji} code points`);
    assert.equal(isSingleGrapheme(emoji), true, `${emoji} should be one grapheme`);
  }
});

test('two characters are two graphemes, emoji or not', () => {
  for (const two of ['🎬🎵', 'ab', '🧑‍💻🧑‍💻', '1️⃣2️⃣', 'a🎵']) {
    assert.equal(isSingleGrapheme(two), false, `${two} should not be one grapheme`);
  }
});

test('one grapheme means one, not one emoji — a letter passes', () => {
  // The rule limits how many, not what. The field is optional and labelled
  // Emoji; a letter there renders as a letter and harms nothing.
  assert.equal(isSingleGrapheme('a'), true);
  assert.equal(isSingleGrapheme('字'), true);
});

test('firstGrapheme returns a whole character, not a fragment of one', () => {
  assert.equal(firstGrapheme('🧑‍💻 Dev tools'), '🧑‍💻');
  assert.equal(firstGrapheme('網易云音樂'), '網');
  assert.equal(firstGrapheme('Spotify'), 'S');
  assert.equal(firstGrapheme(''), '');
  assert.equal(firstGrapheme('   '), '');
  // A pasted name can lead with a combining mark or a zero-width character.
  // Segmenting from there renders a stray accent, or nothing at all.
  assert.equal(firstGrapheme('\u0301abc'), 'a');
  assert.equal(firstGrapheme('\u200bSpotify'), 'S');
  // The failure this replaces: the first code point of a joined emoji renders
  // as a different emoji entirely.
  assert.notEqual(firstGrapheme('👨‍👩‍👧 Family plan'), Array.from('👨‍👩‍👧 Family plan')[0]);
});

test('parseAmountInput reads what a person types, including the separators we printed', () => {
  assert.equal(parseAmountInput('1288.88'), 1288.88);
  assert.equal(parseAmountInput('1,288.88'), 1288.88);
  assert.equal(parseAmountInput('$1,288.88'), 1288.88);
  assert.equal(parseAmountInput(' 11.99 '), 11.99);
  assert.equal(parseAmountInput('.5'), 0.5);
  assert.equal(parseAmountInput('7'), 7);
  // The bug: parseFloat('1,288.88') is 1 — positive, finite, and past every
  // guard the action has.
  assert.notEqual(parseAmountInput('1,288.88'), parseFloat('1,288.88'));
});

test('parseAmountInput refuses anything that is not a number', () => {
  for (const bad of ['', '   ', 'abc', '1.2.3', '1-2', '12px', '--5', '1e5', '.',
                     '11 99', '5 99', '1 2', '1$2', '1 288.88']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
});

test('a comma is only a thousands separator, never a decimal point', () => {
  // Stripping every comma errs upward, which is the dangerous direction:
  // "11,99" is 11.99 to much of the world and would have read as 1199.
  for (const bad of ['11,99', '1.288,88', '1,2,3', '1,23', '1,2345', ',99', '1,']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
  // Real grouping still reads.
  assert.equal(parseAmountInput('12,345.67'), 12345.67);
  assert.equal(parseAmountInput('1,234,567.89'), 1234567.89);
});

test('more fraction digits than the column holds are refused, not rounded', () => {
  // numeric(12,2) would store 11.999 as 12.00 without saying so. Refusing is
  // the honest answer, and it closes the last silent misread: "1.288" is
  // 1,288 to a dot-grouping reader and would otherwise store as $1.29.
  for (const bad of ['11.999', '1.288', '12.345', '100.000', '1,288.888']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
  // One or two, or none at all, still read.
  assert.equal(parseAmountInput('.5'), 0.5);
  assert.equal(parseAmountInput('11.9'), 11.9);
  assert.equal(parseAmountInput('11.99'), 11.99);
  assert.equal(parseAmountInput('5.'), 5);
});

test('a separator is read by where it sits, not deleted wherever it is found', () => {
  // Deleting every space and $ is the forgiving-looking choice, and it is the
  // same hundredfold-upward error as the comma one: "11 99" fused into 1199.
  for (const bad of ['11 99', '1$2', '1 2', '1 288.88']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
  // A leading symbol and surrounding space are still fine — that is what a
  // person pastes.
  assert.equal(parseAmountInput('$1,288.88'), 1288.88);
  assert.equal(parseAmountInput('$ 1,288.88'), 1288.88);
  assert.equal(parseAmountInput('  11.99  '), 11.99);
});

test('a thousands group never starts with zero', () => {
  // "0,500" is 0.5 to a decimal-comma reader. Read as grouping it would be 500,
  // and no number is written with a thousands separator after a leading zero.
  for (const bad of ['0,500', '0,001', '0,999', '00,100', '007,000', '000,000', '0,000.5']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
  // A leading group that is a real number still reads.
  assert.equal(parseAmountInput('1,000'), 1000);
  assert.equal(parseAmountInput('10,001'), 10001);
  assert.equal(parseAmountInput('100,001'), 100001);
});

test('an empty string is not one grapheme', () => {
  // The caller guards with `emoji &&`, but the predicate should not claim
  // that nothing is something.
  assert.equal(isSingleGrapheme(''), false);
});
```

Run `npm test`. Then, to prove the test can fail, temporarily put `Array.from(value).length === 1` in the function body: the first test must fail on 🧑‍💻. Put it back. Report both outputs.

- [ ] **Step 3: Put subscriptions into "delete all my data"**

`deleteAllData` clears transactions, transfers and custom categories. Without this line the one thing that survives a full wipe is the schedule of everything the user pays for — which is the single most personal list in the app.

In `src/app/actions/settings.ts`, add `subscriptions` to the `@/db/schema` import and one delete to the existing block:

```ts
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(transfers).where(eq(transfers.userId, user.id));
    await db.delete(customCategories).where(eq(customCategories.userId, user.id));
```

After transactions, deliberately: `transactions.subscription_id` is `on delete set null`, so either order works, but deleting the referencing rows first means the foreign key never has to fire at all.

Add `revalidatePath('/subscriptions')` beside the existing `revalidatePath('/')`.

While you are in that `catch`, give it the same treatment as the subscription actions. It currently returns `error.message`, and drizzle puts the entire failed statement in there — on a function whose failure message the user reads at the worst possible moment:

```ts
  } catch (error) {
    console.error('[settings] deleteAllData failed:', error);
    return { success: false, error: 'Could not delete your data. Please try again.' };
  }
```

Do not run it. This is one of the paths recorded as unverified — it needs a write, and the only honest test of it would destroy the user's data.

Check the user-facing copy while you are here: `ExportButtons.tsx` tells the user this clears "transactions and categories". It now clears subscriptions too, and the sentence should say so.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Prove the date mapping, read-only, from a column that already has rows**

The check that matters here is that a `date` column declared `{ mode: 'string' }` arrives as `"YYYY-MM-DD"` and never as a `Date`. Getting that wrong is what gave this project a day-early date bug across the whole app.

It has to go **through drizzle**, not through a raw `postgres()` client. The raw client parses a `date` column into a JS `Date`; it is drizzle's column mapper that hands back the string. A check that skips drizzle proves nothing and reports a bug that is not there.

`subscriptions` has no rows and this plan creates none, but `transactions.date` is declared exactly the same way and has real rows behind it:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './src/db/schema.ts';
const client = postgres(process.env.DATABASE_URL, { prepare: false, types: { numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => parseFloat(x) } } });
const db = drizzle(client, { schema });
const row = await db.query.transactions.findFirst({ columns: { date: true, amount: true } });
console.log('date  ', JSON.stringify(row.date), typeof row.date, row.date instanceof Date ? 'IS A DATE OBJECT — BUG' : 'is a string — correct');
console.log('amount', JSON.stringify(row.amount), typeof row.amount);
await client.end();
"
```

Expected: the date is a quoted `"YYYY-MM-DD"` string and **not** a `Date`.

The amount comes back a **string**, and that is correct, not a bug. `src/db/index.ts` configures the driver to parse `numeric` into a number, and then drizzle's own numeric mapper calls `String()` on it again. That round trip is the entire reason `toNum` exists in the actions, and why `.$type<number>()` is a type-level claim the runtime does not honour. If you ever see a number here, the mapper changed and `toNum` needs revisiting.

Then confirm, read-only, that the new table is still empty and this plan has added nothing to it:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select count(*) as subscriptions from subscriptions\").simple());
await sql.end();
"
```

Expected: `0`.

Record two things in your report as **unverified, because they need a write**: that `saveSubscription` round-trips a row, and that `setSubscriptionStatus`'s `coalesce` keeps the first stop date across a paused→ended transition. Note for each the one action a person would take to check it.

If `anchor_date` comes back as a `Date` or carries a time, the column type or the drizzle `mode: 'string'` is wrong — stop and fix it here. That exact mistake cost this project a day-early date bug across the whole app.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/subscriptions.ts src/app/actions/settings.ts \
        src/app/settings/ExportButtons.tsx src/lib/utils.ts src/lib/utils.test.ts
git commit -m "Add subscription server actions

Totals count active subscriptions only — a paused one is not a commitment.
They are labelled as a normalised rate everywhere they surface, never as spend.

getRecurringMonthlyTotal selects two columns, because Overview calls it on
every load and this feature is not going to be the one that costs egress."
```

---

### Task 4: The page — summary, upcoming, list

A working surface: what you pay, what is coming, and everything you have. No calendar, no form yet — subscriptions go in through SQL for this task's verification.

**Files:**
- Modify: `src/lib/subscriptionSchedule.ts`
- Modify: `src/lib/subscriptionSchedule.test.ts`
- Create: `src/components/SubscriptionMark.tsx`
- Create: `src/components/SubscriptionList.tsx`
- Create: `src/app/subscriptions/page.tsx`
- Create: `src/app/dev-preview/page.tsx` *(throwaway — deleted in Task 9)*

**Interfaces:**
- Consumes: `getSubscriptionsView`, `SubscriptionRow`, `SubscriptionsView` from `@/app/actions/subscriptions`; `daysBetween` from `@/lib/dates`.
- Produces:
  - `relativeDayLabel(days: number): string` from `@/lib/subscriptionSchedule`
  - `<SubscriptionMark name={string} emoji={string | null} size?={number} className?={string} />`
  - `type ListItem = SubscriptionRow & { next: string | null }` and `<SubscriptionList items={ListItem[]} today={string} />`, both from `@/components/SubscriptionList`

- [ ] **Step 1: Write the failing test for the relative label**

Append to `src/lib/subscriptionSchedule.test.ts`, adding `relativeDayLabel` and `occurrenceState` to its import:

```ts
test('a link confirms an occurrence; a date never does', () => {
  const T = '2026-10-15';
  // Linked, whatever the date says.
  assert.equal(occurrenceState(true, '2026-09-05', T), 'confirmed');
  assert.equal(occurrenceState(true, '2026-11-05', T), 'confirmed');
  // Unlinked and past: unconfirmed, never "paid" and never "missed".
  assert.equal(occurrenceState(false, '2026-09-05', T), 'unconfirmed');
  // Unlinked and future: upcoming.
  assert.equal(occurrenceState(false, '2026-11-05', T), 'upcoming');
  // Today is upcoming, not unconfirmed: the charge may not have landed.
  assert.equal(occurrenceState(false, T, T), 'upcoming');
  // And the day before today is not. Without this the rule could grant an
  // arbitrary grace period and no test would notice.
  assert.equal(occurrenceState(false, '2026-10-14', T), 'unconfirmed');
});

test('relative day labels read like a person would say them', () => {
  assert.equal(relativeDayLabel(0), 'today');
  assert.equal(relativeDayLabel(1), 'tomorrow');
  assert.equal(relativeDayLabel(-1), 'yesterday');
  assert.equal(relativeDayLabel(4), 'in 4 days');
  assert.equal(relativeDayLabel(-4), '4 days ago');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — no export named `relativeDayLabel`.

- [ ] **Step 3: Add it**

Append to `src/lib/subscriptionSchedule.ts`:

```ts
/** How many candidates the picker offers at once.
 *
 *  Here rather than beside the query that uses it: a "use server" file may
 *  export only async functions, and a plain const there fails the build
 *  while passing tsc and the tests. */
export const LINK_CANDIDATE_LIMIT = 25;

export type OccurrenceStateName = 'upcoming' | 'confirmed' | 'unconfirmed';

/**
 * What an occurrence's state is, given whether a payment is linked to it.
 *
 * The rule the whole feature rests on, in one place: a date is never
 * evidence. Only a link confirms. Today counts as upcoming, because a charge
 * dated today may simply not have landed yet, and calling it unconfirmed
 * would be an accusation rather than a fact.
 *
 * Three surfaces render this — the calendar, the history panel and the
 * preview harness — and the calendar's own comment already warns what
 * happens when two views of one payment disagree.
 */
export function occurrenceState(
  linked: boolean,
  date: CalendarDate,
  today: CalendarDate,
): OccurrenceStateName {
  if (linked) return 'confirmed';
  return date >= today ? 'upcoming' : 'unconfirmed';
}

/** "in 4 days" / "yesterday". Pairs with the absolute date, never replaces it:
 *  "in 4 days" alone is useless a week later on a screenshot. */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the identity mark**

Create `src/components/SubscriptionMark.tsx`:

```tsx
import { cn, firstGrapheme } from '@/lib/utils';

/**
 * A subscription's identity mark.
 *
 * There is no logo source in this project and the design system rules out a
 * palette of per-item colours, so: a sand circle with the first character of
 * the name. An emoji the user typed replaces it — that brings its own colour
 * without introducing a colour system, and the circle reads the same without one.
 */
export function SubscriptionMark({
  name,
  emoji,
  size = 36,
  className,
}: {
  name: string;
  emoji?: string | null;
  size?: number;
  className?: string;
}) {
  // By grapheme, not by code point: a name beginning with a joined emoji
  // would otherwise render as whichever emoji its first code point happens
  // to be, and an accented letter would lose its accent.
  const initial = firstGrapheme(name.trim()) || '?';
  const mark = emoji?.trim();
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 inline-flex items-center justify-center rounded-full bg-sand select-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {mark ? mark : <span className="font-bold uppercase text-ink">{initial}</span>}
    </span>
  );
}
```

- [ ] **Step 6: Write the list**

Create `src/components/SubscriptionList.tsx`. Filter and sort are local state, not URL params: they change nothing the server knows and a round-trip per click would be slower for no gain.

```tsx
'use client';

import { useState } from 'react';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { daysBetween } from '@/lib/dates';
import {
  relativeDayLabel,
  type SubscriptionCycle,
  type SubscriptionStatus,
} from '@/lib/subscriptionSchedule';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { SubscriptionRow } from '@/app/actions/subscriptions';

export type ListItem = SubscriptionRow & { next: string | null };

type Filter = 'all' | SubscriptionStatus;
type Sort = 'next' | 'high' | 'low' | 'name';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'next', label: 'Next payment' },
  { value: 'high', label: 'Amount, high first' },
  { value: 'low', label: 'Amount, low first' },
  { value: 'name', label: 'Name' },
];

// Monthly first because that is what most subscriptions are, so the list opens
// on the part you came to read.
const CYCLE_ORDER: SubscriptionCycle[] = ['monthly', 'yearly', 'weekly'];
const CYCLE_LABEL: Record<SubscriptionCycle, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  weekly: 'Weekly',
};
const CYCLE_SUFFIX: Record<SubscriptionCycle, string> = {
  monthly: '/mo',
  yearly: '/yr',
  weekly: '/wk',
};

export function SubscriptionList({ items, today }: { items: ListItem[]; today: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('next');

  const shown = items.filter((s) => filter === 'all' || s.status === filter);

  const sorted = [...shown].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'high') return b.amount - a.amount || a.name.localeCompare(b.name);
    if (sort === 'low') return a.amount - b.amount || a.name.localeCompare(b.name);
    // Next payment. A paused or ended subscription has none and goes last —
    // which is not where sorting a null as an empty string would put it.
    if (a.next === null && b.next === null) return a.name.localeCompare(b.name);
    if (a.next === null) return 1;
    if (b.next === null) return -1;
    if (a.next === b.next) return a.name.localeCompare(b.name);
    return a.next < b.next ? -1 : 1;
  });

  const groups = CYCLE_ORDER.map((cycle) => ({
    cycle,
    rows: sorted.filter((s) => s.cycle === cycle),
  })).filter((g) => g.rows.length > 0);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex items-center gap-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest transition-colors',
                filter === f.value ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Native select: already type-to-search and already correct on a
            phone. A custom menu would be more code and worse. */}
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto bg-transparent text-[10px] font-bold uppercase tracking-widest text-ink-faint cursor-pointer focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <p className="py-6 text-sm text-ink-faint">
          {filter === 'all' ? 'Nothing here yet.' : `No ${filter} subscriptions.`}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.cycle} className="pb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
            {CYCLE_LABEL[group.cycle]}
          </p>
          {group.rows.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3 border-t border-line">
              <SubscriptionMark name={s.name} emoji={s.emoji} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                  {s.status !== 'active' && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                      {s.status}
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {s.next
                    ? `${formatDate(s.next, { month: 'short', day: 'numeric' })} · ${relativeDayLabel(daysBetween(today, s.next))}`
                    : s.stoppedOn
                      ? `${s.status === 'ended' ? 'Ended' : 'Paused'} ${formatDate(s.stoppedOn, { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : s.status === 'ended'
                        ? 'Ended'
                        : 'Paused'}
                </span>
              </span>
              {/* shrink-0 on the amount, truncate on the name: the number is
                  never the thing that gets cut. */}
              <span className="shrink-0 text-right">
                <span className="block text-base font-bold tracking-tight tabular-nums text-ink">
                  {formatCurrency(s.amount)}
                </span>
                <span className="block text-[10px] text-ink-faint">{CYCLE_SUFFIX[s.cycle]}</span>
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Write the page**

Create `src/app/subscriptions/page.tsx`. Single column for now; Task 7 turns the wrapper into `d-split` and hangs the calendar in the panel.

```tsx
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { SubscriptionList } from '@/components/SubscriptionList';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { getSubscriptionsView } from '@/app/actions/subscriptions';
import { relativeDayLabel } from '@/lib/subscriptionSchedule';
import { formatCurrency, formatDate } from '@/lib/utils';

export default async function SubscriptionsPage() {
  const view = await getSubscriptionsView();

  return (
    <div className="d-max-lg max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      {view.subscriptions.length === 0 ? (
        <div className="pt-10 pb-16">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-6">Subscriptions</p>
          <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight">
            NOTHING<br />RECURRING.
          </p>
        </div>
      ) : (
        <>
          {/* ── What the standing commitment costs ── */}
          <section className="pt-3 pb-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Subscriptions</p>
            <ResponsiveAmount value={view.monthlyTotal} baseSize={68} minSize={28} className="mb-3" split />
            {/* "equivalent", not "spend": a yearly subscription contributes a
                twelfth here every month and its whole amount in the month it
                actually bills. Both are true; only one of them is spending. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink-faint">Monthly equivalent</span>
              <span className="text-line">·</span>
              <span className="text-ink-faint">
                Annual <span className="font-semibold text-ink tabular-nums">{formatCurrency(view.annualTotal)}</span>
              </span>
              <span className="text-line">·</span>
              <span className="text-ink-faint">
                <span className="font-semibold text-ink tabular-nums">{view.activeCount}</span> active
              </span>
            </div>
          </section>

          {/* ── What is coming ── */}
          {view.upcoming.length > 0 && (
            <section className="pb-6">
              <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Upcoming</p>
              {view.upcoming.map((o) => (
                <div
                  key={`${o.subscriptionId}-${o.date}`}
                  className="flex items-center gap-3 py-3 border-t border-line"
                >
                  <SubscriptionMark name={o.name} emoji={o.emoji} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {formatDate(o.date, { month: 'short', day: 'numeric' })} · {relativeDayLabel(o.daysAway)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                    {formatCurrency(o.amount)}
                  </span>
                </div>
              ))}
            </section>
          )}

          <SubscriptionList items={view.subscriptions} today={view.today} />
        </>
      )}

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 8: Create the throwaway preview harness**

The in-app browser is not signed in, so `/subscriptions` redirects it to `/login`. This renders the same components against fixtures, with no database and no auth.

Create `src/app/dev-preview/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { SubscriptionList, type ListItem } from '@/components/SubscriptionList';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { formatCurrency } from '@/lib/utils';

// A folder named with a leading underscore is private in Next.js and never
// routes at all — hence "dev-preview". Gated so it cannot ship.
const TODAY = '2026-10-15';

const ITEMS: ListItem[] = [
  { id: '1', name: 'Spotify', emoji: '🎵', amount: 11.99, cycle: 'monthly', anchorDate: '2026-01-15',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-15' },
  { id: '2', name: 'iCloud+ with a deliberately long product name', emoji: null, amount: 2.99,
    cycle: 'monthly', anchorDate: '2026-01-31', status: 'active', stoppedOn: null, category: 'Bills',
    paymentMethodId: null, website: null, notes: null, next: '2026-10-31' },
  { id: '3', name: '网易云音乐', emoji: null, amount: 1288.88, cycle: 'yearly', anchorDate: '2026-03-09',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2027-03-09' },
  { id: '4', name: 'Oatly delivery', emoji: '🥛', amount: 24.5, cycle: 'weekly', anchorDate: '2026-10-12',
    status: 'active', stoppedOn: null, category: 'Groceries', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-19' },
  { id: '5', name: 'Figma', emoji: null, amount: 15, cycle: 'monthly', anchorDate: '2026-02-01',
    status: 'paused', stoppedOn: null, category: 'Other', paymentMethodId: null, website: null,
    notes: null, next: null },
  { id: '6', name: 'Old gym', emoji: null, amount: 89, cycle: 'monthly', anchorDate: '2025-06-01',
    status: 'ended', stoppedOn: '2026-08-31', category: 'Health', paymentMethodId: null, website: null,
    notes: null, next: null },
];

export default function DevPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <div className="d-max-lg max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <section className="pt-3 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Subscriptions</p>
        {/* The four active fixtures: 11.99 + 2.99 + 1288.88/12 + 24.5 × (365.25/7/12). */}
        <ResponsiveAmount value={228.92} baseSize={68} minSize={28} className="mb-3" split />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-faint">Monthly equivalent</span>
          <span className="text-line">·</span>
          <span className="text-ink-faint">Annual <span className="font-semibold text-ink tabular-nums">{formatCurrency(2747.02)}</span></span>
          <span className="text-line">·</span>
          <span className="text-ink-faint"><span className="font-semibold text-ink tabular-nums">4</span> active</span>
        </div>
      </section>
      <div className="flex items-center gap-3 pb-6">
        <SubscriptionMark name="Spotify" emoji="🎵" size={36} />
        <SubscriptionMark name="网易云音乐" emoji={null} size={36} />
        <SubscriptionMark name="iCloud" emoji={null} size={36} />
      </div>
      <SubscriptionList items={ITEMS} today={TODAY} />
    </div>
  );
}
```

- [ ] **Step 9: Look at it**

Start the dev server with `preview_start { name: "moooney" }` and open `/dev-preview`. Check, in this order:

1. **1280 wide, light.** Groups read Monthly / Yearly / Weekly. The long iCloud name truncates; **no amount is ever cut** — `$1,288.88` shows in full.
2. **Each filter.** Active hides the paused and ended rows; Paused shows one; Ended shows one with its end date; a filter with no rows shows the empty line, not a blank gap.
3. **Each sort.** "Next payment" puts the two without one last. "Amount, high first" leads with 1288.88.
4. **375 wide** (`resize_window { preset: "mobile" }`). No horizontal scroll: confirm with `javascript_tool` → `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
5. **Dark** (`resize_window { colorScheme: "dark" }`). The sand circles stay distinguishable from the page. If a colour looks wrong immediately after switching, force a reflow before believing it — theme emulation plus `transition-colors` has produced a phantom bug on this project before.
6. **Console clean** — `read_console_messages { onlyErrors: true }`. React key warnings count as failures.

Fix anything found in the component source, not in the harness, and re-check.

- [ ] **Step 10: Check the real page in its empty state**

The database has no subscriptions and this plan adds none, so the real page renders its empty state — which is worth seeing, because it is what the user meets first.

Signed in, at `http://localhost:3000/subscriptions`: the NOTHING RECURRING. block, the small-caps page label, and nothing else. No stray zero, no `$0.00` hero, no empty Upcoming heading with nothing under it.

Everything with data in it was checked at Step 9 against the harness, whose fixtures cover more shapes than a seed would have: an emoji mark, a CJK name, a name long enough to truncate, all three cycles, and all three statuses.

Record in your report that the populated page is **verified against fixtures, not against live data**.

- [ ] **Step 11: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 12: Commit**

```bash
git add src/lib/subscriptionSchedule.ts src/lib/subscriptionSchedule.test.ts \
        src/components/SubscriptionMark.tsx src/components/SubscriptionList.tsx \
        src/app/subscriptions/page.tsx src/app/dev-preview/page.tsx
git commit -m "Add the subscriptions page

The hero figure is labelled monthly equivalent, not monthly spend. A yearly
subscription contributes a twelfth of itself here every month and its whole
amount in the month it bills; both are true, and only one of them is spending.

Filter and sort are local state — they change nothing the server knows, so a
round-trip per click would be slower for nothing.

dev-preview is a throwaway: the in-app browser is not signed in, so the real
page redirects it to /login. Gated by NODE_ENV and deleted in the last task."
```

---

### Task 5: Add, edit, pause, end, delete

One dialog does all of it. Follows `EditBalanceDialog`: controlled `open`, `DialogTrigger asChild`, `toast`, `router.refresh()`.

**Files:**
- Create: `src/components/SubscriptionDialog.tsx`
- Modify: `src/components/SubscriptionList.tsx`
- Modify: `src/app/subscriptions/page.tsx`
- Modify: `src/app/dev-preview/page.tsx`

**Interfaces:**
- Consumes: `saveSubscription`, `setSubscriptionStatus`, `deleteSubscription`, `getAccountOptions`, `SubscriptionRow` from `@/app/actions/subscriptions`; `getAllCategories` from `@/app/actions/manage`.
- Produces: `<SubscriptionDialog subscription?={SubscriptionRow} today={string} categories={string[]} accounts={{id,name,archived}[]}>{trigger}</SubscriptionDialog>`. `SubscriptionList` gains `today`, `categories` and `accounts` props and renders each row inside one.

- [ ] **Step 1: Write the dialog**

Create `src/components/SubscriptionDialog.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { unstable_rethrow } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  deleteSubscription, saveSubscription, setSubscriptionStatus,
  type SubscriptionRow,
} from '@/app/actions/subscriptions';
import type { SubscriptionCycle, SubscriptionStatus } from '@/lib/subscriptionSchedule';
import { cn, parseAmountInput } from '@/lib/utils';

// Radix refuses an empty string as a SelectItem value, so "none" needs a name.
const NONE = '__none__';

const CYCLE_OPTIONS: { value: SubscriptionCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

interface Props {
  /** Absent means this dialog adds a new subscription. */
  subscription?: SubscriptionRow;
  /** The user's today, for the first-payment default. */
  today: string;
  categories: string[];
  accounts: { id: string; name: string; archived: boolean }[];
  children: ReactNode;
}

export function SubscriptionDialog({ subscription, today, categories, accounts, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // The timestamp, not just a boolean: arming and confirming are the same
  // button in the same place, so a double-click would otherwise delete.
  const [armedDeleteAt, setArmedDeleteAt] = useState<number | null>(null);
  const [more, setMore] = useState(false);

  const [name, setName] = useState(subscription?.name ?? '');
  const [amount, setAmount] = useState(subscription ? subscription.amount.toFixed(2) : '');
  const [cycle, setCycle] = useState<SubscriptionCycle>(subscription?.cycle ?? 'monthly');
  const [anchorDate, setAnchorDate] = useState(subscription?.anchorDate ?? today);
  const [emoji, setEmoji] = useState(subscription?.emoji ?? '');
  const [category, setCategory] = useState(subscription?.category ?? NONE);
  const [accountId, setAccountId] = useState(subscription?.paymentMethodId ?? NONE);
  const [website, setWebsite] = useState(subscription?.website ?? '');
  const [notes, setNotes] = useState(subscription?.notes ?? '');

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setArmedDeleteAt(null);
      setMore(false);
    }
  }

  // try/finally on all three handlers: the actions catch database errors and
  // return { success: false }, but they cannot catch the request itself
  // failing — offline, or a stale bundle in this PWA calling an action from
  // an older deploy. Without the finally, `saving` stays true, every control
  // stays disabled behind a spinner, and reopening does not clear it.
  async function handleSave() {
    // Said before the action, because the action can only answer "greater
    // than zero" — which reads as nonsense to someone who typed 11,99. After
    // the name check, so an untouched form complains about its first field
    // rather than its second.
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (Number.isNaN(parseAmountInput(amount))) {
      toast.error('Enter the amount like 11.99 or 1,288.88');
      return;
    }
    setSaving(true);
    try {
      const res = await saveSubscription({
        id: subscription?.id,
        name,
        amount: parseAmountInput(amount),
        cycle,
        anchorDate,
        emoji,
        category: category === NONE ? null : category,
        paymentMethodId: accountId === NONE ? null : accountId,
        website,
        notes,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(subscription ? 'Saved' : 'Added');
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      // Next signals an internal redirect by rejecting the action promise, so
      // a signed-out session lands here on its way to /login. Rethrowing
      // first lets that through untouched; without it the user gets a
      // "could not reach the server" toast riding on top of the login page.
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(next: SubscriptionStatus) {
    if (!subscription || next === subscription.status) return;
    setSaving(true);
    try {
      const res = await setSubscriptionStatus(subscription.id, next);
      if (!res.success) {
        toast.error(res.error || 'Could not change status');
        return;
      }
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      // Next signals an internal redirect by rejecting the action promise, so
      // a signed-out session lands here on its way to /login. Rethrowing
      // first lets that through untouched; without it the user gets a
      // "could not reach the server" toast riding on top of the login page.
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!subscription) return;
    setSaving(true);
    try {
      const res = await deleteSubscription(subscription.id);
      if (!res.success) {
        toast.error(res.error || 'Could not delete');
        return;
      }
      toast.success('Deleted');
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      // Next signals an internal redirect by rejecting the action promise, so
      // a signed-out session lands here on its way to /login. Rethrowing
      // first lets that through untouched; without it the user gets a
      // "could not reach the server" toast riding on top of the login page.
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* Same shell as MonthPicker: centred on desktop, bottom sheet on a phone. */}
      <DialogContent
        className="
          border-0 p-6 gap-4 bg-paper-card max-h-[85vh] overflow-y-auto
          max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
          max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
          max-lg:translate-x-0 max-lg:translate-y-0
          lg:rounded-3xl lg:max-w-md
        "
      >
        <DialogTitle className="text-base font-bold tracking-tight">
          {subscription ? subscription.name : 'New subscription'}
        </DialogTitle>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Spotify" autoComplete="off" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-amount">Amount</Label>
              <Input id="sub-amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                     inputMode="decimal" placeholder="11.99" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-cycle">Billing cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as SubscriptionCycle)}>
                <SelectTrigger id="sub-cycle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sub-date">First payment date</Label>
            {/* Native date input — already correct on every platform, and it
                hands back exactly the "YYYY-MM-DD" the column wants. */}
            <Input id="sub-date" type="date" value={anchorDate}
                   onChange={(e) => setAnchorDate(e.target.value)} />
            <p className="text-[11px] text-ink-faint">
              {subscription
                ? 'This is the billing anchor. Changing it re-dates the whole series, past payments included.'
                : 'Every later payment is counted from here. A 31st falls back to the 28th in February and returns to the 31st in March.'}
            </p>
          </div>

          <button type="button" onClick={() => setMore((m) => !m)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors">
            <ChevronDown className={cn('h-3 w-3 transition-transform', more && 'rotate-180')} />
            {more ? 'Less' : 'More'}
          </button>

          {more && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-emoji">Emoji</Label>
                  {/* No maxLength: it counts UTF-16 units, and 🏋️‍♀️ is six of
                      them, so the cap would cut the sequence mid-joiner and
                      leave a mojibake fragment. The action validates by
                      grapheme instead. */}
                  <Input id="sub-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)}
                         placeholder="🎵" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="sub-category"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-account">Pays from</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="sub-account"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.archived ? `${a.name} (archived)` : a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-website">Website</Label>
                <Input id="sub-website" value={website} onChange={(e) => setWebsite(e.target.value)}
                       placeholder="spotify.com" autoComplete="off" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-notes">Notes</Label>
                <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
        </div>

        {subscription && (
          <div className="flex items-center gap-3 pt-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={saving}
                onClick={() => handleStatus(s.value)}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40',
                  subscription.status === s.value ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
                )}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (armedDeleteAt === null) {
                  setArmedDeleteAt(Date.now());
                } else if (Date.now() - armedDeleteAt > 400) {
                  handleDelete();
                }
              }}
              className="ml-auto text-[10px] font-bold uppercase tracking-widest text-accent hover:opacity-80 disabled:opacity-40"
            >
              {armedDeleteAt !== null ? 'Really delete?' : 'Delete'}
            </button>
          </div>
        )}

        {armedDeleteAt !== null && (
          <p className="text-[11px] text-ink-faint">
            The payments already recorded stay in History. Only the schedule goes.
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {subscription ? 'Save' : 'Add subscription'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Make the list rows open it**

In `src/components/SubscriptionList.tsx`:

Add to the imports:

```tsx
import { SubscriptionDialog } from '@/components/SubscriptionDialog';
```

Change the component's props to:

```tsx
export function SubscriptionList({
  items,
  today,
  categories,
  accounts,
}: {
  items: ListItem[];
  today: string;
  categories: string[];
  accounts: { id: string; name: string; archived: boolean }[];
}) {
```

Wrap each row. The row element changes from `<div key={s.id} className="flex …">` to:

```tsx
<SubscriptionDialog key={s.id} subscription={s} today={today} categories={categories} accounts={accounts}>
  <button type="button" className="w-full flex items-center gap-3 py-3 border-t border-line text-left hover:bg-sand/40 transition-colors">
    {/* …the existing row contents, unchanged… */}
  </button>
</SubscriptionDialog>
```

The `key` moves from the `div` to the `SubscriptionDialog`.

- [ ] **Step 3: Add the Add control to the page**

In `src/app/subscriptions/page.tsx`, add two imports and widen the existing actions import:

```tsx
import { Plus } from 'lucide-react';
import { SubscriptionDialog } from '@/components/SubscriptionDialog';
import { getAllCategories } from '@/app/actions/manage';
```

```tsx
// replaces: import { getSubscriptionsView } from '@/app/actions/subscriptions';
import { getAccountOptions, getSubscriptionsView } from '@/app/actions/subscriptions';
```

Fetch the three in parallel — serially they are three round-trips for no reason:

```tsx
  const [view, categories, accounts] = await Promise.all([
    getSubscriptionsView(),
    getAllCategories(),
    getAccountOptions(),
  ]);
```

Put the add control under the hero figures and in the empty state, both as:

```tsx
<SubscriptionDialog today={view.today} categories={categories} accounts={accounts}>
  <button type="button" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors">
    <Plus className="h-3 w-3" />
    Add subscription
  </button>
</SubscriptionDialog>
```

In the empty state put it where `/accounts` puts its "Add one" link — under the big NOTHING RECURRING. type. In the populated state put it in its own `<div className="pb-5">` between the hero section and Upcoming.

Pass the new props to the list:

```tsx
<SubscriptionList items={view.subscriptions} today={view.today} categories={categories} accounts={accounts} />
```

- [ ] **Step 4: Keep the harness compiling**

`src/app/dev-preview/page.tsx` now has to pass the two new props:

```tsx
      <SubscriptionList items={ITEMS} today={TODAY} categories={['Entertainment', 'Bills', 'Groceries', 'Health', 'Other']} accounts={[{ id: 'a1', name: 'Amex Gold', archived: false }, { id: 'a2', name: 'Chase Checking', archived: true }]} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Drive the form in the preview**

At `/dev-preview`, with the dev server running:

1. Click a row. The dialog opens with that subscription's values filled in, the title is its name, and the status row shows its current state in solid ink.
2. Click **More**. Emoji, Category, Pays from, Website, Notes appear.
3. Check the date hint. On an existing subscription it must say the anchor change re-dates the series — that is the single most surprising behaviour in this feature and the user asked for it specifically.
4. At 375 wide the dialog is a bottom sheet flush to the bottom edge; at 1280 it is centred. Long content scrolls inside it (`max-h-[85vh] overflow-y-auto`) rather than pushing the Save button off screen.
5. Dark mode: the inputs and the sheet are distinguishable from the page behind them.

Saving from the harness will fail — there is no session, and no session means no write. That is now the expected and the intended outcome.

- [ ] **Step 7: Check the save path by reading it, and write down what a person must try**

Nothing in this plan writes to the database, so the form cannot be driven end to end here. Three of its four risk areas can still be checked without a write.

**Validation, in the harness.** Most rejections in `saveSubscription` happen before any database call, so the messages are reachable by reading the function and matching them to what the form can produce. Two do not, and they are marked:

1. Empty name → `Name is required`, from the dialog, before any request. The action guards it too, with the same message and the same `trim()`; that copy is reachable only by a caller that is not this form.
2. Amount `0` → `Amount must be greater than zero`, from the action. Amount `-5`, `abc`, `1.2.3` or `11.999` → `Enter the amount like 11.99 or 1,288.88`, from the dialog, before any request goes out: all of them are NaN, `-5` included, since a minus sign is not part of the grammar. **`1,288.88` must save as 1288.88, not 1.00, and `11,99` must be rejected rather than saved as 1199** — the first is what `parseFloat` got wrong and the second is what stripping commas got wrong.
3. A cycle outside the three → `Pick a billing cycle`. Unreachable from the form's own `Select`, which is the point: it guards the action, not the widget.
4. Date `2026-02-30` → `toCalendarDate` throws and the action answers `Enter a valid first payment date`. Task 1 unit-tests that throw directly, so this is about the catch being there.
5. More than one emoji → `Use a single emoji`, counted with `Intl.Segmenter` so that 🧑‍💻 and 🏳️‍🌈 pass as the single characters a person sees them as, while `🎬🎵` and `ab` do not.
6. An amount of 10,000,000,000 or more → `Amount is too large`, before the write, because `numeric(12,2)` cannot hold it.
7. **After a database call:** an account id the caller does not own → `Account not found`. Editing a subscription that is not theirs → `Subscription not found`. Both are reachable only with a forged id, so there is nothing to click in the harness — read them instead and confirm each lookup filters on `user.id`.

**State transitions, by reading.** Confirm in `setSubscriptionStatus` that `active` nulls `stoppedOn`, that the other two use `coalesce(stopped_on, today)` so the first stop wins, and that the `where` filters on `userId` as well as `id`.

**Double submission, in the harness.** Not with a signed-out Save — that now redirects to `/login` with no toast at all, because `unstable_rethrow` lets the redirect through. Use a forced transport failure instead (DevTools offline, or rejecting the request): the button must disable for the duration and re-enable when the "Could not reach the server" toast appears, so a second click cannot fire a second save.

**Write this into your report as the user's checklist** — the part that genuinely needs a write, in the order it should be tried:

- Add one: `Spotify`, `11.99`, Monthly, first payment `2026-01-31`. Expect it under Monthly, next payment on the 31st of the coming month — or the 28th or 30th where that month is short. That clamp is the feature; the month it lands in is the thing to look at.
- Give it a joined emoji — 🧑‍💻 or 🏳️‍🌈 — and save. Reopen it. The mark shows the whole emoji and the form shows the same one, not a fragment. This is the one part of the grapheme rule that needs a real write: everything up to the insert is unit-tested, and what happens to the bytes afterwards is not.
- Edit the amount to `13.99`: the hero monthly equivalent moves by exactly $2.00.
- Pause it: it leaves the active count, the hero drops, the row reads PAUSED with no next date, and it shows the date it was paused.
- Activate it: everything comes back and the pause date clears.
- End it, then delete it: one click for "Really delete?", a second to delete.

- [ ] **Step 8: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/SubscriptionDialog.tsx src/components/SubscriptionList.tsx \
        src/app/subscriptions/page.tsx src/app/dev-preview/page.tsx
git commit -m "Add the subscription form

One dialog for add, edit, status and delete — the fields a person changes and
the decisions they make about a subscription are the same surface.

The date field says plainly that it is the billing anchor and that moving it
re-dates the series. A service changing its billing day is the case this has
to handle, and silently rewriting the past would be worse than saying so.

Delete says the recorded payments stay in History, because they do: the
foreign key is on delete set null."
```

---

### Task 6: Navigation

Desktop gets a sidebar entry. The phone gets a labelled row on Overview — the bottom-nav pill stays at four tabs.

**Files:**
- Modify: `src/components/DesktopSidebar.tsx`
- Modify: `src/app/overview/page.tsx`
- Modify: `src/components/OverviewClient.tsx`

**Interfaces:**
- Consumes: `getRecurringMonthlyTotal` from `@/app/actions/subscriptions`.
- Produces: `OverviewClientProps` gains `recurring: { monthly: number; activeCount: number }`.

- [ ] **Step 1: Add the sidebar entry**

In `src/components/DesktopSidebar.tsx`, add `Repeat` to the lucide import and a fifth `NAV` entry after History:

```tsx
import { BarChart3, Home, ListFilter, Plus, Repeat, Settings, Wallet } from 'lucide-react';

const NAV = [
  { href: '/',              icon: Home,       label: 'Home',          match: (p: string) => p === '/' },
  { href: '/overview',      icon: BarChart3,  label: 'Overview',      match: (p: string) => p.startsWith('/overview') },
  { href: '/accounts',      icon: Wallet,     label: 'Accounts',      match: (p: string) => p.startsWith('/accounts') },
  { href: '/history',       icon: ListFilter, label: 'History',       match: (p: string) => p.startsWith('/history') },
  { href: '/subscriptions', icon: Repeat,     label: 'Subscriptions', match: (p: string) => p.startsWith('/subscriptions') },
];
```

Appended rather than slotted beside Overview: the four existing entries keep the position muscle memory already has. `BottomNav.tsx` is not touched — four tabs is the decision, not an accident.

- [ ] **Step 2: Fetch the figure on Overview**

In `src/app/overview/page.tsx`, add the import and a fifth promise:

```tsx
import { getRecurringMonthlyTotal } from '@/app/actions/subscriptions';
```

```tsx
  const [data, { year: currentYear, month: currentMonth }, trend, detail, recurring] = await Promise.all([
    getOverviewData(period, { month: params.month, year: params.year }),
    getCurrentPeriod(),
    getTrailingTrend(12),
    category
      ? getCategoryDetail(category, period, { month: params.month, year: params.year })
      : Promise.resolve(null),
    // Two columns of the active rows. Desktop never renders the row this
    // feeds, but the server cannot know the viewport and the query is tiny.
    getRecurringMonthlyTotal(),
  ]);
```

and pass it down:

```tsx
<OverviewClient data={data} period={period} currentYear={currentYear} currentMonth={currentMonth} trend={trend} detail={detail} recurring={recurring} />
```

- [ ] **Step 3: Add the row**

In `src/components/OverviewClient.tsx`:

`Link` and `formatCurrency` are already imported there. The file imports nothing from lucide yet, so add a line:

```tsx
import { ChevronRight } from 'lucide-react';
```

Extend the props interface and the destructuring:

```tsx
interface OverviewClientProps {
  data: OverviewData;
  period: OverviewPeriod;
  currentYear: number;
  currentMonth: number;
  trend: Awaited<ReturnType<typeof getTrailingTrend>>;
  detail: Awaited<ReturnType<typeof getCategoryDetail>> | null;
  recurring: { monthly: number; activeCount: number };
}
```

```tsx
export function OverviewClient({ data, period, currentYear, currentMonth, trend, detail, recurring }: OverviewClientProps) {
```

Then, immediately after the closing `</section>` of the hero block (the one ending with the net-worth span) and before `<div className="d-split">`, insert:

```tsx
      {/* The phone's way into Subscriptions. The bottom-nav pill is full at
          four tabs — it measures 299px and clears a 320px screen by 10px — so
          a fifth tab would mean dropping the labels, and Overview against
          Subscriptions as bare icons is a guess every time. A labelled row
          with a real figure beats Settings' unlabelled header icon.

          This figure is a rate, not this period's spending. It is summed into
          nothing above it, and it reads the same whichever month is showing,
          which is why there is no period condition here. */}
      <div className="d-mobile-only">
        <Link
          href="/subscriptions"
          className="flex items-center justify-between gap-3 py-3.5 border-t border-line active:bg-sand/40 transition-colors"
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Recurring</span>
          <span className="flex items-center gap-1.5 shrink-0 text-sm">
            {recurring.activeCount > 0 ? (
              <>
                <span className="font-semibold text-ink tabular-nums">{formatCurrency(recurring.monthly)}</span>
                <span className="text-xs text-ink-faint">monthly equivalent</span>
              </>
            ) : (
              <span className="text-xs text-ink-faint">Track what renews</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
          </span>
        </Link>
      </div>
```

The wrapper `<div>` carries `d-mobile-only` and the `<Link>` inside carries `flex`. Putting both on one element gambles on which of `display:flex` and `display:none` wins; `/accounts` and `/overview` already wrap for this reason.

With no subscriptions the row still appears, reading "Track what renews" — otherwise a phone would have no way to reach the page and create the first one.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If it complains that `OverviewClient` is missing `recurring`, the page in Step 2 was not updated.

- [ ] **Step 5: Verify both navigations**

With the dev server running and signed in:

1. **1280 wide.** The sidebar shows five entries plus Settings at the foot. `/subscriptions` highlights Subscriptions and nothing else. Visiting `/overview` highlights only Overview.
2. The Recurring row is **absent** at 1280 — the sidebar is the desktop route in.
3. **375 wide** on `/overview`. The row is there, under the income/net line, above the trend strip. Tapping it lands on `/subscriptions`.
4. **The bottom nav still has four tabs** and still fits. At exactly 320px wide, confirm no horizontal scroll: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
5. With zero subscriptions the row reads "Track what renews" and still navigates.
6. Navigate between months on Overview. The row's figure does not change — it is a rate. If it does, something is scoping it to the period and that is a bug.

- [ ] **Step 6: Lint, build, commit**

Run: `npm run lint && npm run build`

```bash
git add src/components/DesktopSidebar.tsx src/app/overview/page.tsx src/components/OverviewClient.tsx
git commit -m "Reach Subscriptions from the sidebar and from Overview

The bottom-nav pill stays at four tabs: it is 299px wide and clears a 320px
screen by 10px, so a fifth fits only by dropping the labels — and Overview
against Subscriptions as unlabelled icons is a guess every time.

The phone gets a labelled row on Overview instead of Settings' icon in a
header corner. It carries the monthly equivalent, which is a rate and not
this month's spending, so it is identical on every period and summed into
nothing above it."
```

---

### Task 7: The calendar

A month of days with the charges marked on them. Desktop shows it beside the list; the phone toggles.

### Reaching the harness

Two obstacles, both discovered the hard way in Tasks 4-5, both with a settled answer.

**`src/proxy.ts` redirects `/dev-preview` to `/login`.** Its matcher is a catch-all that excludes only static assets, so the harness is unreachable without an exemption. Add `dev-preview` to the alternation:

```ts
export const config = {
  matcher: [
    // dev-preview is the fixture harness. It is deleted in the last task,
    // along with this exemption; the route also calls notFound() outside
    // development, so neither guard stands alone.
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|icons|splash|api|auth/callback|dev-preview).*)',
  ],
};
```

Commit it. Leaving it uncommitted means re-applying it in every later task and risking it in a `git clean`.

**The preview tool cannot start this worktree's dev server.** It reads `/Users/phoebesong/Desktop/moooney/.claude/launch.json`, which offers `moooney-dev` and `moooney-prod` — both of which run the *main checkout*, not this branch. The worktree's own `.claude/launch.json` is not the file it reads.

So start the server yourself in the background and point the browser at it:

```bash
npm run dev
```

Run that with `run_in_background`, wait for it to report ready, then open the pane with the preview tool's `url` form at `http://localhost:3000/dev-preview` rather than its `name` form. Stop the server when you are done and confirm the port is free. This is the one case where a shell dev server is right: the tool that would normally own it cannot reach this checkout.


**Files:**
- Modify: `src/app/actions/subscriptions.ts`
- Create: `src/components/SubscriptionCalendar.tsx`
- Modify: `src/app/subscriptions/page.tsx`
- Modify: `src/app/dev-preview/page.tsx`

**Interfaces:**
- Consumes: `occurrencesBetween`, `periodKeyOf` from `@/lib/subscriptionSchedule`; `monthRange`, `yearRange`, `makeCalendarDate`, `weekdayOf`, `daysInMonth` from `@/lib/dates`.
- Produces:
  - `interface DayOccurrence { subscriptionId; name; emoji; amount; cycle; date; state: 'upcoming' | 'confirmed' | 'unconfirmed'; paidAmount: number | null }`
  - `interface MonthOccurrences { monthKey; year; month; today; byDay: Record<string, DayOccurrence[]>; expected; remaining; isPastMonth }`
  - `getMonthOccurrences(monthKey?: string): Promise<MonthOccurrences>`
  - `<SubscriptionCalendar data={MonthOccurrences} preserveView={boolean} />`

- [ ] **Step 1: Add the month query**

Append to `src/app/actions/subscriptions.ts`, and extend its schema import to include `transactions`, and its dates import to include `monthRange` and `yearRange`:

```ts
export interface DayOccurrence {
  subscriptionId: string;
  name: string;
  emoji: string | null;
  amount: number;
  cycle: SubscriptionCycle;
  date: CalendarDate;
  /** Never inferred from the date alone. A past date is not a payment. */
  state: 'upcoming' | 'confirmed' | 'unconfirmed';
  /** What actually moved, when confirmed. Differs from `amount` after a price change. */
  paidAmount: number | null;
}

export interface MonthOccurrences {
  monthKey: string;
  year: number;
  /** 1-based. */
  month: number;
  today: CalendarDate;
  /** Keyed by full "YYYY-MM-DD". Days with nothing on them are absent. */
  byDay: Record<string, DayOccurrence[]>;
  expected: number;
  /** Still to pay between today and the end of the month: future occurrences
   *  with nothing linked. A charge already taken and linked is not remaining,
   *  whatever its date says. Meaningless for a past month. */
  remaining: number;
  isPastMonth: boolean;
}

export async function getMonthOccurrences(monthKey?: string): Promise<MonthOccurrences> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  // A month key off the URL is untrusted. monthRange(2026, 13) would happily
  // produce "2026-13-01", which is not a date.
  let year = Number(monthKey?.slice(0, 4));
  let month = Number(monthKey?.slice(5, 7));
  // Defence in depth, and the two halves guard different things. The lower
  // bound is not about string order — makeCalendarDate pads the year now. It
  // is partly Date.UTC, which reads years 0 to 99 as 1900 to 1999 so
  // "0050-01" would quietly become 1950, and partly that `key` below and
  // `shiftMonth` in the calendar both build "YYYY-MM" by hand without
  // padding, so a three-digit year yields a key its own shape check rejects.
  // The upper bound is about string order: past four digits it inverts.
  if (!/^\d{4}-\d{2}$/.test(monthKey ?? '') || !(month >= 1 && month <= 12)
      || !(year >= 1000 && year < 9999)) {
    year = Number(today.slice(0, 4));
    month = Number(today.slice(5, 7));
  }
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [first, last] = monthRange(year, month);

  const rows = await loadRows(user.id);

  // Links whose period could match something in this month. Four small
  // columns, bounded — not every link ever made.
  //
  // A yearly subscription matches by year, so its link can carry any date in
  // the year and still belong to this month's occurrence: edit the renewal
  // from March to May after March was paid, and a month-bounded query would
  // never see the March link, so May would read Unconfirmed here while Task
  // 8's history read Confirmed. Two views of one payment disagreeing is worse
  // than a slightly wider query.
  const hasYearly = rows.some((s) => s.cycle === 'yearly');
  const [linkFrom, linkTo] = hasYearly ? yearRange(year) : [first, last];

  const links = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      gte(transactions.subscriptionPeriod, linkFrom),
      lte(transactions.subscriptionPeriod, linkTo),
    ),
    columns: { id: true, amount: true, subscriptionId: true, subscriptionPeriod: true },
  });

  const paid = new Map<string, { id: string; amount: number }>();
  for (const l of links) {
    if (!l.subscriptionId || !l.subscriptionPeriod) continue;
    const cycle = rows.find((s) => s.id === l.subscriptionId)?.cycle;
    if (!cycle) continue;
    paid.set(`${l.subscriptionId}|${periodKeyOf(cycle, l.subscriptionPeriod)}`,
             { id: l.id, amount: toNum(l.amount, 'amount') });
  }

  const byDay: Record<string, DayOccurrence[]> = {};
  let expected = 0;
  let remaining = 0;

  for (const s of rows) {
    for (const date of occurrencesBetween(s, first, last, today)) {
      const hit = paid.get(`${s.id}|${periodKeyOf(s.cycle, date)}`);
      const state = occurrenceState(Boolean(hit), date, today);
      (byDay[date] ??= []).push({
        subscriptionId: s.id,
        name: s.name,
        emoji: s.emoji,
        amount: s.amount,
        cycle: s.cycle,
        date,
        state,
        paidAmount: hit ? hit.amount : null,
      });
      expected += s.amount;
      // Not merely still to come — still to *pay*. A charge dated the 19th
      // that was taken on the 14th and linked is confirmed, and counting it
      // as remaining would overstate what the rest of the month costs.
      //
      // Asked of occurrenceState rather than spelled out again: `date >=
      // today && !hit` is the same boundary in different words, sitting two
      // lines from the call, and if the rule ever moves they would disagree.
      if (state === 'upcoming') remaining += s.amount;
    }
  }

  return {
    monthKey: key,
    year,
    month,
    today,
    byDay,
    expected: round2(expected),
    remaining: round2(remaining),
    isPastMonth: last < today,
  };
}
```

The drizzle import becomes `import { and, asc, eq, exists, gte, isNull, lte, or, sql } from 'drizzle-orm';` — `gte` and `lte` are new here, and `exists` and `or` must stay, because `getAccountOptions` uses them. `desc` is not added yet; Task 8 is its first caller.

The schedule import at the top of the file becomes:

```ts
import {
  LINK_CANDIDATE_LIMIT,
  monthlyEquivalent,
  nextOccurrence,
  occurrencesBetween,
  occurrenceState,
  periodKeyOf,
  SUBSCRIPTION_CYCLES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionCycle,
  type SubscriptionStatus,
} from '@/lib/subscriptionSchedule';
```

- [ ] **Step 2: Write the calendar**

Create `src/components/SubscriptionCalendar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { daysInMonth, makeCalendarDate, weekdayOf } from '@/lib/dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { MonthOccurrences } from '@/app/actions/subscriptions';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

/** The month `delta` away, as "YYYY-MM". Month is 1-based. */
function shiftMonth(year: number, month: number, delta: number): string {
  const t = year * 12 + (month - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function SubscriptionCalendar({
  data,
  preserveView,
}: {
  data: MonthOccurrences;
  /** True on the phone's calendar tab, so month navigation stays on it. */
  preserveView: boolean;
}) {
  // The day and the open flag are separate on purpose. Keyed off one value,
  // closing the sheet empties it instantly and you watch a blank panel run
  // through its 200ms exit animation.
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const href = (monthKey: string) =>
    preserveView
      ? `/subscriptions?view=calendar&month=${monthKey}`
      : `/subscriptions?month=${monthKey}`;

  const lead = weekdayOf(makeCalendarDate(data.year, data.month, 1));
  const total = daysInMonth(data.year, data.month);
  const days = Array.from({ length: total }, (_, i) => makeCalendarDate(data.year, data.month, i + 1));

  const dayItems = day ? (data.byDay[day] ?? []) : [];

  return (
    <section>
      <div className="flex items-center justify-between gap-2 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
          {MONTH_NAMES[data.month - 1]} {data.year}
        </p>
        <div className="flex items-center gap-1">
          {/* scroll={false}: after a Link navigation Next resets the scroll
              position whenever the page root is scrolled at all, and on the
              phone this calendar sits ~530px down. Without it, stepping
              through months throws you back to the top every time. */}
          <Link href={href(shiftMonth(data.year, data.month, -1))} aria-label="Previous month" scroll={false}
                className="min-h-9 min-w-9 flex items-center justify-center text-ink-faint hover:text-ink transition-colors">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link href={href(shiftMonth(data.year, data.month, 1))} aria-label="Next month" scroll={false}
                className="min-h-9 min-w-9 flex items-center justify-center text-ink-faint hover:text-ink transition-colors">
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-4 text-sm">
        <span className="text-ink-faint">
          Expected <span className="font-semibold text-ink tabular-nums">{formatCurrency(data.expected)}</span>
        </span>
        {/* "Remaining" in a month that is already over means nothing. */}
        {!data.isPastMonth && (
          <>
            <span className="text-line">·</span>
            <span className="text-ink-faint">
              Remaining <span className="font-semibold text-ink tabular-nums">{formatCurrency(data.remaining)}</span>
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-[9px] font-bold uppercase tracking-widest text-ink-faint pb-1">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((date) => {
          const items = data.byDay[date] ?? [];
          const isToday = date === data.today;
          return (
            <button
              key={date}
              type="button"
              disabled={items.length === 0}
              // Without this the only thing announced is the day number. The
              // marks are aria-hidden, so a screen reader would have no way to
              // know which days carry a charge — which is the whole grid.
              aria-label={
                items.length > 0
                  ? `${MONTH_NAMES[data.month - 1]} ${Number(date.slice(8))}, ` +
                    `${items.length} ${items.length === 1 ? 'charge' : 'charges'}`
                  : undefined
              }
              onClick={() => { setDay(date); setOpen(true); }}
              className={cn(
                // rounded-lg, not xl: this theme maps lg to 16px, which is on
                // the 16/24/pill scale, and xl to 20px, which is not — and at a
                // 43px cell a 20px radius turns the grid into circles.
                'aspect-square rounded-lg bg-sand p-1 flex flex-col items-center justify-start gap-0.5',
                'transition-colors disabled:cursor-default',
                items.length > 0 && 'hover:bg-ink/10',
                // Today is marked by an outline, not a fill: a filled cell
                // would compete with the marks that carry the information.
                isToday && 'ring-1 ring-inset ring-ink',
              )}
            >
              <span className={cn('text-[10px] tabular-nums leading-none pt-0.5',
                                   isToday ? 'font-bold text-ink' : 'text-ink-faint')}>
                {date.slice(8)}
              </span>
              {items.length > 0 && (
                <span className="flex items-center gap-0.5">
                  {/* Two marks, not three: at 375px the grid gives each cell
                      about 43px, and three 13px circles plus gaps fill it edge
                      to edge with no room to breathe. */}
                  {items.slice(0, 2).map((o) => (
                    <SubscriptionMark key={o.subscriptionId} name={o.name} emoji={o.emoji} size={13}
                                      className="bg-ink/15" />
                  ))}
                  {items.length > 2 && (
                    <span className="text-[8px] font-bold tabular-nums text-ink-faint">
                      +{items.length - 2}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="
            border-0 p-6 gap-3 bg-paper-card
            max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
            max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
            max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
            max-lg:translate-x-0 max-lg:translate-y-0
            lg:rounded-3xl lg:max-w-sm
          "
        >
          <DialogTitle className="text-base font-bold tracking-tight">
            {day ? formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
          </DialogTitle>
          {dayItems.map((o) => (
            <div key={o.subscriptionId} className="flex items-center gap-3 py-2 border-t border-line">
              <SubscriptionMark name={o.name} emoji={o.emoji} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                {/* A word, not only a colour — and in ink-soft, not the
                    faintest available, for the same reason the payments
                    panel uses it: the state is the thing being read. */}
                <span className="block text-[11px] text-ink-soft">{STATE_LABEL[o.state]}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums text-ink">
                  {formatCurrency(o.paidAmount ?? o.amount)}
                </span>
                {/* A price change shows up here: what was paid, and what was expected. */}
                {o.paidAmount !== null && o.paidAmount !== o.amount && (
                  <span className="block text-[10px] text-ink-soft tabular-nums">
                    expected {formatCurrency(o.amount)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 3: Put it on the page**

In `src/app/subscriptions/page.tsx`:

Accept search params and fetch the month:

```tsx
import { cn } from '@/lib/utils';
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar';
import { getAccountOptions, getMonthOccurrences, getSubscriptionsView } from '@/app/actions/subscriptions';

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const params = await searchParams;
  const calendarView = params.view === 'calendar';

  const [view, categories, accounts, month] = await Promise.all([
    getSubscriptionsView(),
    getAllCategories(),
    getAccountOptions(),
    getMonthOccurrences(params.month),
  ]);
```

Keep the hero, the add control and Upcoming where they are — full width above the split, the way `/overview` does it. Then replace the bare `<SubscriptionList …/>` with the toggle and the split:

```tsx
          {/* Phone only: both will not fit in one column. Desktop shows both. */}
          <div className="d-mobile-only">
            <div className="flex items-center gap-4 pb-3 border-t border-line pt-4">
              <Link href="/subscriptions"
                    className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                                  calendarView ? 'text-ink-faint' : 'text-ink')}>
                List
              </Link>
              <Link href="/subscriptions?view=calendar"
                    className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                                  calendarView ? 'text-ink' : 'text-ink-faint')}>
                Calendar
              </Link>
            </div>
          </div>

          <div className="d-split">
            <div className={cn('d-split-main', calendarView && 'max-lg:hidden')}>
              <SubscriptionList items={view.subscriptions} today={view.today}
                                categories={categories} accounts={accounts} />
            </div>
            <div className={cn('d-split-panel d-panel-rule', !calendarView && 'max-lg:hidden')}>
              <SubscriptionCalendar data={month} preserveView={calendarView} />
            </div>
          </div>
```

`d-split`, `d-split-main`, `d-split-panel` and `d-panel-rule` are all defined only inside the desktop media query, so below it the two children simply stack and `max-lg:hidden` decides which one shows. No new CSS.

Change the wrapper's max width from `d-max-lg` to `d-max-xl`, matching `/accounts` and `/overview` — two columns need the room.

Add `import Link from 'next/link';` if it is not already there.

- [ ] **Step 4: Add the calendar to the harness**

In `src/app/dev-preview/page.tsx`, add the import and render it under the list, with a fixture that exercises the month-end clamp, a `+N` day, and all three states:

```tsx
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar';
import type { MonthOccurrences } from '@/app/actions/subscriptions';

const MONTH: MonthOccurrences = {
  // 34.99 on the 5th + 11.99 + 24.50 + 2.99; remaining counts from the 15th.
  monthKey: '2026-10', year: 2026, month: 10, today: TODAY, expected: 74.47,
  remaining: 39.48, isPastMonth: false,
  byDay: {
    '2026-10-05': [
      { subscriptionId: '5', name: 'Figma', emoji: null, amount: 15, cycle: 'monthly',
        date: '2026-10-05', state: 'confirmed', paidAmount: 15 },
      { subscriptionId: '7', name: 'Notion', emoji: null, amount: 8, cycle: 'monthly',
        date: '2026-10-05', state: 'unconfirmed', paidAmount: null },
      { subscriptionId: '8', name: 'Dropbox', emoji: '📦', amount: 11.99, cycle: 'monthly',
        date: '2026-10-05', state: 'confirmed', paidAmount: 13.99 },
    ],
    '2026-10-15': [
      { subscriptionId: '1', name: 'Spotify', emoji: '🎵', amount: 11.99, cycle: 'monthly',
        date: '2026-10-15', state: 'upcoming', paidAmount: null },
    ],
    '2026-10-19': [
      { subscriptionId: '4', name: 'Oatly delivery', emoji: '🥛', amount: 24.5, cycle: 'weekly',
        date: '2026-10-19', state: 'upcoming', paidAmount: null },
    ],
    '2026-10-31': [
      { subscriptionId: '2', name: 'iCloud+', emoji: null, amount: 2.99, cycle: 'monthly',
        date: '2026-10-31', state: 'upcoming', paidAmount: null },
    ],
  },
};
```

and, after the list:

```tsx
      <div className="pt-8">
        <SubscriptionCalendar data={MONTH} preserveView={false} />
      </div>
```

- [ ] **Step 5: Look at it**

At `/dev-preview`:

1. **October 2026 starts on a Thursday.** Count the leading blanks: there must be exactly 4 (Sun–Wed empty, the 1st under T). Getting this wrong by one shifts every date in the month, and it is invisible unless you check.
2. The 5th shows **two marks and `+1`**. The 15th is ringed as today.
3. Tap the 5th. Three rows: Figma Confirmed $15.00, Notion Unconfirmed $8.00, Dropbox Confirmed **$13.99 with "expected $11.99" beneath it** — the price-change case.
4. Days with nothing are not clickable: `read_page` shows them `disabled`.
5. **375 wide.** The grid does not overflow: `document.querySelector('.grid-cols-7').scrollWidth <= document.documentElement.clientWidth`. Cells stay square. The two marks plus `+1` fit inside one cell without clipping — zoom in on the 5th and look.
6. **Dark mode.** The `--sand` cells read as cells against `--paper`, and the `ring-ink` on today is visible.
7. Console clean, no key warnings.

- [ ] **Step 6: Check the two-column layout and the month-end clamp in the harness**

The clamp itself is already proved exhaustively by Task 1's unit tests — the 31st across February in a common and a leap year, and the return to the 31st in March. What the harness has to show is that the calendar *renders* it.

Add two more fixtures to `src/app/dev-preview/page.tsx`: the same `MonthOccurrences` shape for **February 2026** with a 28th occurrence, and for **March 2026** with a 31st, both from a notional 31st anchor. Render all three month fixtures one after another behind a simple toggle or simply stacked.

1. February shows the mark on the **28th**, March on the **31st**. That is the clamp, visible.
2. Leading blanks are right in all three months: October 2026 starts Thursday (4 blanks), February 2026 starts Sunday (0), March 2026 starts Sunday (0).
3. At 1280 the list and the calendar sit side by side with the rule between them. Measure the panel for overflow: `(() => { const p = document.querySelector('.d-split-panel'); return [...p.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > p.getBoundingClientRect().right + 1).length })()` must be `0`. An 8px overflow from a stray `-mx-2 px-2` has shipped on this project before.
4. At 375 the List/Calendar toggle switches which one shows, and the hero and Upcoming stay put in both.
5. Month navigation from the phone's calendar tab keeps `view=calendar` in the URL.

Record in your report that the calendar is **verified against fixtures**; the live page renders its empty state, which you can also check signed in.

- [ ] **Step 7: Lint, build, commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`

```bash
git add src/app/actions/subscriptions.ts src/components/SubscriptionCalendar.tsx \
        src/app/subscriptions/page.tsx src/app/dev-preview/page.tsx
git commit -m "Add the subscriptions calendar

Rounded sand cells, no shadows and no white — the same material MonthPicker
gives its month buttons, rather than the floating cards the reference uses.

Two marks per day and then +N. Three would fit a desktop panel but not a
375px phone, where the grid gives each cell about 43px.

An occurrence's state is never inferred from its date. A past day with
nothing linked reads Unconfirmed, and today reads Upcoming, because a charge
dated today may simply not have landed."
```

---

### Task 8: Linking a payment to the transaction that paid it

Manual only. A past date is never evidence; a link is.

The harness is reached the same way as in Task 7 — `dev-preview` is already exempt in `src/proxy.ts` by then, and the dev server still has to be started from a shell rather than by the preview tool.

**Files:**
- Modify: `src/app/actions/subscriptions.ts`
- Create: `src/components/SubscriptionHistory.tsx`
- Modify: `src/components/SubscriptionDialog.tsx`

**Interfaces:**
- Consumes: `getSubscriptionHistory`, `getLinkCandidates`, `linkTransaction`, `unlinkTransaction` from `@/app/actions/subscriptions`.
- Produces:
  - `interface OccurrenceState { date; periodKey; state: 'upcoming' | 'confirmed' | 'unconfirmed'; paidAmount: number | null; transactionId: string | null }`
  - `interface OrphanedLink { transactionId: string; period: CalendarDate; amount: number }`
  - `getSubscriptionHistory(id: string): Promise<{ today: CalendarDate; expected: number; occurrences: OccurrenceState[]; orphaned: OrphanedLink[] } | null>`
  - `const LINK_CANDIDATE_LIMIT = 25`, exported from `@/lib/subscriptionSchedule` — a `'use server'` file may export only async functions
  - `interface LinkCandidate { id: string; date: CalendarDate; merchant: string; amount: number; category: string }`
  - `getLinkCandidates(subscriptionId: string, date: string): Promise<LinkCandidate[]>`
  - `linkTransaction(transactionId: string, subscriptionId: string, period: string): Promise<{ success: boolean; error?: string }>`
  - `unlinkTransaction(transactionId: string): Promise<{ success: boolean; error?: string }>`
  - `<SubscriptionHistory subscriptionId={string} />`

- [ ] **Step 1: Add the actions**

Append to `src/app/actions/subscriptions.ts`. Add `addDays` to the `@/lib/dates` import, and `desc` to the drizzle one — Task 7 left it out because nothing there used it, and `getLinkCandidates` below is the first caller.

```ts
/** A link whose period answers to no occurrence in the series any more. */
export interface OrphanedLink {
  transactionId: string;
  period: CalendarDate;
  amount: number;
}

export interface OccurrenceState {
  date: CalendarDate;
  periodKey: string;
  state: 'upcoming' | 'confirmed' | 'unconfirmed';
  paidAmount: number | null;
  transactionId: string | null;
}

/**
 * The last twelve occurrences, each with its state, plus any stranded links.
 *
 * Computed over the whole series rather than a rolling window: for a monthly
 * subscription five years old that is sixty string comparisons, which costs
 * nothing, and an arbitrary window would quietly lose a yearly subscription's
 * history.
 */
export async function getSubscriptionHistory(id: string): Promise<{
  today: CalendarDate;
  expected: number;
  occurrences: OccurrenceState[];
  orphaned: OrphanedLink[];
} | null> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  const [sub] = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)),
    columns: SUB_COLUMNS,
    limit: 1,
  });
  if (!sub) return null;
  const row = { ...sub, amount: toNum(sub.amount, 'amount') } as SubscriptionRow;

  const upTo = nextOccurrence(row, today, today) ?? today;
  const all = occurrencesBetween(row, row.anchorDate, upTo, today);

  const links = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, user.id), eq(transactions.subscriptionId, id)),
    columns: { id: true, amount: true, subscriptionPeriod: true },
  });

  const paid = new Map<string, { id: string; amount: number }>();
  for (const l of links) {
    if (!l.subscriptionPeriod) continue;
    paid.set(periodKeyOf(row.cycle, l.subscriptionPeriod),
             { id: l.id, amount: toNum(l.amount, 'amount') });
  }

  // Moving the anchor across a month, or changing the cycle, can leave a link
  // pointing at a period the series no longer has. The spec calls that the
  // known ceiling and says it is "fixed by re-linking" — which is only true
  // if the stranded link is visible somewhere, because a linked transaction
  // is excluded from every candidate list. So surface them.
  const liveKeys = new Set(all.map((d) => periodKeyOf(row.cycle, d)));
  const orphaned: OrphanedLink[] = links
    .filter((l) => l.subscriptionPeriod && !liveKeys.has(periodKeyOf(row.cycle, l.subscriptionPeriod)))
    .map((l) => ({
      transactionId: l.id,
      period: l.subscriptionPeriod as CalendarDate,
      amount: toNum(l.amount, 'amount'),
    }));

  const occurrences = all.slice(-12).map((date) => {
    const key = periodKeyOf(row.cycle, date);
    const hit = paid.get(key);
    return {
      date,
      periodKey: key,
      state: occurrenceState(Boolean(hit), date, today),
      paidAmount: hit ? hit.amount : null,
      transactionId: hit ? hit.id : null,
    };
  });

  return { today, expected: row.amount, occurrences, orphaned };
}

export interface LinkCandidate {
  id: string;
  date: CalendarDate;
  merchant: string;
  amount: number;
  category: string;
}

/** Transactions near an occurrence that are not already claimed by something. */
export async function getLinkCandidates(
  subscriptionId: string,
  date: string,
): Promise<LinkCandidate[]> {
  const user = await getUser();
  let anchor: CalendarDate;
  try {
    anchor = toCalendarDate(date);
  } catch {
    return [];
  }

  // Ten days either side: a charge rarely lands on the stated day, and a
  // wider net would make the list something to search rather than pick from.
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      // Expenses only. An income row, a refund or a balance adjustment is not
      // a subscription payment, and offering one invites a link that would
      // make the occurrence read Confirmed against money that came in.
      eq(transactions.type, 'expense'),
      gte(transactions.date, addDays(anchor, -10)),
      lte(transactions.date, addDays(anchor, 10)),
      isNull(transactions.subscriptionId),
    ),
    columns: { id: true, date: true, merchant: true, amount: true, category: true },
    // Nearest the occurrence first, not newest first. The window is 21 days
    // wide and the cap is 25, and after a statement import there can easily
    // be more than 25 expenses in it — in which case newest-first silently
    // drops the older half of the window, which is where a charge posted on
    // or before the stated day lives. The one transaction most likely to be
    // the right one was the one being cut.
    // Then the earlier day, not the later one: at equal distance a charge
    // posted the day *before* the stated date is the likelier match, which
    // is the same reasoning that put distance first. Then the id, because
    // same-day rows tie on both keys above and without a final one which of
    // them survives the cap is whatever order Postgres returns.
    orderBy: [sql`abs(${transactions.date} - ${anchor}::date)`, asc(transactions.date), asc(transactions.id)],
    limit: LINK_CANDIDATE_LIMIT,
  });

  return rows.map((r) => ({ ...r, amount: toNum(r.amount, 'amount') }));
}

export async function linkTransaction(
  transactionId: string,
  subscriptionId: string,
  period: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  let periodDate: CalendarDate;
  try {
    periodDate = toCalendarDate(period);
  } catch {
    return { success: false, error: 'Not a valid period' };
  }

  try {
    // Inside the try, because it is a database call — the same reason
    // saveSubscription's ownership lookup is. Without this check a crafted id
    // could attach someone else's subscription to this transaction.
    const [owned] = await db.query.subscriptions.findMany({
      where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, user.id)),
      columns: { id: true },
      limit: 1,
    });
    if (!owned) return { success: false, error: 'Subscription not found' };

    const res = await db
      .update(transactions)
      .set({ subscriptionId, subscriptionPeriod: periodDate, updatedAt: new Date() })
      // isNull: the picker only ever offers unlinked expenses, so a request
      // to link one that is already linked came from a stale view — a second
      // device, or a tab left open. Moving it would silently revert whatever
      // occurrence it currently confirms.
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, user.id),
        isNull(transactions.subscriptionId),
        // The picker only offers expenses, but the picker is a read filter
        // and this is the write. A crafted call could otherwise confirm an
        // occurrence against money that came in.
        eq(transactions.type, 'expense'),
      ))
      .returning({ id: transactions.id });
    if (res.length === 0) {
      return { success: false, error: 'That payment is no longer available to link' };
    }
    revalidate();
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    return failed('linkTransaction', error, 'Could not link. Please try again.');
  }
}

export async function unlinkTransaction(
  transactionId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  try {
    // Clears the link only. The expense itself is untouched — the money moved.
    await db
      .update(transactions)
      .set({ subscriptionId: null, subscriptionPeriod: null, updatedAt: new Date() })
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)));
    revalidate();
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    return failed('unlinkTransaction', error, 'Could not unlink. Please try again.');
  }
}
```

- [ ] **Step 2: Write the history panel**

Create `src/components/SubscriptionHistory.tsx`. It loads on mount rather than being passed down: it lives inside the dialog, which Radix mounts only when open, so a list of forty subscriptions costs forty queries it never makes.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getLinkCandidates, getSubscriptionHistory, linkTransaction, unlinkTransaction,
  type LinkCandidate, type OccurrenceState,
} from '@/app/actions/subscriptions';
import { LINK_CANDIDATE_LIMIT } from '@/lib/subscriptionSchedule';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

export function SubscriptionHistory({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getSubscriptionHistory>>>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  // Three states, not two. "Still looking" and "the request failed" are each
  // different from "none found", and saying "none found" for either is a lie
  // the user acts on by giving up.
  const [candidates, setCandidates] = useState<LinkCandidate[] | 'loading' | 'failed'>('loading');
  // Taps can outrun responses: without this, opening one row and quickly
  // opening another can show the first row's candidates under the second
  // row's date, and linking one would attach it to the wrong occurrence.
  const pickSeq = useRef(0);
  const [busy, setBusy] = useState(false);

  // No setLoading here: this runs after a link or unlink, and swapping the
  // list for a spinner on every click would make a one-row change look like a
  // page reload.
  async function reload() {
    setData(await getSubscriptionHistory(subscriptionId));
  }

  useEffect(() => {
    let live = true;
    getSubscriptionHistory(subscriptionId)
      .then((d) => { if (live) setData(d); })
      .catch((error) => {
        // Rethrow first, exactly as the picker and the dialog do: a
        // signed-out panel reaches here on its way to /login, and without
        // this it arrives with a false "could not load" toast on top.
        unstable_rethrow(error);
        // Otherwise the spinner would stay up for good, with an uncaught
        // rejection behind it and nothing to act on.
        if (live) toast.error('Could not load payments.');
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [subscriptionId]);

  async function openPicker(o: OccurrenceState) {
    const seq = ++pickSeq.current;
    setPicking(o.date);
    setCandidates('loading');
    try {
      const rows = await getLinkCandidates(subscriptionId, o.date);
      if (seq === pickSeq.current) setCandidates(rows);
    } catch (error) {
      unstable_rethrow(error);
      if (seq !== pickSeq.current) return;
      setCandidates('failed');
      toast.error('Could not reach the server. Please try again.');
    }
  }

  // try/catch/finally for the same reason SubscriptionDialog has it: the
  // actions catch database errors, but nothing catches the request itself
  // failing. Without the finally, `busy` stays true and every control in this
  // panel is disabled with no way back.
  async function link(transactionId: string, period: string) {
    setBusy(true);
    try {
      const res = await linkTransaction(transactionId, subscriptionId, period);
      if (!res.success) { toast.error(res.error || 'Could not link'); return; }
      setPicking(null);
      // The write succeeded. A failing refresh after it is a stale screen,
      // not a failed link, and must not be reported as one.
      try { await reload(); router.refresh(); } catch { /* stale, not failed */ }
    } catch (error) {
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(transactionId: string) {
    setBusy(true);
    try {
      const res = await unlinkTransaction(transactionId);
      if (!res.success) { toast.error(res.error || 'Could not unlink'); return; }
      try { await reload(); router.refresh(); } catch { /* stale, not failed */ }
    } catch (error) {
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-3 text-[11px] text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading payments…
      </p>
    );
  }
  // Not `occurrences.length === 0` alone: a series can have no live
  // occurrences and still hold stranded links, and hiding them here would
  // undo the only way to reach them.
  if (!data) return null;
  if (data.occurrences.length === 0 && data.orphaned.length === 0) return null;

  return (
    // min-w-0: this panel sits in a grid, and a grid item's default
    // min-width is auto, so it refuses to shrink below its content and
    // pushes the dialog sideways instead — measured at 361.7px in a 327px
    // column, and again at 1280 with a long merchant name.
    <div className="min-w-0 pt-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Payments</p>
      {/* Newest first: the ones you are most likely to be confirming. */}
      {[...data.occurrences].reverse().map((o) => (
        <div key={o.date} className="border-t border-line py-2">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* A word, not only a colour — and not in the faintest ink
                  available, since the state is the thing being read. */}
              <span className="block text-[11px] text-ink-soft">{STATE_LABEL[o.state]}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.paidAmount ?? data.expected)}
              </span>
              {o.paidAmount !== null && o.paidAmount !== data.expected && (
                <span className="block text-[10px] tabular-nums text-ink-soft">
                  expected {formatCurrency(data.expected)}
                </span>
              )}
            </span>
            {o.state === 'confirmed' ? (
              <button type="button" disabled={busy} onClick={() => unlink(o.transactionId!)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            ) : o.state === 'unconfirmed' ? (
              <button type="button" disabled={busy} onClick={() => openPicker(o)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Link
              </button>
            ) : null}
          </div>

          {/* Inline rather than a second dialog: a dialog inside a dialog is
              a focus-trap argument nobody wins. */}
          {picking === o.date && (
            <div className="pt-2 pl-1">
              {candidates === 'loading' ? (
                <p className="flex items-center gap-2 text-[11px] text-ink-faint">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking…
                </p>
              ) : candidates === 'failed' ? (
                <p className="text-[11px] text-ink-soft">
                  Could not load. Tap Link again to retry.
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-[11px] text-ink-faint">
                  No unlinked expense within ten days of this date.
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => link(c.id, o.date)}
                    className="w-full flex items-center gap-3 py-1.5 text-left disabled:opacity-40"
                  >
                    <span className="text-[11px] tabular-nums text-ink-faint shrink-0">
                      {formatDate(c.date, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{c.merchant}</span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">
                      {formatCurrency(c.amount)}
                    </span>
                  </button>
                ))
              )}
              {Array.isArray(candidates) && candidates.length === LINK_CANDIDATE_LIMIT && (
                <p className="pt-1 text-[10px] text-ink-soft">
                  Showing the {LINK_CANDIDATE_LIMIT} payments nearest this date.
                </p>
              )}
              <button type="button" onClick={() => setPicking(null)}
                      className="pt-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Links the series no longer has a period for — after the billing day
          moved across a month, or the cycle changed. The spec calls this the
          known ceiling and says it is fixed by re-linking; that is only true
          if the stranded link can be found, because a linked transaction is
          excluded from every candidate list. Unlink here, then link it where
          it belongs. */}
      {data.orphaned.length > 0 && (
        <div className="pt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
            No longer matches a payment date
          </p>
          {data.orphaned.map((o) => (
            <div key={o.transactionId} className="flex items-center gap-3 border-t border-line py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {formatDate(o.period, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="block text-[11px] text-ink-soft">Linked to a date this subscription no longer bills on</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.amount)}
              </span>
              <button type="button" disabled={busy} onClick={() => unlink(o.transactionId)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Put it in the dialog**

In `src/components/SubscriptionDialog.tsx`, add the import:

```tsx
import { SubscriptionHistory } from '@/components/SubscriptionHistory';
```

and render it between the field grid and the status row, so the fields stay at the top where editing happens:

```tsx
        {subscription && <SubscriptionHistory subscriptionId={subscription.id} />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Verify the link rules without writing anything**

The link cycle needs rows to exercise, and this plan creates none. Split the verification into the part that can be proved here and the part that cannot.

**Proved here, in the harness.** Extend `src/app/dev-preview/page.tsx` to render `SubscriptionHistory`'s markup against a fixture list of `OccurrenceState` values rather than a server call — the simplest way is to lift the presentational part into a small pure component the harness can feed, or to render the same JSX inline in the harness. Cover all four cases and check each reads correctly:

1. A future occurrence → **Upcoming**, with no Link control.
2. A past occurrence with nothing linked → **Unconfirmed**, with a Link control. Not "Missed", not "Overdue", and above all not "Paid" — a past date is not evidence.
3. A confirmed occurrence whose paid amount equals the expected one → **Confirmed**, one amount.
4. A confirmed occurrence whose paid amount differs → **Confirmed**, the **actual** amount, with `expected $X` beneath it. This is the price-change case and it is the one a person will look for.

Then the state labels are words, not colours alone, at 375 and 1280 in both schemes.

**Proved here, by reading.** Three rules live in the code and can be checked without running it:

5. `getSubscriptionHistory` derives `state` as `hit ? 'confirmed' : date >= today ? 'upcoming' : 'unconfirmed'`. Confirm there is no path that infers payment from a date alone.
6. `linkTransaction` checks that the subscription belongs to the user *before* the update, and the update's `where` also filters on `userId`. Both, not either.
7. `unlinkTransaction` sets `subscriptionId` and `subscriptionPeriod` to null, and `updatedAt`. Nothing else — in particular not `amount`, not `date`, not `category`.

Also confirm, read-only, that the foreign key would do the right thing on a delete:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select conname, confdeltype from pg_constraint where conrelid='transactions'::regclass and conname like '%subscription%'\").simple());
await sql.end();
"
```

Expected: `confdeltype` `n`. SET NULL, not cascade: deleting a subscription must never take a real expense with it.

**Not proved here.** Record these in your report as needing a person, one line each: linking a transaction dated two days off the occurrence; the month-granularity match surviving a billing-day move from the 15th to the 20th; and unlinking leaving the transaction in History untouched.

- [ ] **Step 6: Lint, build, commit**

Run: `npm run lint && npm run build`

```bash
git add src/app/actions/subscriptions.ts src/components/SubscriptionHistory.tsx \
        src/components/SubscriptionDialog.tsx
git commit -m "Link a payment to the transaction that paid it

Confirmation is a link and nothing else. A date in the past is not evidence
that money moved, so a past occurrence with nothing attached says Unconfirmed
and keeps saying it.

The picker looks ten days either side, because a charge rarely lands on the
day the service names. Linking writes two columns on the transaction and
touches no amount anywhere."
```

---

### Task 9: The sweep

Prove the one rule holds, take the harness out, and ship.

**Files:**
- Delete: `src/app/dev-preview/page.tsx`

- [ ] **Step 0: Six carried-over fixes from the Task 8 re-review**

Small, and they land in files this task is already touching or deleting. Each is in the plan's own blocks above; apply them from there.

1. **`src/app/actions/subscriptions.ts`, `getMonthOccurrences`:** hoist `const state = occurrenceState(...)` and use `state === 'upcoming'` for `remaining`, in place of `date >= today && !hit`. That is the same boundary spelled a second way, two lines from the call that computes it — if the rule ever moves, the calendar grid and the "remaining" figure disagree, which is the exact failure the function's own docblock warns about.
2. **`getLinkCandidates`:** the equal-distance tiebreak becomes `asc(transactions.date)`. At the same distance, a charge posted the day *before* the stated date is the likelier match — the same reasoning that put distance first in the first place.
3. **`linkTransaction`:** add `eq(transactions.type, 'expense')` to the UPDATE's `where`. The picker only offers expenses, but the picker is a read filter and this is the write; a crafted call could otherwise confirm an occurrence against money that came in.
4. **`src/components/SubscriptionCalendar.tsx`:** the day sheet's state word moves from `text-ink-faint` to `text-ink-soft`, matching the payments panel. The state is the thing being read.
5. **`src/lib/subscriptionSchedule.test.ts`:** one more assertion in the state table — `occurrenceState(false, '2026-10-14', T) === 'unconfirmed'`. The table pinned today's side of the boundary and not yesterday's, so a rule granting an arbitrary grace period passed it.
6. **The harness's own copy of the old ternary** (`src/app/dev-preview/page.tsx`, the fixture builder) needs nothing — Step 6 deletes the file.

Run `npm test` and `npx tsc --noEmit` after these, before going on.

- [ ] **Step 1: Prove the one rule from the code, not from a before-and-after**

The rule is that a subscription never enters a spending figure. The original check was to record Home, Overview, History and Accounts, add three subscriptions, and confirm nothing moved. That needs writes, and it would only have proved it for the three rows tried.

Reading the queries proves it for all rows, which is the stronger claim:

```bash
grep -rln "subscriptions" src/app/actions/
```

Expected exactly three files, and each for a reason you can name:

- `subscriptions.ts` — the feature's own actions.
- `manage.ts` — only inside `deletePaymentMethod`, where Task 2 added the archive guard.
- `settings.ts` — only inside `deleteAllData`, where Task 3 added the wipe.

Check the two guests by eye. If `overview.ts`, `history.ts`, `accounts.ts`, `transactions.ts` or `time.ts` appears, something reads the new table into a spending figure, and that is a Critical finding.

Then the reverse direction — nothing in the subscriptions action file writes to a table the other surfaces read:

```bash
grep -n "\.insert(\|\.update(\|\.delete(" src/app/actions/subscriptions.ts
```

Match on the method, not on `db.`: three of the four writes are chained across two lines (`await db`, then `.update(...)` on the next), so a pattern anchored on `db.` finds only the single-line insert and the check then passes whatever is added beside it. A raw `db.execute(sql\`...\`)` would still slip past this; nothing in the plan adds one.

Expected: inserts and deletes only on `subscriptions`, and updates on `subscriptions` plus exactly two on `transactions` — the link and the unlink in Task 8, which set only `subscriptionId`, `subscriptionPeriod` and `updatedAt`.

Finally, confirm read-only that the live figures cannot have moved, because the data has not:

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\`
  select count(*) as txns,
         sum(case when type='expense' then amount else 0 end) as spend,
         count(subscription_id) as linked
  from transactions\`).simple());
console.table(await sql.unsafe(\"select count(*) as subs from subscriptions\").simple());
await sql.end();
"
```

Expected: `linked` 0 and `subs` 0. The transaction count is whatever it is — it was 129 when Task 2 fingerprinted it, and it drifts as the user adds expenses; the two zeros are the part that means anything.

- [ ] **Step 2: Check the normalisation arithmetic against the unit tests, not the screen**

With $7 weekly, $70 monthly and $700 yearly active, the monthly equivalent is `7 × 365.25 / 7 / 12 + 70 + 700 / 12` = `30.4375 + 70 + 58.3333` = **$158.77**, and the annual equivalent is **$1,905.25** — twelve times the *unrounded* sum, which is what the code does, not twelve times $158.77.

`monthlyEquivalent` is unit-tested per cycle in Task 1. What is not unit-tested is the summing and rounding in `getSubscriptionsView`, which no test reaches because it needs a database. Read it instead and confirm by hand that it sums unrounded, rounds once at the end, and excludes paused and ended. Record the three expected figures in your report so the user has them to check against when they first add real subscriptions.

- [ ] **Step 3: Render those figures in the harness**

Set the harness hero to 158.77 / 1905.25 with an active count of 2 and confirm `ResponsiveAmount` renders both in full at 375 and 1280. The point is the typography, not the arithmetic — a figure that does not fit is the failure mode here.

- [ ] **Step 4: The viewport and colour sweep**

Two surfaces, because neither alone covers it: `/dev-preview`, which has the fixtures, and `/subscriptions` signed in, which has the real empty state. At **1280, 1440 and 1920**, and at **375**, in **both colour schemes**:

1. No horizontal scroll: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
2. Content stays centred and the layout stops growing — the page uses `d-max-xl`, so 1920 should look like 1440 with wider margins, not stretched.
3. Nothing overflows the right panel. Measure it: `(() => { const p = document.querySelector('.d-split-panel'); return [...p.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > p.getBoundingClientRect().right + 1).length })()` must be `0`.
4. **No amount is truncated anywhere.** In the harness, set a fixture to `123456.78` and check the hero, the list row, the upcoming row and the calendar dialog. A six-figure amount in a narrow list row is the case that breaks first.
5. The dialog is a bottom sheet at 375 and centred at 1280.
6. Console clean on every page: `read_console_messages { onlyErrors: true }`.

- [ ] **Step 5: Check the rest of the app did not move**

Walk `/`, `/overview`, `/accounts`, `/history`, `/settings` at 1280 and 375. Nothing about them should have changed except the Recurring row on Overview at 375 and the fifth sidebar entry at 1280. The bottom nav still has four tabs and still clears 320px.

- [ ] **Step 6: Remove the harness, and everything that existed for it**

There is no test data to remove — nothing was written. There are two pieces of scaffolding.

```bash
rm src/app/dev-preview/page.tsx
rmdir src/app/dev-preview
```

Then take the exemption back out of `src/proxy.ts`, restoring the matcher to exactly:

```ts
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|icons|splash|api|auth/callback).*)',
```

And confirm nothing is left behind:

```bash
grep -rn "dev-preview" src/ docs/superpowers/plans/ ; echo "exit $?"
```

Expected: matches only inside the plan document, which is history. A match anywhere under `src/` means a piece of the harness shipped.

A stale `.next/dev` type file can make `tsc` complain about the route after the folder is gone. If that happens, stop the dev server and `rm -rf .next` before believing the error — it has happened on this project before.

- [ ] **Step 7: Final gates**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four clean.

- [ ] **Step 8: Confirm RLS one more time**

```bash
node --env-file=.env.local --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
console.table(await sql.unsafe(\"select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename\").simple());
console.table(await sql.unsafe(\"select tablename, policyname from pg_policies order by tablename\").simple());
await sql.end();
"
```

Expected: five tables, all `rowsecurity: true`, each with its own policy, `subscriptions` among them.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit -m "Remove the subscriptions preview harness

It existed because the in-app browser has no session. The feature is now
verifiable against the real signed-in pages, so it has no reason to stay."
git push origin main
```

Vercel deploys `main` to `moooney.tooong.com` on push. After it goes out, open the live site on a phone and on a desktop and repeat Step 2's comparison against production data — the one rule is worth checking twice.

## Self-review

Checked against the spec, 2026-10-15.

**Spec coverage.** Problem/goal → Tasks 4, 7. The one rule → enforced by Task 3 (separate tables, separate query) and verified by Task 9 Step 2. Non-goals → nothing in any task adds currency, a fourth state, custom intervals, trends, auto-matching, notifications or a paywall. Screenshot treatment → Task 4 (hierarchy, cycle grouping, relative dates) and Task 7 (calendar marks, sand cells, no gradients). Identity marks → Task 4 Step 5. Data model → Task 2. Linking → Tasks 2 and 8. Billing arithmetic → Task 1. Changing the billing day → Task 1's `periodKeyOf`, Task 5's date hint, Task 8 Step 5.8. Changing the price → Task 7's `paidAmount` and Task 8's history row, verified at Task 8 Step 5.7. Normalised totals → Task 1 and Task 3, verified at Task 9 Step 3. Page structure → Tasks 4, 5, 7. Occurrence states → Tasks 7 and 8. Desktop and mobile → Task 7 Step 3. Navigation → Task 6. Forms → Task 5. Verification → Tasks 1, 8 and 9.

**Two deviations, both deliberate and both recorded where they happen:**
- The calendar shows **two** marks per day and then `+N`; the spec said three. Three 13px circles with gaps fill a 43px phone cell edge to edge. Task 7 Step 2.
- There is **no separate detail route**. The spec says "tapping one opens the subscription", and the dialog is where it opens — the desktop panel is already committed to the calendar, so a second detail surface would have nowhere to live.

**Type consistency.** `SubscriptionRow`, `ListItem`, `UpcomingOccurrence`, `DayOccurrence`, `MonthOccurrences`, `OccurrenceState` and `LinkCandidate` are each defined once and used under the same name afterwards. `anchorDate` is the field name everywhere; `anchor_date` appears only in SQL. `periodKeyOf(cycle, date)` keeps its argument order in Tasks 1, 7 and 8. `nextOccurrence(sub, from, today)` keeps its three arguments in Tasks 1, 3 and 8.

**One thing the plan does not cover, by design:** there is no way to link a payment from the transaction's own detail page — only from the subscription. Add it if confirming turns out to be something done while entering the expense rather than while reviewing the subscription.
