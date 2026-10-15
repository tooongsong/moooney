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
  return { anchorDate: '2026-01-15', cycle: 'monthly', status: 'active', endedOn: null, ...over };
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

test('a paused subscription stops at today — the past happened, the future is suspended', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-08-05', status: 'paused' }), '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-08-05', '2026-09-05', '2026-10-05']);
});

test('an ended subscription stops at ended_on', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-05-05', status: 'ended', endedOn: '2026-07-31' }),
    '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-05-05', '2026-06-05', '2026-07-05']);
});

test('an ended subscription with no ended_on falls back to today rather than running forever', () => {
  const out = occurrencesBetween(
    sub({ anchorDate: '2026-08-05', status: 'ended' }), '2026-01-01', '2027-01-31', TODAY);
  assert.deepEqual(out, ['2026-08-05', '2026-09-05', '2026-10-05']);
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

test('a paused subscription has no next payment, though its past occurrences remain', () => {
  assert.equal(nextOccurrence(sub({ status: 'paused' }), TODAY, TODAY), null);
  assert.deepEqual(
    occurrencesBetween(sub({ status: 'paused' }), '2026-09-01', '2026-12-31', TODAY),
    ['2026-09-15', '2026-10-15'],
  );
});

test('an ended subscription has no next payment either', () => {
  assert.equal(
    nextOccurrence(sub({ status: 'ended', endedOn: '2026-09-30' }), TODAY, TODAY), null);
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
