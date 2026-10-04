import test from 'node:test';
import assert from 'node:assert/strict';
import { entryDelta, runningBalances, type LedgerItem } from './ledger.ts';

const ACCOUNT = { id: 'acct-1', name: 'BOA0788' };
const OTHER = { id: 'acct-2', name: 'CMB7181' };

const txn = (over: Partial<Extract<LedgerItem, { kind: 'transaction' }>> = {}): LedgerItem => ({
  kind: 'transaction', type: 'expense', amount: 10,
  paymentMethod: ACCOUNT.name, paymentMethodId: ACCOUNT.id, ...over,
});

const tfer = (over: Partial<Extract<LedgerItem, { kind: 'transfer' }>> = {}): LedgerItem => ({
  kind: 'transfer', amount: 10,
  fromAccount: OTHER.name, fromAccountId: OTHER.id,
  toAccount: ACCOUNT.name, toAccountId: ACCOUNT.id, ...over,
});

// ── entryDelta: the sign rules ───────────────────────────────────────────────

test('an expense takes money out', () => {
  assert.equal(entryDelta(txn({ type: 'expense', amount: 25.5 }), ACCOUNT), -25.5);
});

test('income and refunds put money in', () => {
  assert.equal(entryDelta(txn({ type: 'income', amount: 100 }), ACCOUNT), 100);
  assert.equal(entryDelta(txn({ type: 'refund', amount: 30 }), ACCOUNT), 30);
});

test('a balance adjustment is already signed and is added as it stands', () => {
  assert.equal(entryDelta(txn({ type: 'balance_adjustment', amount: 100 }), ACCOUNT), 100);
  assert.equal(entryDelta(txn({ type: 'balance_adjustment', amount: -250 }), ACCOUNT), -250);
});

test('an unrecognised type moves nothing, matching the shared aggregator', () => {
  assert.equal(entryDelta(txn({ type: 'something_new', amount: 99 }), ACCOUNT), 0);
});

test('a transaction on another account does not move this one', () => {
  assert.equal(entryDelta(txn({ paymentMethod: OTHER.name, paymentMethodId: OTHER.id }), ACCOUNT), 0);
});

// ── entryDelta: transfers have a direction ───────────────────────────────────

test('a transfer into the account adds, out of it subtracts', () => {
  assert.equal(entryDelta(tfer({ amount: 40 }), ACCOUNT), 40);
  assert.equal(entryDelta(tfer({
    amount: 40,
    fromAccount: ACCOUNT.name, fromAccountId: ACCOUNT.id,
    toAccount: OTHER.name, toAccountId: OTHER.id,
  }), ACCOUNT), -40);
});

test('a transfer from an account to itself nets to zero', () => {
  assert.equal(entryDelta(tfer({
    amount: 40,
    fromAccount: ACCOUNT.name, fromAccountId: ACCOUNT.id,
    toAccount: ACCOUNT.name, toAccountId: ACCOUNT.id,
  }), ACCOUNT), 0);
});

test('a transfer touching neither side of this account moves nothing', () => {
  assert.equal(entryDelta(tfer({
    fromAccount: OTHER.name, fromAccountId: OTHER.id,
    toAccount: 'CHA6527', toAccountId: 'acct-3',
  }), ACCOUNT), 0);
});

// ── entryDelta: legacy rows carry a name but no id ───────────────────────────

test('a legacy row with no id is matched on name', () => {
  assert.equal(entryDelta(txn({ paymentMethodId: null, amount: 12 }), ACCOUNT), -12);
  assert.equal(entryDelta(tfer({ toAccountId: null, amount: 12 }), ACCOUNT), 12);
});

test('the id wins when it disagrees with the name, so a rename cannot double-count', () => {
  // Row points at this account by id while still carrying the account's old name.
  assert.equal(entryDelta(txn({ paymentMethod: 'Old Name', paymentMethodId: ACCOUNT.id, amount: 5 }), ACCOUNT), -5);
  // Row points elsewhere by id but happens to carry this account's name.
  assert.equal(entryDelta(txn({ paymentMethod: ACCOUNT.name, paymentMethodId: OTHER.id, amount: 5 }), ACCOUNT), 0);
});

// ── runningBalances ──────────────────────────────────────────────────────────

test('runningBalances starts from the opening balance and accumulates in order', () => {
  const out = runningBalances(100, [
    txn({ type: 'expense', amount: 30 }),
    txn({ type: 'income', amount: 50 }),
    txn({ type: 'expense', amount: 20 }),
  ], ACCOUNT);
  assert.deepEqual(out.map((o) => o.balanceAfter), [70, 120, 100]);
});

test('runningBalances carries a negative opening balance through', () => {
  const out = runningBalances(-1725.95, [txn({ type: 'expense', amount: 100 })], ACCOUNT);
  assert.equal(out[0].balanceAfter, -1825.95);
});

test('runningBalances returns nothing for an account with no entries', () => {
  assert.deepEqual(runningBalances(0, [], ACCOUNT), []);
});

test('runningBalances keeps the original item fields alongside the balance', () => {
  const [row] = runningBalances(0, [txn({ type: 'expense', amount: 7 })], ACCOUNT);
  assert.equal(row.kind, 'transaction');
  assert.equal(row.amount, 7);
  assert.equal(row.balanceAfter, -7);
});

test('runningBalances rounds to cents so a long chain cannot drift', () => {
  // 0.1 + 0.2 in floating point is 0.30000000000000004; a per-row balance would
  // show that drift on screen.
  const out = runningBalances(0, [
    txn({ type: 'income', amount: 0.1 }),
    txn({ type: 'income', amount: 0.2 }),
  ], ACCOUNT);
  assert.deepEqual(out.map((o) => o.balanceAfter), [0.1, 0.3]);
});

test('runningBalances ends on the account balance the detail header shows', () => {
  // The real BOA0788 shape: an opening balance plus expenses.
  const out = runningBalances(-1725.95, [
    txn({ type: 'expense', amount: 1350.82 }),
    txn({ type: 'expense', amount: 523.98 }),
    txn({ type: 'expense', amount: 2730.0 }),
  ], ACCOUNT);
  assert.equal(out[out.length - 1].balanceAfter, -6330.75);
});
