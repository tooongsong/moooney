import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nowPartsIn, todayIn, monthRange, yearRange,
  yearOf, monthOf, monthKeyOf, dayOf, daysInMonth, safeTimeZone, toCalendarDate,
  addDays, daysBetween, weekdayOf, makeCalendarDate,
} from './dates.ts';

const LA = 'America/Los_Angeles';

// ── todayIn / nowPartsIn ─────────────────────────────────────────────────────
// The whole point of the module: the calendar day depends on where you are,
// and the server's own zone must never leak into the answer.

test('an instant that is already tomorrow in UTC is still today in California', () => {
  // 2026-10-01T02:00Z is 2026-09-30 19:00 in Los Angeles.
  const instant = new Date('2026-10-01T02:00:00Z');
  assert.equal(todayIn(LA, instant), '2026-09-30');
  assert.equal(todayIn('UTC', instant), '2026-10-01');
});

test('an instant early in the UTC day is the previous day in California', () => {
  const instant = new Date('2026-09-27T00:00:00Z'); // 2026-09-26 17:00 LA
  assert.equal(todayIn(LA, instant), '2026-09-26');
});

test('midday UTC is the same calendar day in California', () => {
  const instant = new Date('2026-09-10T21:58:52Z'); // 14:58 LA
  assert.equal(todayIn(LA, instant), '2026-09-10');
});

test('nowPartsIn returns numeric parts, not zero-padded strings', () => {
  const p = nowPartsIn(LA, new Date('2026-03-05T20:00:00Z'));
  assert.deepEqual(p, { year: 2026, month: 3, day: 5 });
});

test('todayIn zero-pads single-digit months and days', () => {
  assert.equal(todayIn('UTC', new Date('2026-01-02T12:00:00Z')), '2026-01-02');
});

// ── monthRange ───────────────────────────────────────────────────────────────

test('monthRange covers a 30-day month end to end', () => {
  assert.deepEqual(monthRange(2026, 9), ['2026-09-01', '2026-09-30']);
});

test('monthRange covers a 31-day month', () => {
  assert.deepEqual(monthRange(2026, 10), ['2026-10-01', '2026-10-31']);
});

test('monthRange handles February in a non-leap year', () => {
  assert.deepEqual(monthRange(2026, 2), ['2026-02-01', '2026-02-28']);
});

test('monthRange handles February in a leap year', () => {
  assert.deepEqual(monthRange(2028, 2), ['2028-02-01', '2028-02-29']);
});

test('monthRange handles December without rolling into the next year', () => {
  assert.deepEqual(monthRange(2026, 12), ['2026-12-01', '2026-12-31']);
});

// ── yearRange ────────────────────────────────────────────────────────────────

test('yearRange spans Jan 1 to Dec 31', () => {
  assert.deepEqual(yearRange(2026), ['2026-01-01', '2026-12-31']);
});

// ── accessors on a calendar date string ──────────────────────────────────────

test('yearOf, monthOf and monthKeyOf read the parts without constructing a Date', () => {
  assert.equal(yearOf('2026-09-27'), 2026);
  assert.equal(monthOf('2026-09-27'), 9);
  assert.equal(monthKeyOf('2026-09-27'), '2026-09');
});

test('dayOf reads the day of month', () => {
  assert.equal(dayOf('2026-09-27'), 27);
  assert.equal(dayOf('2026-09-01'), 1);
});

test('monthOf returns 1-based months, so January is 1', () => {
  assert.equal(monthOf('2026-01-15'), 1);
  assert.equal(monthOf('2026-12-15'), 12);
});

// ── daysInMonth ──────────────────────────────────────────────────────────────

test('daysInMonth knows leap years', () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2000, 2), 29); // divisible by 400
  assert.equal(daysInMonth(1900, 2), 28); // divisible by 100 but not 400
});

test('daysInMonth handles the 30/31 split', () => {
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 7), 31);
});

// ── safeTimeZone — the value comes from user metadata, so it is untrusted ────

test('safeTimeZone passes a valid zone through', () => {
  assert.equal(safeTimeZone(LA), LA);
});

test('safeTimeZone falls back to UTC for junk, empty and missing values', () => {
  assert.equal(safeTimeZone('Mars/Olympus_Mons'), 'UTC');
  assert.equal(safeTimeZone(''), 'UTC');
  assert.equal(safeTimeZone(null), 'UTC');
  assert.equal(safeTimeZone(undefined), 'UTC');
});

test('a junk timezone degrades to UTC instead of throwing', () => {
  // A bad value in user_metadata must not take down every page that shows a date.
  assert.doesNotThrow(() => todayIn(safeTimeZone('not/a/zone')));
});

// ── DST — the hours shift but the calendar day must not ──────────────────────

test('the calendar day is correct on both sides of a DST transition', () => {
  // US DST ends 2026-11-01. 08:30Z is 01:30 PDT before, 00:30 PST after.
  assert.equal(todayIn(LA, new Date('2026-11-01T08:30:00Z')), '2026-11-01');
  assert.equal(todayIn(LA, new Date('2026-10-31T08:30:00Z')), '2026-10-31');
});

// ── the property that actually matters ───────────────────────────────────────

test('a calendar date is a plain string and never passes through a Date', () => {
  const [start, end] = monthRange(2026, 9);
  for (const v of [start, end, todayIn(LA)]) {
    assert.equal(typeof v, 'string');
    assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
  }
});

// ── toCalendarDate — the write-side trust boundary ───────────────────────────

test('toCalendarDate passes a well-formed date through unchanged', () => {
  assert.equal(toCalendarDate('2026-09-27'), '2026-09-27');
  assert.equal(toCalendarDate('2028-02-29'), '2028-02-29'); // real leap day
});

test('toCalendarDate rejects anything that is not YYYY-MM-DD', () => {
  for (const bad of ['', '2026-9-7', '09/27/2026', '2026-09-27T00:00:00Z', 'today', '20260927']) {
    assert.throws(() => toCalendarDate(bad), /Not a calendar date/, `should reject ${JSON.stringify(bad)}`);
  }
});

test('toCalendarDate rejects dates that do not exist', () => {
  assert.throws(() => toCalendarDate('2026-02-30'), /Day out of range/);
  assert.throws(() => toCalendarDate('2026-02-29'), /Day out of range/); // 2026 is not a leap year
  assert.throws(() => toCalendarDate('2026-13-01'), /Month out of range/);
  assert.throws(() => toCalendarDate('2026-00-10'), /Month out of range/);
  assert.throws(() => toCalendarDate('2026-04-31'), /Day out of range/);
});

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
