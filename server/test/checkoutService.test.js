const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CheckoutError, createSale } = require('../services/checkoutService');

const cashierId = '507f1f77bcf86cd799439012';
const productId = '507f1f77bcf86cd799439011';

function createHarness({ stock = 5, failStockUpdate = false, failMovementSave = false, failSaleSave = false, topology = 'replicaSet' } = {}) {
  const state = {
    stock,
    sales: [],
    movements: [],
    updateAttempts: 0
  };
  let transactionQueue = Promise.resolve();

  class FakeSession {
    async withTransaction(callback) {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const before = { stock: state.stock, sales: [...state.sales], movements: [...state.movements] };
      try {
        return await callback();
      } catch (error) {
        state.stock = before.stock;
        state.sales = before.sales;
        state.movements = before.movements;
        throw error;
      } finally {
        release();
      }
    }

    async endSession() {}
  }

  class FakeSale {
    constructor(data) {
      Object.assign(this, data);
      this._id = '507f1f77bcf86cd799439013';
    }

    async save() {
      if (failSaleSave) throw new Error('simulated sale write failure');
      state.sales.push(this);
      return this;
    }
  }

  class FakeStockMovement {
    constructor(data) {
      Object.assign(this, data);
    }

    async save() {
      if (failMovementSave) throw new Error('simulated movement write failure');
      state.movements.push(this);
      return this;
    }
  }

  const product = () => ({
    _id: productId,
    name: 'Trusted item',
    sku: 'TRUSTED-1',
    price: 12.5,
    stockQuantity: state.stock,
    isArchived: false
  });

  const models = {
    Product: {
      find: () => ({ session: async () => [product()] }),
      updateOne: async (_filter, update) => {
        state.updateAttempts += 1;
        if (failStockUpdate) throw new Error('simulated inventory write failure');
        const quantity = -update.$inc.stockQuantity;
        if (state.stock < quantity) return { matchedCount: 0 };
        state.stock -= quantity;
        return { matchedCount: 1 };
      }
    },
    Customer: {
      findById: () => ({ session: async () => null })
    },
    Sale: FakeSale,
    StockMovement: FakeStockMovement
  };
  const mongooseClient = {
    connection: {
      db: {
        admin: () => ({
          command: async () => topology === 'standalone'
            ? { isWritablePrimary: true }
            : { setName: 'test-rs', isWritablePrimary: true }
        })
      }
    },
    startSession: async () => new FakeSession()
  };

  return { state, models, mongooseClient };
}

function request(overrides = {}) {
  return {
    items: [{ productId, quantity: 2, name: 'Forged item', sku: 'FORGED', price: 0.01 }],
    subtotal: 0.02,
    tax: 0,
    discount: 0,
    total: 0.02,
    paymentMethod: 'cash',
    ...overrides
  };
}

async function checkout(harness, body = request(), env = {}) {
  return createSale({
    body,
    cashierId,
    models: harness.models,
    mongooseClient: harness.mongooseClient,
    env
  });
}

test('uses product snapshots and calculates totals instead of trusting forged client amounts', async () => {
  const harness = createHarness();
  const sale = await checkout(harness);

  assert.equal(sale.items[0].name, 'Trusted item');
  assert.equal(sale.items[0].sku, 'TRUSTED-1');
  assert.equal(sale.items[0].price, 12.5);
  assert.equal(sale.subtotal, 25);
  assert.equal(sale.tax, 1.25);
  assert.equal(sale.total, 26.25);
  assert.equal(harness.state.stock, 3);
  assert.equal(harness.state.movements.length, 1);
  assert.equal(harness.state.movements[0].quantityDelta, -2);
  assert.equal(harness.state.movements[0].quantityBefore, 5);
  assert.equal(harness.state.movements[0].quantityAfter, 3);
  assert.equal(String(harness.state.movements[0].sale), sale._id);
});

test('uses configured tax rate and calculates cash tender/change on the server', async () => {
  const harness = createHarness();
  const sale = await checkout(harness, request({ cashReceived: 30 }), { POS_TAX_RATE: '8' });
  assert.equal(sale.taxRate, 8);
  assert.equal(sale.tax, 2);
  assert.equal(sale.total, 27);
  assert.equal(sale.cashReceived, 30);
  assert.equal(sale.changeDue, 3);
});

