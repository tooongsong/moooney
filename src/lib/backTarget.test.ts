import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_PARAM, withBackTarget, safeBackTarget } from './backTarget.ts';

const FALLBACK = '/history';

// ── withBackTarget ───────────────────────────────────────────────────────────

test('the caller location rides along as a query param', () => {
  assert.equal(withBackTarget('/history/abc', '/overview'), '/history/abc?from=%2Foverview');
});

test('a location with its own query survives intact', () => {
  assert.equal(
    withBackTarget('/history/abc', '/overview?period=month&category=Car'),
    '/history/abc?from=%2Foverview%3Fperiod%3Dmonth%26category%3DCar',
  );
});

test('a href that already has a query keeps it', () => {
  assert.equal(withBackTarget('/history/abc?x=1', '/'), '/history/abc?x=1&from=%2F');
});

test('an empty origin is left off rather than written as blank', () => {
  assert.equal(withBackTarget('/history/abc', ''), '/history/abc');
});

// ── safeBackTarget — the value comes from the URL, so it is untrusted ────────

test('a same-origin path is returned as given', () => {
  assert.equal(safeBackTarget('/overview?category=Car', FALLBACK), '/overview?category=Car');
  assert.equal(safeBackTarget('/', FALLBACK), '/');
});

test('an absolute URL is refused — this would be an open redirect', () => {
  for (const bad of [
    'https://evil.example',
    'http://evil.example',
    '//evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
  ]) {
    assert.equal(safeBackTarget(bad, FALLBACK), FALLBACK, `should refuse ${bad}`);
  }
});

test('a backslash cannot be used to fake a protocol-relative URL', () => {
  // Browsers have historically read /\evil.example as //evil.example.
  assert.equal(safeBackTarget('/\\evil.example', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('\\\\evil.example', FALLBACK), FALLBACK);
});

test('anything not starting with a slash is refused', () => {
  assert.equal(safeBackTarget('overview', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('../../etc', FALLBACK), FALLBACK);
});

test('leading or trailing whitespace cannot smuggle a scheme past the check', () => {
  assert.equal(safeBackTarget(' /overview', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('/overview ', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget(' https://evil.example', FALLBACK), FALLBACK);
});

test('control characters are refused', () => {
  assert.equal(safeBackTarget('/over\nview', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('/over\tview', FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('/over\u0000view', FALLBACK), FALLBACK);
});

test('an interior space is fine — the value arrives decoded, so a search term keeps its spaces', () => {
  assert.equal(safeBackTarget('/history?q=trader joe', FALLBACK), '/history?q=trader joe');
});

test('missing, empty and non-string values fall back', () => {
  assert.equal(safeBackTarget(undefined, FALLBACK), FALLBACK);
  assert.equal(safeBackTarget(null, FALLBACK), FALLBACK);
  assert.equal(safeBackTarget('', FALLBACK), FALLBACK);
});

test('a round trip through withBackTarget comes back unchanged', () => {
  const origin = '/overview?period=month&category=Food %26 Dining';
  const href = withBackTarget('/history/abc', origin);
  const got = new URLSearchParams(href.split('?')[1]).get(BACK_PARAM);
  assert.equal(safeBackTarget(got, FALLBACK), origin);
});
