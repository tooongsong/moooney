import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nowPartsIn, todayIn, monthRange, yearRange,
  yearOf, monthOf, monthKeyOf, dayOf, daysInMonth, safeTimeZone, toCalendarDate,
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
