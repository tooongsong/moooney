import test from 'node:test';
import assert from 'node:assert/strict';
import { firstGrapheme, formatDate, isSingleGrapheme, parseAmountInput, toDateInputValue } from './utils.ts';

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
  for (const bad of ['', '   ', 'abc', '1.2.3', '1-2', '12px', '--5', '1e5']) {
    assert.ok(Number.isNaN(parseAmountInput(bad)), `${JSON.stringify(bad)} should be NaN`);
  }
});

test('an empty string is not one grapheme', () => {
  // The caller guards with `emoji &&`, but the predicate should not claim
  // that nothing is something.
  assert.equal(isSingleGrapheme(''), false);
});
