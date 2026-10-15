const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  parseDiscountPercent,
  parseDiscountActive,
  appliedDiscountPercent,
  lineDiscountCents
} = require('../utils/productDiscount');

test('empty discount means none; valid percents are kept', () => {
  assert.equal(parseDiscountPercent('').value, null);
  assert.equal(parseDiscountPercent(0).value, null);
  assert.equal(parseDiscountPercent(50).value, 50);
  assert.equal(parseDiscountPercent('12.5').value, 12.5);
});

test('discount percent rejects negatives, over 100, and extra decimals', () => {
  assert.match(parseDiscountPercent(-1).error, /between 0 and 100/);
  assert.match(parseDiscountPercent(101).error, /between 0 and 100/);
  assert.match(parseDiscountPercent(10.001).error, /two decimal/);
});

test('a discount applies only when it is active', () => {
  assert.equal(appliedDiscountPercent({ discountPercent: 50, discountActive: false }), 0);
  assert.equal(appliedDiscountPercent({ discountPercent: 50, discountActive: true }), 50);
  assert.equal(appliedDiscountPercent({ discountPercent: null, discountActive: true }), 0);
  assert.equal(parseDiscountActive(true, null), false);
  assert.equal(parseDiscountActive(true, 50), true);
});

test('line discount uses paisa rounding on the unit price', () => {
  assert.equal(lineDiscountCents(1250, 2, 50), 1250);
  assert.equal(lineDiscountCents(1250, 2, 0), 0);
});
