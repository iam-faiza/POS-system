const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { test } = require('node:test');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const CheckoutAttempt = require('../models/CheckoutAttempt');
const StockMovement = require('../models/StockMovement');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const { createSale, reserveCheckoutAttempt } = require('../services/checkoutService');

const integrationTest = process.env.RUN_MONGO_INTEGRATION === '1' ? test : test.skip;

integrationTest('MongoDB replica set enforces sale idempotency under concurrent checkout and transaction retry', async () => {
  const replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let connection;

  try {
    connection = await mongoose.createConnection(replicaSet.getUri(), {
      dbName: `pos_idempotency_${randomUUID().replace(/-/g, '')}`
    }).asPromise();
    const mongooseClient = {
      connection,
      startSession: connection.startSession.bind(connection)
    };
    const ProductModel = connection.model('Product', Product.schema);
    const SaleModel = connection.model('Sale', Sale.schema);
    const CheckoutAttemptModel = connection.model('CheckoutAttempt', CheckoutAttempt.schema);
    const StockMovementModel = connection.model('StockMovement', StockMovement.schema);
    const CategoryModel = connection.model('Category', Category.schema);
    const CustomerModel = connection.model('Customer', Customer.schema);
    await Promise.all([
      ProductModel.createIndexes(),
      SaleModel.createIndexes(),
      CheckoutAttemptModel.createIndexes(),
      StockMovementModel.createIndexes(),
      CategoryModel.createIndexes()
    ]);

    const idempotencyIndex = (await SaleModel.collection.indexes()).find((index) =>
      index.key.cashier === 1 && index.key.idempotencyKey === 1
    );
    assert.ok(idempotencyIndex, 'MongoDB has the cashier/idempotency unique index');
    assert.equal(idempotencyIndex.unique, true);
    assert.deepEqual(idempotencyIndex.partialFilterExpression, { idempotencyKey: { $type: 'string' } });

    const category = await CategoryModel.create({ name: 'Mongo Test' });
    const product = await ProductModel.create({
      name: 'Mongo test product',
      sku: 'MONGO-IDEMPOTENCY-1',
      category: category._id,
      price: 4.25,
      stockQuantity: 10,
      lowStockThreshold: 1
    });
    const cashierId = new mongoose.Types.ObjectId();
    const body = {
      items: [{ productId: String(product._id), quantity: 2 }],
      paymentMethod: 'cash',
      discount: 0
    };
    const key = randomUUID();
    const args = { body, cashierId: String(cashierId), idempotencyKey: key, env: {} };
    const models = {
      Product: ProductModel,
      Sale: SaleModel,
      CheckoutAttempt: CheckoutAttemptModel,
      Customer: CustomerModel,
      StockMovement: StockMovementModel
    };
    const reservation = await reserveCheckoutAttempt({ ...args, models });
    const reservedArgs = { ...args, reservationToken: reservation.reservationToken };

    const [first, repeated] = await Promise.all([
      createSale({ ...reservedArgs, models, mongooseClient }),
      createSale({ ...reservedArgs, models, mongooseClient })
    ]);

    assert.equal(String(first._id), String(repeated._id));
    assert.equal(first.invoiceNumber, repeated.invoiceNumber);
    assert.equal(await SaleModel.countDocuments({ cashier: cashierId, idempotencyKey: key }), 1);
    assert.equal((await ProductModel.findById(product._id)).stockQuantity, 8);
    assert.equal(await StockMovementModel.countDocuments({ sale: first._id, type: 'sale' }), 1);

    const storedSale = await SaleModel.findById(first._id).select('+idempotencyKey +checkoutRequestHash').lean();
    const { _id: _storedId, ...duplicateFields } = storedSale;
    await assert.rejects(
      new SaleModel({ ...duplicateFields, invoiceNumber: `INV-DUP-${randomUUID()}` }).save(),
      (error) => error.code === 11000
    );

    const retryKey = randomUUID();
    const failingModels = {
      Product: ProductModel,
      Sale: SaleModel,
      CheckoutAttempt: CheckoutAttemptModel,
      Customer: CustomerModel,
      StockMovement: class FailedStockMovement {
        constructor(data) { Object.assign(this, data); }
        async save() { throw new Error('injected movement failure'); }
      }
    };
    const retryArgs = {
      ...args,
      idempotencyKey: retryKey,
      body: { ...body, items: [{ productId: String(product._id), quantity: 1 }] }
    };
    const retryReservation = await reserveCheckoutAttempt({ ...retryArgs, models });
    await assert.rejects(
      createSale({
        ...retryArgs,
        reservationToken: retryReservation.reservationToken,
        models: { ...failingModels, CheckoutAttempt: CheckoutAttemptModel },
        mongooseClient
      }),
      /injected movement failure/
    );
    assert.equal(await SaleModel.countDocuments({ cashier: cashierId, idempotencyKey: retryKey }), 0);
    assert.equal((await ProductModel.findById(product._id)).stockQuantity, 8);

    const retried = await createSale({
      ...retryArgs,
      reservationToken: (await reserveCheckoutAttempt({ ...retryArgs, models })).reservationToken,
      models,
      mongooseClient
    });
    assert.ok(retried.invoiceNumber);
    assert.equal(await SaleModel.countDocuments({ cashier: cashierId, idempotencyKey: retryKey }), 1);
    assert.equal((await ProductModel.findById(product._id)).stockQuantity, 7);
    assert.equal(await StockMovementModel.countDocuments({ sale: retried._id, type: 'sale' }), 1);
  } finally {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
    await replicaSet.stop();
  }
});
