const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const { test } = require('node:test');
const Product = require('../models/Product');
const { createCategoryRouter } = require('../routes/categoryRoutes');
const { validateProduct, normalizeSku } = require('../routes/productRoutes');
const { categoryNameError, normalizeCategoryKey, normalizeCategoryName } = require('../utils/categoryValidation');
const { parseStockInteger } = require('../utils/inventoryValidation');
const { saveInventoryAdjustment } = require('../services/inventoryService');
const { validateCustomer, validatePhone, formatCustomerName } = require('../utils/customerValidation');

const categoryId = '507f1f77bcf86cd799439011';
const secondCategoryId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439013';

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

function createCategoryHarness({ role = 'admin', referenced = false, initial = [] } = {}) {
  const categories = initial.map((item) => ({ ...item }));

  class FakeCategory {
    constructor(data) {
      Object.assign(this, data);
      this._id ||= new mongoose.Types.ObjectId().toString();
    }

    async save() {
      const conflict = categories.find((item) => item._id !== this._id && item.normalizedName === this.normalizedName);
      if (conflict) {
        const error = new Error('duplicate');
        error.code = 11000;
        throw error;
      }
      const index = categories.findIndex((item) => item._id === this._id);
      if (index < 0) categories.push(this);
      else categories[index] = this;
      return this;
    }

    async deleteOne() {
      const index = categories.findIndex((item) => item._id === this._id);
      if (index >= 0) categories.splice(index, 1);
    }
  }

  FakeCategory.find = async (filter = {}) => categories.filter((item) => {
    if (filter._id?.$ne) return item._id !== filter._id.$ne;
    return true;
  });
  FakeCategory.findById = (id) => {
    const stored = categories.find((item) => item._id === String(id));
    const promise = Promise.resolve(stored ? new FakeCategory(stored) : null);
    promise.session = () => promise;
    return promise;
  };
  FakeCategory.updateOne = async () => ({ matchedCount: 1 });

  const ProductModel = {
    findOne: () => {
      const promise = Promise.resolve(referenced ? { _id: secondCategoryId } : null);
      promise.session = () => promise;
      return promise;
    }
  };
  const mongooseClient = {
    startSession: async () => ({
      withTransaction: async (callback) => callback(),
      endSession: async () => {}
    })
  };
  const app = express();
  app.use(express.json());
  app.use('/api/categories', createCategoryRouter({
    CategoryModel: FakeCategory,
    ProductModel,
    mongooseClient,
    protectMiddleware(req, res, next) {
      req.user = { id: userId, role };
      next();
    }
  }));
  return { app, categories };
}

test('stock quantity parser rejects fractional, negative, non-finite, and unsafe inputs', () => {
  for (const invalid of [-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '', '1.5', '-1', 'Infinity', true]) {
    assert.equal(parseStockInteger(invalid), null);
  }
  assert.equal(parseStockInteger(0), 0);
  assert.equal(parseStockInteger('12'), 12);
});

test('product validation preserves uppercase SKU rules and requires a valid category ID', () => {
  assert.equal(normalizeSku(' abc-1 '), 'ABC-1');
  assert.equal(validateProduct({
    name: 'A product', sku: 'abc-1', category: categoryId,
    price: 1, stockQuantity: 2, lowStockThreshold: 1
  }), null);
  assert.match(validateProduct({
    name: 'A product', sku: 'abc-1', category: 'bad-id',
    price: 1, stockQuantity: 2, lowStockThreshold: 1
  }), /Category/);
  assert.match(validateProduct({
    name: 'A product', sku: 'abc-1', category: categoryId,
    price: 1, stockQuantity: 1.25, lowStockThreshold: 1
  }), /safe whole number/);
});

