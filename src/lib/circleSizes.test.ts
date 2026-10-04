import test from 'node:test';
import assert from 'node:assert/strict';
import { circleSizes } from './circleSizes.ts';

const OPTS = { min: 56, max: 168, minStep: 8 };

test('the largest value gets the full size', () => {
  assert.equal(circleSizes([100, 50, 10], OPTS)[0], 168);
});

test('sizes never increase down the list', () => {
  const out = circleSizes([23088.19, 1332, 646.8, 600, 338.04, 119.41], OPTS);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i] <= out[i - 1], `${out[i]} should not exceed ${out[i - 1]}`);
  }
});

test('adjacent ranks differ by at least the minimum step', () => {
  // The real August figures: ranks 3 and 4 are 7% apart and came out identical
  // under plain area scaling.
  const out = circleSizes([23088.19, 1332, 646.8, 600, 338.04, 119.41], OPTS);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1] - out[i] >= OPTS.minStep - 0.02,
      `rank ${i} and ${i + 1} are ${out[i - 1] - out[i]}px apart, want >= ${OPTS.minStep}`);
  }
});

test('area, not diameter, tracks the value — so a 4x value is 2x the diameter above the floor', () => {
  const [a, b] = circleSizes([100, 25], { min: 0, max: 100, minStep: 0 });
  assert.equal(a, 100);
  assert.equal(b, 50); // sqrt(25/100) = 0.5
});

test('nothing is ever drawn smaller than the floor', () => {
  const out = circleSizes([1000, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], OPTS);
  assert.ok(Math.min(...out) >= OPTS.min, `smallest was ${Math.min(...out)}`);
});

test('a long tail still separates until it reaches the floor, then stops', () => {
  const out = circleSizes(Array.from({ length: 20 }, (_, i) => 100 - i), OPTS);
  assert.equal(out[0], 168);
  assert.ok(Math.min(...out) >= OPTS.min);
  // Once the floor is reached the remaining ranks sit on it rather than being
  // pushed below: a size that cannot shrink further is better than a negative one.
  assert.equal(out[out.length - 1], OPTS.min);
});

test('equal values are still separated, because the ordering has to read', () => {
  const out = circleSizes([500, 500, 500], OPTS);
  assert.ok(out[0] - out[1] >= OPTS.minStep - 0.02);
  assert.ok(out[1] - out[2] >= OPTS.minStep - 0.02);
});

test('a single value is just the full size', () => {
  assert.deepEqual(circleSizes([42], OPTS), [168]);
});

test('an empty list gives an empty list', () => {
  assert.deepEqual(circleSizes([], OPTS), []);
});

test('all-zero values fall back to the floor rather than dividing by zero', () => {
  const out = circleSizes([0, 0, 0], OPTS);
  assert.ok(out.every((n) => Number.isFinite(n)));
  assert.ok(out.every((n) => n >= OPTS.min && n <= OPTS.max));
});

test('input order is assumed to be descending and is preserved', () => {
  // The caller sorts; this returns sizes positionally so names stay aligned.
  const out = circleSizes([300, 200, 100], OPTS);
  assert.equal(out.length, 3);
  assert.ok(out[0] > out[1] && out[1] > out[2]);
});

test('when the band cannot hold the requested step, every rank shares what there is', () => {
  // 20 ranks at 8px apart would need 152px of headroom; the band is 112.
  const out = circleSizes(Array.from({ length: 20 }, (_, i) => 100 - i), OPTS);
  const steps = out.slice(1).map((v, i) => out[i] - v);
  const shared = (OPTS.max - OPTS.min) / 19;
  for (const s of steps) assert.ok(Math.abs(s - shared) < 0.02, `step ${s}, want ${shared}`);
  assert.equal(out[0], OPTS.max);
  assert.equal(out[out.length - 1], OPTS.min);
});
