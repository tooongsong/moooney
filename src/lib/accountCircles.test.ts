import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCircles } from './accountCircles.ts';

const OPTS = { min: 44, max: 140, minStep: 8 };
const a = (name: string, type: string, balance: number) => ({ name, type, balance });

test('circles are ordered by magnitude, largest first', () => {
  const out = accountCircles([
    a('Small', 'checking', 100),
    a('Big', 'savings', 9000),
    a('Mid', 'checking', 500),
  ], OPTS);
  assert.deepEqual(out.map((c) => c.name), ['Big', 'Mid', 'Small']);
});

test('a negative balance is sized by its magnitude, not dropped or NaN', () => {
  const out = accountCircles([a('Card', 'credit_card', -5000), a('Cash', 'checking', 100)], OPTS);
  assert.equal(out[0].name, 'Card');
  assert.ok(Number.isFinite(out[0].size));
  assert.equal(out[0].size, OPTS.max);
});

test('every size is finite even when every balance is negative', () => {
  // One real account looks exactly like this.
  const out = accountCircles([
    a('A', 'checking', -3311.05), a('B', 'savings', -7250.27), a('C', 'credit_card', -9225.15),
  ], OPTS);
  assert.ok(out.every((c) => Number.isFinite(c.size)));
  assert.ok(out.every((c) => c.size >= OPTS.min && c.size <= OPTS.max));
});

test('adjacent ranks stay at least a step apart', () => {
  const out = accountCircles([
    a('A', 'checking', 1000), a('B', 'checking', 990), a('C', 'checking', 980),
  ], OPTS);
  assert.ok(out[0].size - out[1].size >= OPTS.minStep - 0.02);
  assert.ok(out[1].size - out[2].size >= OPTS.minStep - 0.02);
});

test('owing is true for a liability with a balance owed', () => {
  assert.equal(accountCircles([a('Card', 'credit_card', -500)], OPTS)[0].owing, true);
});

test('owing is true for an asset that has gone negative — the sign is what matters', () => {
  assert.equal(accountCircles([a('Checking', 'checking', -3311.05)], OPTS)[0].owing, true);
});

test('owing is false for a liability that is paid off or in credit', () => {
  assert.equal(accountCircles([a('Card', 'credit_card', 0)], OPTS)[0].owing, false);
  assert.equal(accountCircles([a('Card', 'credit_card', 120)], OPTS)[0].owing, false);
});

test('owing is false for an asset in the black', () => {
  assert.equal(accountCircles([a('Savings', 'savings', 8000)], OPTS)[0].owing, false);
});

test('the balance is carried through with its sign intact', () => {
  const out = accountCircles([a('Card', 'credit_card', -9225.15)], OPTS);
  assert.equal(out[0].balance, -9225.15);
});

test('an empty list gives an empty list', () => {
  assert.deepEqual(accountCircles([], OPTS), []);
});

test('all-zero balances still produce finite sizes at the floor', () => {
  const out = accountCircles([a('A', 'checking', 0), a('B', 'checking', 0)], OPTS);
  assert.ok(out.every((c) => Number.isFinite(c.size) && c.size >= OPTS.min));
});