test('Mongoose Product schema rejects unsafe inventory values', async () => {
  for (const invalid of [-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const product = new Product({
      name: 'Schema test', sku: `TEST_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      category: categoryId, price: 1, stockQuantity: invalid, lowStockThreshold: 0
    });
    await assert.rejects(product.validate());
  }
  const badThreshold = new Product({
    name: 'Schema test', sku: 'TEST_THRESH', category: categoryId,
    price: 1, stockQuantity: 1, lowStockThreshold: 1.5
  });
  await assert.rejects(badThreshold.validate());
});

test('inventory adjustment writes a movement and rolls back if its insert fails', async () => {
  const state = { stock: 4, movements: [] };
  const product = {
    _id: '507f1f77bcf86cd799439014',
    stockQuantity: state.stock,
    async save() {
      state.stock = this.stockQuantity;
      return this;
    }
  };
  const makeSession = () => ({
    async withTransaction(callback) {
      const before = { stock: state.stock, movements: [...state.movements] };
      try {
        return await callback();
      } catch (error) {
        state.stock = before.stock;
        state.movements = before.movements;
        product.stockQuantity = before.stock;
        throw error;
      }
    }
  });

  class Movement {
    constructor(data) { Object.assign(this, data); }
    async save() { state.movements.push(this); return this; }
  }

  await makeSession().withTransaction(() => saveInventoryAdjustment({
    product, quantityAfter: 7, userId, reason: 'Count correction',
    session: {}, StockMovementModel: Movement
  }));
  assert.equal(state.stock, 7);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].quantityDelta, 3);
  assert.equal(state.movements[0].quantityBefore, 4);
  assert.equal(state.movements[0].quantityAfter, 7);
  assert.equal(state.movements[0].reason, 'Count correction');

  class FailingMovement extends Movement {
    async save() { throw new Error('movement insert failed'); }
  }
  await assert.rejects(makeSession().withTransaction(() => saveInventoryAdjustment({
    product, quantityAfter: 2, userId, reason: 'Correction',
    session: {}, StockMovementModel: FailingMovement
  })), /movement insert failed/);
  assert.equal(state.stock, 7);
  assert.equal(state.movements.length, 1);
});

test('category names trim, normalize case, and reject malformed values', () => {
  assert.equal(normalizeCategoryName('  Home   & Garden  '), 'Home & Garden');
  assert.equal(normalizeCategoryKey('Home & Garden'), normalizeCategoryKey(' home & garden '));
  assert.equal(categoryNameError('X'), 'Category name must be at least 2 characters');
  assert.equal(categoryNameError('!!!'), 'Category name contains invalid characters');
  assert.equal(categoryNameError('Home & Garden'), null);
});

test('category routes reject duplicate names, invalid IDs, referenced deletes, and cashier writes', async () => {
  const existingCategory = {
    _id: categoryId,
    name: 'Grocery',
    normalizedName: 'grocery'
  };
  const harness = createCategoryHarness({ initial: [existingCategory] });
  await withHttpServer(harness.app, async (baseUrl) => {
    const duplicate = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  GROCERY  ' })
    });
    assert.equal(duplicate.status, 409);

    const edited = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Dry   Goods ' })
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).name, 'Dry Goods');

    const invalidId = await fetch(`${baseUrl}/api/categories/not-an-id`, { method: 'DELETE' });
    assert.equal(invalidId.status, 400);

    const referencedHarness = createCategoryHarness({ referenced: true, initial: [existingCategory] });
    await withHttpServer(referencedHarness.app, async (referencedBaseUrl) => {
      const response = await fetch(`${referencedBaseUrl}/api/categories/${categoryId}`, { method: 'DELETE' });
      assert.equal(response.status, 409);
      assert.match((await response.json()).message, /in use/);
      assert.equal(referencedHarness.categories.length, 1);
    });
  });

  const cashierHarness = createCategoryHarness({ role: 'cashier' });
  await withHttpServer(cashierHarness.app, async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Fresh Food' })
    });
    assert.equal(createResponse.status, 403);
    const editResponse = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Fresh Food' })
    });
    assert.equal(editResponse.status, 403);
    const deleteResponse = await fetch(`${baseUrl}/api/categories/${categoryId}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 403);
  });
});

test('customer normalized phone is protected by a unique database index', () => {
  const Customer = require('../models/Customer');
  const { getArchivedOriginalPhone } = require('../routes/customerRoutes');
  assert.equal(Customer.schema.path('phone').options.unique, true);
  assert.equal(getArchivedOriginalPhone(`archived_123_${userId}_923001234567`, userId), '923001234567');
  assert.equal(getArchivedOriginalPhone('archived_123_923001234567', userId), '923001234567');
});

test('customer validation rejects malformed names and raw phone values without losing supported formats', () => {
  assert.equal(validatePhone('03001234567').normalized, '923001234567');
  assert.equal(validatePhone('+92 300 123 4567').normalized, '923001234567');
  assert.equal(validatePhone('00923001234567').normalized, '923001234567');
  assert.ok(validatePhone('name03001234567').error);
  assert.ok(validatePhone('12345678901').error);
  assert.ok(validateCustomer({ name: 'A', phone: '03001234567' }).error);
  assert.ok(validateCustomer({ name: '!!!', phone: '03001234567' }).error);
  assert.ok(validateCustomer({ name: 'Alice', phone: '03001234567', email: 'bad@' }).error);
  assert.equal(formatCustomerName('  O’NEIL  '), 'O’Neil');
});