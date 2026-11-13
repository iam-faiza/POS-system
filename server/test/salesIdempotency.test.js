const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { createSaleRouter } = require('../routes/saleRoutes');
const { PERMISSIONS } = require('../utils/permissions');
const { checkoutRequestHash, parseCheckoutRequest } = require('../services/checkoutService');

const cashierA = '507f1f77bcf86cd799439012';
const cashierB = '507f1f77bcf86cd799439099';
const productId = '507f1f77bcf86cd799439011';

async function withHttpServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function makeRequestBody(quantity = 1) {
  return {
    items: [{ productId, quantity }],
    paymentMethod: 'cash',
    discount: 0
  };
}

async function postSale(baseUrl, idempotencyKey, body = makeRequestBody(), reservationToken) {
  return fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(reservationToken ? { 'Checkout-Attempt-Token': reservationToken } : {})
    },
    body: JSON.stringify(body)
  });
}

async function reserveAttempt(baseUrl, idempotencyKey, body = makeRequestBody()) {
  return fetch(`${baseUrl}/api/sales/attempts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
}

test('checkout route requires a key, replays original results, rejects payload conflicts, and scopes keys by cashier', async () => {
  const records = [];
  const attempts = new Map();
  let actorId = cashierA;
  let serviceCalls = 0;
  let shiftAvailable = true;
  const SaleModel = {
    findOne(filter) {
      const record = records.find((sale) =>
        String(sale.cashier) === String(filter.cashier) && sale.idempotencyKey === filter.idempotencyKey
      ) || null;
      return { select: async () => record };
    }
  };
  class CheckoutAttemptModel {
    constructor(data) { Object.assign(this, data); }
    async save() {
      const key = `${String(this.cashier)}:${this.idempotencyKey}`;
      if (attempts.has(key)) {
        const duplicate = new Error('duplicate attempt');
        duplicate.code = 11000;
        throw duplicate;
      }
      attempts.set(key, this);
      return this;
    }
    static async findOne({ cashier, idempotencyKey }) {
      return attempts.get(`${String(cashier)}:${idempotencyKey}`) || null;
    }
    static async updateOne(filter, update) {
      const attempt = attempts.get(`${String(filter.cashier)}:${filter.idempotencyKey}`);
      if (!attempt || (filter.status && attempt.status !== filter.status)) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(attempt, update.$set || {});
      for (const field of Object.keys(update.$unset || {})) delete attempt[field];
      return { matchedCount: 1, modifiedCount: 1 };
    }
    static async findOneAndUpdate(filter, update) {
      const attempt = attempts.get(`${String(filter.cashier)}:${filter.idempotencyKey}`);
      if (!attempt || Object.entries(filter).some(([field, value]) =>
        !['cashier', 'idempotencyKey'].includes(field) && String(attempt[field]) !== String(value))) return null;
      Object.assign(attempt, update.$set || {});
      for (const field of Object.keys(update.$unset || {})) delete attempt[field];
      return attempt;
    }
  }
  const app = express();
  app.use(express.json());
  app.use('/api/sales', createSaleRouter({
    SaleModel,
    CheckoutAttemptModel,
    ShiftModel: { findOne: async () => shiftAvailable ? { _id: 'shift-1' } : null },
    protectMiddleware(req, res, next) {
      req.user = { id: actorId, role: 'cashier', permissions: [PERMISSIONS.SALES_CREATE] };
      next();
    },
    createSaleService: async ({ body, cashierId, idempotencyKey, reservationToken, models }) => {
      serviceCalls += 1;
      const checkoutHash = checkoutRequestHash(parseCheckoutRequest(body, cashierId, { taxRate: 5, maxDiscountPercent: 100 }));
      const sale = {
        _id: `sale-${serviceCalls}`,
        invoiceNumber: `INV-${serviceCalls}`,
        cashier: cashierId,
        idempotencyKey,
        checkoutRequestHash: checkoutHash,
        total: 10
      };
      records.push(sale);
      const attempt = await models.CheckoutAttempt.findOne({ cashier: cashierId, idempotencyKey });
      assert.equal(attempt.reservationToken, reservationToken);
      attempt.status = 'completed';
      attempt.sale = sale._id;
      delete attempt.reservationToken;
      const response = { ...sale };
      delete response.idempotencyKey;
      delete response.checkoutRequestHash;
      return response;
    }
  }));

  await withHttpServer(app, async (baseUrl) => {
    let response = await postSale(baseUrl, null);
    assert.equal(response.status, 400);
    assert.equal(serviceCalls, 0);

    const key = randomUUID();
    response = await reserveAttempt(baseUrl, key);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'reserved');
    response = await fetch(`${baseUrl}/api/sales/attempts/${key}`);
    const reconciledReservation = await response.json();
    assert.equal(reconciledReservation.status, 'retryable');
    response = await reserveAttempt(baseUrl, key);
    const activeReservation = await response.json();
    assert.equal(activeReservation.status, 'reserved');

    response = await postSale(baseUrl, key, makeRequestBody(), activeReservation.reservationToken);
    const original = await response.json();
    assert.equal(response.status, 201, JSON.stringify(original));
    assert.equal(original.invoiceNumber, 'INV-1');
    assert.equal(original.idempotencyKey, undefined);

    shiftAvailable = false;
    response = await postSale(baseUrl, key);
    assert.equal(response.status, 200);
    const replay = await response.json();
    assert.equal(replay.invoiceNumber, original.invoiceNumber);
    assert.equal(replay._id, original._id);
    assert.equal(serviceCalls, 1);
    response = await fetch(`${baseUrl}/api/sales/attempts/${key}`);
    const reconciled = await response.json();
    assert.equal(reconciled.status, 'completed');
    assert.equal(reconciled.sale.invoiceNumber, original.invoiceNumber);

    actorId = cashierB;
    response = await fetch(`${baseUrl}/api/sales/attempts/${key}`);
    assert.deepEqual(await response.json(), { status: 'not_found' });
    actorId = cashierA;

    const processingKey = randomUUID();
    response = await reserveAttempt(baseUrl, processingKey);
    assert.equal(response.status, 200);
    const processingAttempt = attempts.get(`${cashierA}:${processingKey}`);
    processingAttempt.status = 'processing';
    processingAttempt.ownerToken = 'active-worker-token';
    processingAttempt.leaseExpiresAt = new Date(Date.now() + 60_000);
    response = await fetch(`${baseUrl}/api/sales/attempts/${processingKey}`);
    assert.deepEqual(await response.json(), { status: 'processing' });
    response = await reserveAttempt(baseUrl, processingKey);
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: 'processing' });

    response = await postSale(baseUrl, key, makeRequestBody(2));
    assert.equal(response.status, 409);
    assert.equal(serviceCalls, 1);

    shiftAvailable = true;
    actorId = cashierB;
    response = await reserveAttempt(baseUrl, key);
    assert.equal(response.status, 200);
    const cashierBReservation = await response.json();
    response = await postSale(baseUrl, key, makeRequestBody(), cashierBReservation.reservationToken);
    assert.equal(response.status, 201);
    const otherCashierSale = await response.json();
    assert.notEqual(otherCashierSale._id, original._id);
    assert.equal(serviceCalls, 2);

    actorId = cashierA;
    const newKey = randomUUID();
    response = await reserveAttempt(baseUrl, newKey);
    assert.equal(response.status, 200);
    const newReservation = await response.json();
    response = await postSale(baseUrl, newKey, makeRequestBody(), newReservation.reservationToken);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).invoiceNumber, 'INV-3');
    assert.equal(serviceCalls, 3);
  });
});