import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, MAX_EDGE } from './image.ts';

test('a landscape photo is capped on its long edge', () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 1568, height: 1176 });
});

test('a portrait photo is capped on its long edge too', () => {
  assert.deepEqual(fitWithin(3024, 4032), { width: 1176, height: 1568 });
});

test('an image already within the cap is left alone', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test('an image exactly at the cap is left alone', () => {
  assert.deepEqual(fitWithin(MAX_EDGE, MAX_EDGE), { width: MAX_EDGE, height: MAX_EDGE });
});

test('an extreme panorama keeps at least one pixel of height', () => {
  assert.deepEqual(fitWithin(20000, 5), { width: 1568, height: 1 });
});

test('aspect ratio survives the downscale', () => {
  const { width, height } = fitWithin(3000, 2000);
  assert.ok(Math.abs(width / height - 1.5) < 0.01);
});
