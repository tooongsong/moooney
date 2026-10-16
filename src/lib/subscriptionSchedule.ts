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
    // The first k with anchor + 7k >= lo.
    let k = Math.max(0, Math.ceil(daysBetween(sub.anchorDate, lo) / 7));
    for (let d = addDays(sub.anchorDate, 7 * k); d <= hi; k++, d = addDays(sub.anchorDate, 7 * k)) {
      out.push(d);
    }
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

/** "in 4 days" / "yesterday". Pairs with the absolute date, never replaces it:
 *  "in 4 days" alone is useless a week later on a screenshot. */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
