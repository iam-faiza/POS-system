import assert from 'node:assert/strict';
import { test } from 'node:test';
import { niceMax, barRatio } from '../src/utils/chartMath.js';

test('niceMax rounds up to readable axis values', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(230), 250);
  assert.equal(niceMax(480), 500);
  assert.equal(niceMax(1200), 2000);
});

test('barRatio is clamped and safe for empty data', () => {
  assert.equal(barRatio(50, 200), 0.25);
  assert.equal(barRatio(300, 200), 1);
  assert.equal(barRatio(-5, 200), 0);
  assert.equal(barRatio(10, 0), 0);
});
