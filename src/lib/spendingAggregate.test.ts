import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTransactions, trailingMonths } from './spendingAggregate.ts';

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

// ── trailingMonths — the data behind the overview's default right panel ──────

const row = (date: string, amount: number) =>
  ({ date, amount, type: 'expense', category: 'Food' });

test('trailingMonths returns exactly count buckets, oldest first', () => {
  const out = trailingMonths([], 2026, 9, 12);
  assert.equal(out.length, 12);
  assert.equal(out[0].key, '2025-10');
  assert.equal(out[11].key, '2026-09');
});

test('trailingMonths crosses a year boundary without skipping a month', () => {
  const out = trailingMonths([], 2026, 2, 4).map((b) => b.key);
  assert.deepEqual(out, ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('trailingMonths sums spend into the right bucket', () => {
  const out = trailingMonths([row('2026-09-27', 100), row('2026-09-02', 50), row('2026-08-15', 20)], 2026, 9, 3);
  assert.deepEqual(out.map((b) => [b.key, b.spend]), [['2026-07', 0], ['2026-08', 20], ['2026-09', 150]]);
});

test('trailingMonths ignores rows outside the window', () => {
  const out = trailingMonths([row('2024-01-05', 999), row('2026-09-01', 10)], 2026, 9, 2);
  assert.equal(out.reduce((s, b) => s + b.spend, 0), 10);
});

test('trailingMonths applies the same type rules as aggregateTransactions', () => {
  const rows = [
    { date: '2026-09-01', amount: 100, type: 'expense', category: 'Food' },
    { date: '2026-09-02', amount: 30, type: 'refund', category: 'Food' },
    { date: '2026-09-03', amount: 500, type: 'income', category: 'Salary' },
    { date: '2026-09-04', amount: 7, type: 'balance_adjustment', category: 'Other' },
  ];
  assert.equal(trailingMonths(rows, 2026, 9, 1)[0].spend, 70);
});
