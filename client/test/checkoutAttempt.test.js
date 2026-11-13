import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearCheckoutAttempt,
  fingerprintCheckoutPayload,
  loadCheckoutAttempt,
  saveCheckoutAttempt
} from '../src/utils/checkoutAttempt.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const checkout = {
  customer: 'customer-id',
  items: [{ productId: 'product-id', name: 'Current label', sku: 'SKU-1', quantity: 2, price: 4.5 }],
  subtotal: 9,
  tax: 0.45,
  discount: 0,
  total: 9.45,
  paymentMethod: 'cash',
  cashReceived: 10
};

test('checkout fingerprint follows server idempotency fields and excludes display-only totals', async () => {
  const original = await fingerprintCheckoutPayload(checkout);
  const displayChanges = await fingerprintCheckoutPayload({
    ...checkout,
    items: [{ ...checkout.items[0], name: 'Renamed item', price: 99 }],
    subtotal: 198,
    tax: 9.9,
    total: 207.9
  });
  const changedTender = await fingerprintCheckoutPayload({ ...checkout, cashReceived: 11 });

  assert.match(original, /^[0-9a-f]{64}$/);
  assert.equal(displayChanges, original);
  assert.notEqual(changedTender, original);
});

test('pending checkout metadata survives reload through localStorage and clears only after success', () => {
  const storage = memoryStorage();
  const storageKey = 'pos_checkout_attempt_user-1';
  const attempt = {
    key: '47f4ca0e-77ee-4bc4-9232-d997ba90d1d2',
    fingerprint: 'a'.repeat(64)
  };

  assert.equal(saveCheckoutAttempt(storageKey, attempt, storage), true);
  const persisted = storage.getItem(storageKey);
  assert.doesNotMatch(persisted, /cashReceived|customer-id|product-id/);
  assert.deepEqual(loadCheckoutAttempt(storageKey, storage), attempt);
  clearCheckoutAttempt(storageKey, storage);
  assert.equal(loadCheckoutAttempt(storageKey, storage), null);
});
