import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestCards, cleanRewards, formatRate, removeRewardCategory, renameRewardCategory,
  type RewardCard,
} from './bestCard.ts';

const card = (name: string, base: number, categories: Record<string, number> = {}): RewardCard =>
  ({ id: name.toLowerCase(), name, rewards: { base, categories } });

const CATS = ['Groceries', 'Car', 'Travel'];

test('no cards gives no rows and no fallback', () => {
  assert.deepEqual(bestCards([], CATS), { rows: [], fallback: null });
});

test('cards without rules are ignored', () => {
  const out = bestCards([{ id: 'a', name: 'A', rewards: null }], CATS);
  assert.deepEqual(out, { rows: [], fallback: null });
});

test('base only: no category rows, fallback is the best base', () => {
  const out = bestCards([card('A', 1), card('B', 2)], CATS);
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.fallback, { rate: 2, cards: [{ id: 'b', name: 'B' }] });
});

test('a category rate beats a base rate', () => {
  const out = bestCards([card('A', 1, { Groceries: 3 }), card('B', 2)], CATS);
  assert.deepEqual(out.rows, [{ category: 'Groceries', rate: 3, cards: [{ id: 'a', name: 'A' }] }]);
});

test("another card's base beats a lower category rate", () => {
  const out = bestCards([card('A', 1, { Groceries: 1.5 }), card('B', 2)], CATS);
  assert.deepEqual(out.rows, [{ category: 'Groceries', rate: 2, cards: [{ id: 'b', name: 'B' }] }]);
});

test('ties list every card that reaches the rate', () => {
  const out = bestCards([card('A', 1, { Car: 3 }), card('B', 1, { Car: 3 })], CATS);
  assert.deepEqual(out.rows[0].cards, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  assert.deepEqual(out.fallback!.cards, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
});

test('a rule for a category outside the list is skipped', () => {
  const out = bestCards([card('A', 1, { Gone: 5, Car: 2 })], CATS);
  assert.deepEqual(out.rows.map((r) => r.category), ['Car']);
});

test('rows are ordered by rate, then by category name', () => {
  const out = bestCards([card('A', 1, { Travel: 3, Car: 3, Groceries: 5 })], CATS);
  assert.deepEqual(out.rows.map((r) => r.category), ['Groceries', 'Car', 'Travel']);
});

test('cleanRewards accepts valid rates and trims category names', () => {
  assert.deepEqual(cleanRewards({ base: 1, categories: { ' Car ': 2.25 } }),
    { ok: true, rewards: { base: 1, categories: { Car: 2.25 } } });
});

test('cleanRewards stores null when there is nothing to store', () => {
  assert.deepEqual(cleanRewards({ base: 0, categories: {} }), { ok: true, rewards: null });
});

test('cleanRewards rejects out-of-range, non-finite and over-precise rates', () => {
  for (const bad of [-1, 100.01, Number.NaN, Number.POSITIVE_INFINITY, 1.234]) {
    assert.equal(cleanRewards({ base: bad, categories: {} }).ok, false, `base ${bad}`);
    assert.equal(cleanRewards({ base: 1, categories: { Car: bad } }).ok, false, `category ${bad}`);
  }
});

test('cleanRewards rejects a blank category name', () => {
  assert.equal(cleanRewards({ base: 1, categories: { '  ': 2 } }).ok, false);
});

test('renameRewardCategory moves the rate to the new key', () => {
  assert.deepEqual(renameRewardCategory({ base: 1, categories: { Old: 3, Car: 2 } }, 'Old', 'New'),
    { base: 1, categories: { Car: 2, New: 3 } });
});

test('renameRewardCategory returns the same object when the key is absent', () => {
  const r = { base: 1, categories: { Car: 2 } };
  assert.equal(renameRewardCategory(r, 'Old', 'New'), r);
});

test('removeRewardCategory drops the key', () => {
  assert.deepEqual(removeRewardCategory({ base: 1, categories: { Old: 3, Car: 2 } }, 'Old'),
    { base: 1, categories: { Car: 2 } });
});

test('removeRewardCategory returns null when nothing is left', () => {
  assert.equal(removeRewardCategory({ base: 0, categories: { Old: 3 } }, 'Old'), null);
});

test('removeRewardCategory returns the same object when the key is absent', () => {
  const r = { base: 1, categories: { Car: 2 } };
  assert.equal(removeRewardCategory(r, 'Old'), r);
});

test('formatRate prints a percentage without trailing zeros', () => {
  assert.equal(formatRate(3), '3%');
  assert.equal(formatRate(1.5), '1.5%');
});
