import test from 'node:test';
import assert from 'node:assert/strict';
import { isDueDay, isDueSoon, nextDue } from './paymentDue.ts';

test('before the due day: due this month', () => {
  assert.deepEqual(nextDue(25, '2026-11-19'), { date: '2026-11-25', daysAway: 6 });
});

test('on the due day: due today', () => {
  assert.deepEqual(nextDue(19, '2026-11-19'), { date: '2026-11-19', daysAway: 0 });
});

test('after the due day: due next month', () => {
  assert.deepEqual(nextDue(5, '2026-11-19'), { date: '2026-12-05', daysAway: 16 });
});

test('December rolls into January of the next year', () => {
  assert.deepEqual(nextDue(3, '2026-12-10'), { date: '2027-01-03', daysAway: 24 });
});

test('day 31 in a 30-day month is the 30th', () => {
  assert.deepEqual(nextDue(31, '2026-11-19'), { date: '2026-11-30', daysAway: 11 });
});

test('day 31 in February is the 28th, and is due on that day', () => {
  assert.deepEqual(nextDue(31, '2026-02-28'), { date: '2026-02-28', daysAway: 0 });
});

test('after a clamped due day the next month is clamped on its own length', () => {
  assert.deepEqual(nextDue(30, '2026-01-31'), { date: '2026-02-28', daysAway: 28 });
});

test('isDueDay accepts whole numbers 1 to 31 only', () => {
  for (const ok of [1, 15, 31]) assert.equal(isDueDay(ok), true, String(ok));
  for (const bad of [0, 32, 1.5, Number.NaN, '5', null]) assert.equal(isDueDay(bad), false, String(bad));
});

test('due soon needs both a near date and a balance owed', () => {
  assert.equal(isDueSoon({ date: '2026-11-25', daysAway: 6 }, -100), true);
  assert.equal(isDueSoon({ date: '2026-11-26', daysAway: 7 }, -100), true);
  assert.equal(isDueSoon({ date: '2026-11-27', daysAway: 8 }, -100), false);
  assert.equal(isDueSoon({ date: '2026-11-25', daysAway: 6 }, 0), false);
  assert.equal(isDueSoon(null, -100), false);
});
