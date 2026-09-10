import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, computeBalanceAdjustment, isValidEnteredValue } from './balanceAdjustment.ts';

test('toCents rounds dollars to integer cents, including float-drift inputs', () => {
  assert.equal(toCents(148.9), 14890);
  assert.equal(toCents(0.1 + 0.2), 30); // 0.30000000000000004 in raw JS float
});

test('asset account: balance increasing', () => {
  const r = computeBalanceAdjustment({ currentBalance: 701.10, enteredValue: 850.00, isLiability: false });
  assert.equal(r.targetBalance, 850.00);
  assert.equal(r.deltaCents, 14890);
  assert.equal(r.deltaDollars, 148.90);
});

test('liability account: owed increasing (249.41 -> 300)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -249.41, enteredValue: 300, isLiability: true });
  assert.equal(r.targetBalance, -300);
  assert.equal(r.deltaCents, -5059);
  assert.equal(r.deltaDollars, -50.59);
});

test('liability account: owed decreasing (300 -> 100)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -300, enteredValue: 100, isLiability: true });
  assert.equal(r.targetBalance, -100);
  assert.equal(r.deltaCents, 20000);
  assert.equal(r.deltaDollars, 200.00);
});

test('liability account reaching exactly zero normalizes to +0, not -0', () => {
  const r = computeBalanceAdjustment({ currentBalance: -100, enteredValue: 0, isLiability: true });
  assert.equal(r.targetBalance, 0);
  assert.equal(Object.is(r.targetBalance, -0), false);
  assert.equal(r.deltaCents, 10000);
});

test('no-op when entered value equals current balance exactly (asset)', () => {
  const r = computeBalanceAdjustment({ currentBalance: 500, enteredValue: 500, isLiability: false });
  assert.equal(r.deltaCents, 0);
});

test('no-op when entered value equals current owed exactly (liability)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -249.41, enteredValue: 249.41, isLiability: true });
  assert.equal(r.deltaCents, 0);
});

test('cents precision survives a float-drift-prone current balance', () => {
  let drifted = 0;
  for (let i = 0; i < 3; i++) drifted += 0.1; // 0.30000000000000004
  const r = computeBalanceAdjustment({ currentBalance: drifted, enteredValue: 1, isLiability: false });
  assert.equal(r.deltaCents, 70);
});

test('isValidEnteredValue rejects negative owed for liability accounts', () => {
  assert.equal(isValidEnteredValue(-50, true), false);
  assert.equal(isValidEnteredValue(0, true), true);
  assert.equal(isValidEnteredValue(50, true), true);
});

test('isValidEnteredValue allows negative for asset accounts (overdrawn checking)', () => {
  assert.equal(isValidEnteredValue(-50, false), true);
});

test('isValidEnteredValue rejects non-finite input', () => {
  assert.equal(isValidEnteredValue(NaN, false), false);
});
