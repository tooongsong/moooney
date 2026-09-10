import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTransactions } from './spendingAggregate.ts';

test('expense adds to spend and category totals', () => {
  const r = aggregateTransactions([{ type: 'expense', amount: 50, category: 'Dining' }]);
  assert.equal(r.spend, 50);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 50 }]);
});

test('income adds to income, not spend, and does not create a category total', () => {
  const r = aggregateTransactions([{ type: 'income', amount: 1000, category: 'Salary' }]);
  assert.equal(r.income, 1000);
  assert.equal(r.spend, 0);
  assert.deepEqual(r.categoryTotals, []);
});

test('refund subtracts from overall spend but does not touch category totals', () => {
  // Matches getHomeData's original, unrefactored behavior exactly: the old
  // inline loop's refund branch only ever did `monthSpend -= amt` — it never
  // touched categoryTotals (only the expense branch does). This looks like an
  // asymmetry, but changing it would be a behavior change, and Task 2
  // requires getHomeData's output to stay byte-for-byte identical.
  const r = aggregateTransactions([
    { type: 'expense', amount: 100, category: 'Shopping' },
    { type: 'refund', amount: 30, category: 'Shopping' },
  ]);
  assert.equal(r.spend, 70);
  assert.deepEqual(r.categoryTotals, [{ name: 'Shopping', value: 100 }]);
});

test('balance_adjustment and any other unrecognized type contribute nothing', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 20, category: 'Dining' },
    { type: 'balance_adjustment', amount: 500, category: 'Balance Adjustment' },
    { type: 'some_future_type', amount: 999, category: 'Whatever' },
  ]);
  assert.equal(r.spend, 20);
  assert.equal(r.income, 0);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 20 }]);
});

test('net is income minus spend, can be negative', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 100, category: 'Dining' },
    { type: 'income', amount: 40, category: 'Salary' },
  ]);
  assert.equal(r.net, -60);
});

test('categoryTotals is sorted descending by value', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 10, category: 'Small' },
    { type: 'expense', amount: 90, category: 'Big' },
    { type: 'expense', amount: 40, category: 'Medium' },
  ]);
  assert.deepEqual(r.categoryTotals.map((c) => c.name), ['Big', 'Medium', 'Small']);
});

test('same category across multiple transactions sums together', () => {
  const r = aggregateTransactions([
    { type: 'expense', amount: 10, category: 'Dining' },
    { type: 'expense', amount: 15, category: 'Dining' },
  ]);
  assert.deepEqual(r.categoryTotals, [{ name: 'Dining', value: 25 }]);
});

test('empty input returns all-zero result', () => {
  const r = aggregateTransactions([]);
  assert.equal(r.spend, 0);
  assert.equal(r.income, 0);
  assert.equal(r.net, 0);
  assert.deepEqual(r.categoryTotals, []);
});