test('rejects insufficient or malformed cash tender without changing stock', async (t) => {
  for (const cashReceived of [26, -1, 1.001, '50', Infinity]) {
    await t.test(String(cashReceived), async () => {
      const harness = createHarness();
      await assert.rejects(
        checkout(harness, request({ cashReceived })),
        (error) => error.status === 400
      );
      assert.equal(harness.state.stock, 5);
      assert.equal(harness.state.sales.length, 0);
    });
  }
});

test('new simulated card sales store only card type metadata', async () => {
  const harness = createHarness();
  const sale = await checkout(harness, request({
    paymentMethod: 'card',
    paymentDetails: {
      cardType: 'Visa',
      cardholderName: 'Do not persist',
      last4: '4242',
      transactionRef: 'Do not persist'
    }
  }));
  assert.deepEqual(sale.paymentDetails, { cardType: 'Visa' });
  assert.equal(sale.cashReceived, undefined);
  assert.equal(sale.changeDue, undefined);
});

test('rejects invalid product IDs and non-positive, fractional, or string quantities', async (t) => {
  const cases = [
    { items: [{ productId: 'not-an-id', quantity: 1 }] },
    { items: [{ productId, quantity: 0 }] },
    { items: [{ productId, quantity: -1 }] },
    { items: [{ productId, quantity: 1.5 }] },
    { items: [{ productId, quantity: '1' }] }
  ];

  for (const body of cases) {
    await t.test(JSON.stringify(body.items[0]), async () => {
      const harness = createHarness();
      await assert.rejects(checkout(harness, request(body)), (error) => error.status === 400);
      assert.equal(harness.state.stock, 5);
      assert.equal(harness.state.sales.length, 0);
    });
  }
});

test('rejects a discount above the configured store limit', async () => {
  const harness = createHarness();
  await assert.rejects(
    checkout(harness, request({ discount: 25.01 }), { POS_MAX_DISCOUNT_PERCENT: '100' }),
    (error) => error instanceof CheckoutError && error.status === 400
  );
  assert.equal(harness.state.stock, 5);
  assert.equal(harness.state.sales.length, 0);
});

test('rejects insufficient stock without creating a sale', async () => {
  const harness = createHarness({ stock: 1 });
  await assert.rejects(checkout(harness), (error) => error.status === 409);
  assert.equal(harness.state.stock, 1);
  assert.equal(harness.state.sales.length, 0);
});

test('rolls back inventory when a stock update fails', async () => {
  const harness = createHarness({ failStockUpdate: true });
  await assert.rejects(checkout(harness), /simulated inventory write failure/);
  assert.equal(harness.state.stock, 5);
  assert.equal(harness.state.sales.length, 0);
  assert.equal(harness.state.movements.length, 0);
});

test('rolls back all state when sale creation fails', async () => {
  const harness = createHarness({ failSaleSave: true });
  await assert.rejects(checkout(harness), /simulated sale write failure/);
  assert.equal(harness.state.stock, 5);
  assert.equal(harness.state.sales.length, 0);
  assert.equal(harness.state.movements.length, 0);
});

test('rolls back sale and inventory when movement creation fails', async () => {
  const harness = createHarness({ failMovementSave: true });
  await assert.rejects(checkout(harness), /simulated movement write failure/);
  assert.equal(harness.state.stock, 5);
  assert.equal(harness.state.sales.length, 0);
  assert.equal(harness.state.movements.length, 0);
});

test('allows only one concurrent checkout for the final stock unit', async () => {
  const harness = createHarness({ stock: 1 });
  const body = request({ items: [{ productId, quantity: 1 }] });
  const results = await Promise.allSettled([
    checkout(harness, body),
    checkout(harness, body)
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(harness.state.stock, 0);
  assert.equal(harness.state.sales.length, 1);
});

test('fails closed when the connected MongoDB is standalone', async () => {
  const harness = createHarness({ topology: 'standalone' });
  await assert.rejects(checkout(harness), (error) => error.status === 503);
  assert.equal(harness.state.updateAttempts, 0);
  assert.equal(harness.state.stock, 5);
  assert.equal(harness.state.sales.length, 0);
});