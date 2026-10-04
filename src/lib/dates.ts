/**
 * Calendar dates, as strings.
 *
 * A transaction's date is a calendar fact — "I spent this on 2026-09-27" — not a
 * point in time. Putting it in a JS Date attaches a timezone to it, and every
 * hop that re-reads it in a different zone shifts the day: that is how the date
 * column ended up rendering a day early.
 *
 * So a date stays a "YYYY-MM-DD" string from the database to the screen and
 * back. No Date object ever touches it, so nothing can shift it.
 *
 * A timezone is needed for exactly one question — what is *today* — and that is
 * the user's configured zone, never the server's.
 */

/** A calendar date with no time and no zone, "YYYY-MM-DD". */
export type CalendarDate = string;

export const FALLBACK_TIME_ZONE = 'UTC';

/**
 * Timezone values come from user metadata, which the user can set. An invalid
 * one makes Intl throw, so validate before every use rather than letting a bad
 * value break every page that shows a date.
 */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/** The year/month/day showing on a wall clock in `tz` at `instant`. Month is 1-based. */
export function nowPartsIn(
  tz: string,
  instant: Date = new Date(),
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Today's calendar date in `tz`. */
export function todayIn(tz: string, instant: Date = new Date()): CalendarDate {
  const { year, month, day } = nowPartsIn(tz, instant);
  return format(year, month, day);
}

/** Days in a month. Month is 1-based. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one. Constructed in UTC so
  // the host zone cannot pull it into an adjacent month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Inclusive first and last calendar date of a month. Month is 1-based. */
export function monthRange(year: number, month: number): [CalendarDate, CalendarDate] {
  return [format(year, month, 1), format(year, month, daysInMonth(year, month))];
}

/** Inclusive first and last calendar date of a year. */
export function yearRange(year: number): [CalendarDate, CalendarDate] {
  return [format(year, 1, 1), format(year, 12, 31)];
}

/**
 * Validate a date arriving from a form or from the extraction model.
 * Throws rather than coercing: a wrong date silently written to a transaction is
 * worse than a failed save the user can retry.
 */
export function toCalendarDate(value: string): CalendarDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) throw new Error(`Not a calendar date: ${JSON.stringify(value)}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) throw new Error(`Month out of range: ${value}`);
  if (day < 1 || day > daysInMonth(year, month)) throw new Error(`Day out of range: ${value}`);
  return value;
}

export function yearOf(date: CalendarDate): number {
  return Number(date.slice(0, 4));
}

/** 1-based month of a calendar date. */
export function monthOf(date: CalendarDate): number {
  return Number(date.slice(5, 7));
}

/** Day of month of a calendar date. */
export function dayOf(date: CalendarDate): number {
  return Number(date.slice(8, 10));
}

/** The "YYYY-MM" key a calendar date belongs to. */
export function monthKeyOf(date: CalendarDate): string {
  return date.slice(0, 7);
}

function format(year: number, month: number, day: number): CalendarDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
