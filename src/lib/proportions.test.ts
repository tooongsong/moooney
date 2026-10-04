import test from 'node:test';
import assert from 'node:assert/strict';
import { proportions } from './proportions.ts';

test('each amount is its share of the largest', () => {
  assert.deepEqual(proportions([100, 50, 25]), [1, 0.5, 0.25]);
});

test('sign is ignored — the rule shows size, not direction', () => {
  assert.deepEqual(proportions([-100, 50]), [1, 0.5]);
});

test('a single row gets no rule, because there is nothing to compare it to', () => {
  assert.deepEqual(proportions([42]), [null]);
});

test('an empty set gives an empty set', () => {
  assert.deepEqual(proportions([]), []);
});

test('all-zero amounts give no rules rather than dividing by zero', () => {
  assert.deepEqual(proportions([0, 0]), [null, null]);
});

test('order is preserved so rules stay aligned with their rows', () => {
  assert.deepEqual(proportions([10, 100, 55]), [0.1, 1, 0.55]);
});
