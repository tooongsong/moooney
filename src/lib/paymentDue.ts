// A credit card's payment due date, derived from a day of the month.

import { daysBetween, daysInMonth, makeCalendarDate, monthOf, yearOf, type CalendarDate } from './dates.ts';

/** A due date this near, on a card that owes money, is shown in accent. */
export const DUE_SOON_DAYS = 7;

export interface NextDue {
  date: CalendarDate;
  daysAway: number;
}

export function isDueDay(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 31;
}

/** This month's due day if it has not passed, otherwise next month's. A day the
 *  month does not have (31 in February) falls on that month's last day. */
export function nextDue(dueDay: number, today: CalendarDate): NextDue {
  const inMonth = (year: number, month: number) =>
    makeCalendarDate(year, month, Math.min(dueDay, daysInMonth(year, month)));

  const year = yearOf(today);
  const month = monthOf(today);
  let date = inMonth(year, month);
  if (daysBetween(today, date) < 0) {
    date = month === 12 ? inMonth(year + 1, 1) : inMonth(year, month + 1);
  }
  return { date, daysAway: daysBetween(today, date) };
}

export function isDueSoon(next: NextDue | null, balance: number): boolean {
  return next !== null && balance < 0 && next.daysAway <= DUE_SOON_DAYS;
}
