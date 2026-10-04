import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, toDateInputValue } from './utils.ts';

// Regression tests for the off-by-one date bug.
//
// transactions.date used to be a `timestamp`, so a calendar date picked up a
// timezone: it was written as the writer's midnight, read back as UTC, then
// rendered in the viewer's zone — one day earlier for anyone west of UTC. Worse,
// the edit form showed that shifted day, so saving wrote it back and the date
// walked backwards a day per edit.
//
// The column is a `date` now and these helpers see "YYYY-MM-DD" strings. Run the
// suite under any zone: the rendered day must not move.

const DATE = '2026-09-27';

test('a calendar date renders as the day it says, not the day before', () => {
  assert.equal(formatDate(DATE, { day: 'numeric', month: 'short' }), 'Sep 27');
  assert.equal(formatDate(DATE, { day: 'numeric', month: 'short', year: 'numeric' }), 'Sep 27, 2026');
});

test('the edit form round-trips a calendar date unchanged', () => {
  // This is the loop that used to corrupt data: open the form, save, repeat.
  let value = DATE;
  for (let i = 0; i < 5; i++) value = toDateInputValue(value);
  assert.equal(value, DATE, 'repeated edits must not walk the date backwards');
});

test('a date at the start of a month does not fall into the previous one', () => {
  assert.equal(formatDate('2026-10-01', { day: 'numeric', month: 'short' }), 'Oct 1');
  assert.equal(toDateInputValue('2026-10-01'), '2026-10-01');
});

test('a date at the start of a year does not fall into the previous one', () => {
  assert.equal(formatDate('2026-01-01', { day: 'numeric', month: 'short', year: 'numeric' }), 'Jan 1, 2026');
  assert.equal(toDateInputValue('2026-01-01'), '2026-01-01');
});

test('a leap day survives the round trip', () => {
  assert.equal(toDateInputValue('2028-02-29'), '2028-02-29');
  assert.equal(formatDate('2028-02-29', { day: 'numeric', month: 'short' }), 'Feb 29');
});
