import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appliedDiscountPercent, discountedUnitPrice, lineDiscountAmount } from '../src/utils/productDiscount.js';

test('only an active product discount reduces the price', () => {
  assert.equal(appliedDiscountPercent({ discountPercent: 50, discountActive: false }), 0);
  assert.equal(appliedDiscountPercent({ discountPercent: 50, discountActive: true }), 50);
  assert.equal(discountedUnitPrice(12.5, 50), 6.25);
  assert.equal(lineDiscountAmount(12.5, 2, 50), 12.5);
  assert.equal(lineDiscountAmount(12.5, 2, 0), 0);
});
