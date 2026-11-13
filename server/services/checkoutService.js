const { createHash, randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const CheckoutAttempt = require('../models/CheckoutAttempt');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');

const MAX_ITEMS = 100;
const MAX_QUANTITY = 10000;
const CARD_TYPES = new Set(['Visa', 'Mastercard', 'Amex', 'Other']);
const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const SAME_KEY_WAIT_MS = 10 * 1000;

class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CheckoutError';
    this.status = status;
  }
}

const badRequest = (message) => new CheckoutError(400, message);
const idempotencyConflict = () => new CheckoutError(409, 'Idempotency key was already used for a different checkout payload');

function validateIdempotencyKey(idempotencyKey) {
  if (typeof idempotencyKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw badRequest('A valid Idempotency-Key UUID is required');
  }
}

function checkoutRequestHash(parsed) {
  const payload = {
    items: parsed.requestedItems,
    customerId: parsed.customerId || null,
    discountCents: parsed.discountCents,
    paymentMethod: parsed.paymentMethod,
    paymentDetails: parsed.paymentDetails || null,
    cashReceivedCents: parsed.cashReceivedCents ?? null
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function publicSaleResult(sale) {
  const result = typeof sale?.toObject === 'function' ? sale.toObject() : { ...sale };
  delete result.idempotencyKey;
  delete result.checkoutRequestHash;
  return result;
}

async function findStoredSale(SaleModel, cashierId, idempotencyKey) {
  let query = SaleModel.findOne({ cashier: cashierId, idempotencyKey });
  if (typeof query?.select === 'function') query = query.select('+idempotencyKey +checkoutRequestHash');
  return query;
}

async function findCheckoutAttempt(AttemptModel, cashierId, idempotencyKey) {
  let query = AttemptModel.findOne({ cashier: cashierId, idempotencyKey });
  if (typeof query?.select === 'function') query = query.select('+ownerToken +reservationToken');
  return query;
}

async function getCheckoutAttemptStatus({
  SaleModel = Sale,
  AttemptModel = CheckoutAttempt,
  cashierId,
  idempotencyKey,
  now = Date.now
}) {
  validateIdempotencyKey(idempotencyKey);

  const committedSale = await findStoredSale(SaleModel, cashierId, idempotencyKey);
  if (committedSale) return { status: 'completed', sale: publicSaleResult(committedSale) };

  const attempt = await findCheckoutAttempt(AttemptModel, cashierId, idempotencyKey);
  if (!attempt) return { status: 'not_found' };
  if (attempt.status === 'completed') return { status: 'processing' };
  if (attempt.status === 'reserved') {
    const reservationToken = randomUUID();
    const refreshed = await AttemptModel.findOneAndUpdate({
      _id: attempt._id,
      cashier: cashierId,
      idempotencyKey,
      requestHash: attempt.requestHash,
      status: 'reserved'
    }, {
      $set: { reservationToken, expiresAt: new Date(now() + ATTEMPT_RETENTION_MS) }
    }, { returnDocument: 'after' });
    return refreshed ? { status: 'retryable', reservationToken } : { status: 'processing' };
  }

  if (attempt.leaseExpiresAt && new Date(attempt.leaseExpiresAt).getTime() > now()) {
    return { status: 'processing' };
  }

  const reclaimed = await AttemptModel.updateOne({
    _id: attempt._id,
    cashier: cashierId,
    idempotencyKey,
    status: 'processing',
    ownerToken: attempt.ownerToken,
    leaseExpiresAt: { $lte: new Date(now()) }
  }, {
    $set: {
      status: 'reserved',
      reservationToken: randomUUID(),
      ownerToken: null,
      leaseExpiresAt: null,
      expiresAt: new Date(now() + ATTEMPT_RETENTION_MS)
    }
  });
  if (reclaimed.modifiedCount === 1 || reclaimed.nModified === 1) {
    const updated = await findCheckoutAttempt(AttemptModel, cashierId, idempotencyKey);
    return { status: 'retryable', reservationToken: updated.reservationToken };
  }

  const latest = await findCheckoutAttempt(AttemptModel, cashierId, idempotencyKey);
  if (latest?.status === 'completed') {
    const sale = await findStoredSale(SaleModel, cashierId, idempotencyKey);
    return sale ? { status: 'completed', sale: publicSaleResult(sale) } : { status: 'processing' };
  }
  return latest?.status === 'reserved'
    ? getCheckoutAttemptStatus({ SaleModel, AttemptModel, cashierId, idempotencyKey, now })
    : { status: 'processing' };
}

function readPercentageSetting(env, name, fallback) {
  const rawValue = env[name];
  const value = rawValue === undefined || rawValue.trim() === ''
    ? fallback
    : Number(rawValue);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new CheckoutError(503, `Invalid server checkout setting: ${name}`);
  }

  return value;
}

function getCheckoutSettings(env = process.env) {
  return {
    taxRate: readPercentageSetting(env, 'POS_TAX_RATE', 5),
    maxDiscountPercent: readPercentageSetting(env, 'POS_MAX_DISCOUNT_PERCENT', 100)
  };
}

function parseCheckoutRequest(body, cashierId, settings) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Invalid checkout request');
  }
  if (!mongoose.isObjectIdOrHexString(cashierId)) {
    throw badRequest('A valid cashier is required');
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    throw badRequest(`Sale must contain between 1 and ${MAX_ITEMS} items`);
  }

  const seenProductIds = new Set();
  const requestedItems = body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        !mongoose.isObjectIdOrHexString(item.productId)) {
      throw badRequest('Each sale item must have a valid product ID');
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw badRequest(`Item quantity must be a whole number between 1 and ${MAX_QUANTITY}`);
    }

    const productId = new mongoose.Types.ObjectId(item.productId).toString();
    if (seenProductIds.has(productId)) {
      throw badRequest('A product may only appear once in a sale');
    }
    seenProductIds.add(productId);
    return { productId, quantity: item.quantity };
  });

  if (!['cash', 'card'].includes(body.paymentMethod)) {
    throw badRequest('Payment method must be cash or card');
  }

  let paymentDetails;
  if (body.paymentMethod === 'card') {
    const details = body.paymentDetails;
    if (!details || typeof details !== 'object' || Array.isArray(details) || !CARD_TYPES.has(details.cardType)) {
      throw badRequest('Select a valid simulated card type');
    }
    paymentDetails = { cardType: details.cardType };
  }

  const discount = body.discount === undefined ? 0 : body.discount;
  if (typeof discount !== 'number' || !Number.isFinite(discount) || discount < 0 ||
      !Number.isSafeInteger(Math.round(discount * 100)) ||
      Math.abs(discount * 100 - Math.round(discount * 100)) > 1e-7) {
    throw badRequest('Discount must be a non-negative amount with at most two decimal places');
  }

  let cashReceivedCents;
  if (Object.prototype.hasOwnProperty.call(body, 'cashReceived')) {
    if (body.paymentMethod !== 'cash' || typeof body.cashReceived !== 'number' ||
        !Number.isFinite(body.cashReceived) || body.cashReceived < 0 ||
        !Number.isSafeInteger(Math.round(body.cashReceived * 100)) ||
        Math.abs(body.cashReceived * 100 - Math.round(body.cashReceived * 100)) > 1e-7) {
      throw badRequest('Cash received must be a valid amount with at most two decimal places');
    }
    cashReceivedCents = Math.round(body.cashReceived * 100);
  }

  let customerId;
  if (body.customer !== undefined && body.customer !== null && body.customer !== '') {
    if (!mongoose.isObjectIdOrHexString(body.customer)) {
      throw badRequest('Customer ID is invalid');
    }
    customerId = String(body.customer);
  }

  return {
    requestedItems,
    discountCents: Math.round(discount * 100),
    customerId,
    paymentMethod: body.paymentMethod,
    paymentDetails,
    cashReceivedCents,
    taxRate: settings.taxRate,
    maxDiscountPercent: settings.maxDiscountPercent
  };
}

async function assertTransactionTopology(mongooseConnection) {
  try {
    const hello = await mongooseConnection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new CheckoutError(503, 'Checkout requires MongoDB transactions; configure a replica set or sharded cluster');
    }
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(503, 'Unable to verify MongoDB transaction support; checkout is unavailable');
  }
}

async function reserveCheckoutAttempt({ body, cashierId, idempotencyKey, models, env = process.env, now = Date.now }) {
  validateIdempotencyKey(idempotencyKey);
  const dbModels = models || { Sale, CheckoutAttempt };
  const parsed = parseCheckoutRequest(body, cashierId, getCheckoutSettings(env));
  const requestHash = checkoutRequestHash(parsed);

  const committedSale = await findStoredSale(dbModels.Sale, cashierId, idempotencyKey);
  if (committedSale) {
    if (committedSale.checkoutRequestHash !== requestHash) throw idempotencyConflict();
    return { status: 'completed', sale: publicSaleResult(committedSale) };
  }

  let attempt = await findCheckoutAttempt(dbModels.CheckoutAttempt, cashierId, idempotencyKey);
  if (!attempt) {
    try {
      attempt = await new dbModels.CheckoutAttempt({
        cashier: cashierId,
        idempotencyKey,
        requestHash,
        status: 'reserved',
        reservationToken: randomUUID(),
        expiresAt: new Date(now() + ATTEMPT_RETENTION_MS)
      }).save();
    } catch (error) {
      if (error.code !== 11000) throw error;
      attempt = await findCheckoutAttempt(dbModels.CheckoutAttempt, cashierId, idempotencyKey);
    }
  }
  if (!attempt) throw new CheckoutError(503, 'Unable to reserve checkout attempt');
  if (attempt.requestHash !== requestHash) throw idempotencyConflict();
  if (attempt.status === 'completed') {
    const sale = await findStoredSale(dbModels.Sale, cashierId, idempotencyKey);
    return sale ? { status: 'completed', sale: publicSaleResult(sale) } : { status: 'processing' };
  }
  if (attempt.status === 'processing') {
    const status = await getCheckoutAttemptStatus({
      SaleModel: dbModels.Sale,
      AttemptModel: dbModels.CheckoutAttempt,
      cashierId,
      idempotencyKey,
      now
    });
    return status.status === 'retryable'
      ? { status: 'reserved', reservationToken: status.reservationToken }
      : status;
  }
  return { status: 'reserved', reservationToken: attempt.reservationToken };
}

async function findCompletedSale({ SaleModel = Sale, cashierId, idempotencyKey, body }) {
  validateIdempotencyKey(idempotencyKey);
  const existing = await findStoredSale(SaleModel, cashierId, idempotencyKey);
  if (!existing) return null;

  let requestHash;
  try {
    const parsed = parseCheckoutRequest(body, cashierId, { taxRate: 0, maxDiscountPercent: 100 });
    requestHash = checkoutRequestHash(parsed);
  } catch (error) {
    if (error instanceof CheckoutError) throw idempotencyConflict();
    throw error;
  }
  if (existing.checkoutRequestHash !== requestHash) throw idempotencyConflict();
  return publicSaleResult(existing);
}

async function acquireCheckoutAttempt({ AttemptModel, cashierId, idempotencyKey, requestHash, reservationToken, now = Date.now }) {
  const ownerToken = randomUUID();
  const attempt = await AttemptModel.findOneAndUpdate({
    cashier: cashierId,
    idempotencyKey,
    requestHash,
    status: 'reserved',
    reservationToken
  }, {
    $set: {
      status: 'processing',
      ownerToken,
      leaseExpiresAt: new Date(now() + PROCESSING_LEASE_MS)
    },
    $unset: { reservationToken: 1 }
  }, { returnDocument: 'after' });
  return attempt ? { attempt, ownerToken } : null;
}

async function waitForCompletedSale({ SaleModel, AttemptModel, cashierId, idempotencyKey, requestHash }) {
  const deadline = Date.now() + SAME_KEY_WAIT_MS;
  while (Date.now() < deadline) {
    const sale = await findStoredSale(SaleModel, cashierId, idempotencyKey);
    if (sale) {
      if (sale.checkoutRequestHash !== requestHash) throw idempotencyConflict();
      return publicSaleResult(sale);
    }
    const attempt = await findCheckoutAttempt(AttemptModel, cashierId, idempotencyKey);
    if (attempt?.status === 'reserved') return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function createSale({ body, cashierId, idempotencyKey, reservationToken, models, mongooseClient, env }) {
  const dbModels = models || { Product, Sale, CheckoutAttempt, Customer, StockMovement };
  const dbClient = mongooseClient || mongoose;
  validateIdempotencyKey(idempotencyKey);
  const parsed = parseCheckoutRequest(body, cashierId, getCheckoutSettings(env));
  const requestHash = checkoutRequestHash(parsed);

  const existingSale = await findStoredSale(dbModels.Sale, cashierId, idempotencyKey);
  if (existingSale) {
    if (existingSale.checkoutRequestHash !== requestHash) throw idempotencyConflict();
    return publicSaleResult(existingSale);
  }

  const reservation = await findCheckoutAttempt(dbModels.CheckoutAttempt, cashierId, idempotencyKey);
  if (!reservation) {
    throw new CheckoutError(409, 'Checkout attempt must be reserved before submitting a sale');
  }
  if (reservation.requestHash !== requestHash) throw idempotencyConflict();
  if (reservation.status === 'processing') {
    const completed = await waitForCompletedSale({
      SaleModel: dbModels.Sale,
      AttemptModel: dbModels.CheckoutAttempt,
      cashierId,
      idempotencyKey,
      requestHash
    });
    if (completed) return completed;
    throw new CheckoutError(409, 'Checkout is still processing. Reconcile this key before retrying.');
  }
  if (reservation.status === 'reserved' &&
      (!reservationToken || reservation.reservationToken !== reservationToken)) {
    throw new CheckoutError(409, 'Checkout reservation expired. Reconcile this key and reserve again.');
  }
  if (reservation.status === 'completed') {
    const completed = await findStoredSale(dbModels.Sale, cashierId, idempotencyKey);
    if (!completed) throw new CheckoutError(503, 'Completed checkout record is unavailable');
    return publicSaleResult(completed);
  }
  if (reservation.status !== 'reserved') {
    throw new CheckoutError(409, 'Checkout attempt is not available for submission');
  }
  await assertTransactionTopology(dbClient.connection);

  let session;
  let savedSale;
  let ownerToken;
  try {
    let claim = await acquireCheckoutAttempt({
      AttemptModel: dbModels.CheckoutAttempt,
      cashierId,
      idempotencyKey,
      requestHash,
      reservationToken
    });
    if (!claim) {
      const status = await getCheckoutAttemptStatus({ SaleModel: dbModels.Sale, AttemptModel: dbModels.CheckoutAttempt, cashierId, idempotencyKey });
      if (status.status === 'completed') return status.sale;
      if (status.status === 'processing') {
        const completed = await waitForCompletedSale({
          SaleModel: dbModels.Sale,
          AttemptModel: dbModels.CheckoutAttempt,
          cashierId,
          idempotencyKey,
          requestHash
        });
        if (completed) return completed;
      }
      claim = await acquireCheckoutAttempt({
        AttemptModel: dbModels.CheckoutAttempt,
        cashierId,
        idempotencyKey,
        requestHash,
        reservationToken
      });
      if (!claim) throw new CheckoutError(409, 'Checkout attempt could not be claimed. Reconcile this key and retry.');
    }
    ownerToken = claim.ownerToken;
    session = await dbClient.startSession();

    await session.withTransaction(async () => {
      const productIds = parsed.requestedItems.map((item) => item.productId);
      const products = await dbModels.Product.find({ _id: { $in: productIds } }).session(session);
      const productsById = new Map(products.map((product) => [String(product._id), product]));
      const saleItems = [];
      let subtotalCents = 0;

      for (const requestedItem of parsed.requestedItems) {
        const product = productsById.get(requestedItem.productId);
        if (!product || product.isArchived) throw new CheckoutError(409, 'A product in this sale is unavailable');
        if (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < requestedItem.quantity) {
          throw new CheckoutError(409, `Insufficient stock for ${product.name}`);
        }
        if (!Number.isFinite(product.price) || product.price <= 0) {
          throw new CheckoutError(409, `Invalid current price for ${product.name}`);
        }

        const priceCents = Math.round(product.price * 100);
        const lineTotalCents = priceCents * requestedItem.quantity;
        if (!Number.isSafeInteger(priceCents) || priceCents < 1 ||
            !Number.isSafeInteger(subtotalCents + lineTotalCents)) {
          throw new CheckoutError(409, `Invalid current price for ${product.name}`);
        }
        subtotalCents += lineTotalCents;
        saleItems.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          quantity: requestedItem.quantity,
          price: priceCents / 100,
          costPrice: product.costPrice == null ? undefined : Math.round(product.costPrice * 100) / 100
        });
      }

      const maxDiscountCents = Math.floor(subtotalCents * parsed.maxDiscountPercent / 100);
      if (parsed.discountCents > maxDiscountCents) throw badRequest('Discount exceeds the configured store limit');
      const taxCents = Math.round(subtotalCents * parsed.taxRate / 100);
      const totalCents = subtotalCents + taxCents - parsed.discountCents;
      if (!Number.isSafeInteger(taxCents) || !Number.isSafeInteger(totalCents)) {
        throw new CheckoutError(409, 'Sale total exceeds supported monetary precision');
      }
      const cashReceivedCents = parsed.paymentMethod === 'cash' ? parsed.cashReceivedCents ?? totalCents : undefined;
      if (cashReceivedCents !== undefined && cashReceivedCents < totalCents) {
        throw badRequest('Cash received cannot be less than the amount due');
      }
      const changeDueCents = cashReceivedCents === undefined ? undefined : cashReceivedCents - totalCents;
      let customerSnapshot;
      if (parsed.customerId) {
        const customer = await dbModels.Customer.findById(parsed.customerId).session(session);
        if (!customer) throw new CheckoutError(404, 'Customer not found');
        customerSnapshot = { name: customer.name, phone: customer.phone, email: customer.email };
      }

      const sale = new dbModels.Sale({
        invoiceNumber: `INV-${Date.now()}-${randomUUID()}`,
        cashier: cashierId,
        idempotencyKey,
        checkoutRequestHash: requestHash,
        customer: parsed.customerId,
        customerSnapshot,
        items: saleItems,
        subtotal: subtotalCents / 100,
        tax: taxCents / 100,
        taxRate: parsed.taxRate,
        discount: parsed.discountCents / 100,
        total: totalCents / 100,
        cashReceived: cashReceivedCents === undefined ? undefined : cashReceivedCents / 100,
        changeDue: changeDueCents === undefined ? undefined : changeDueCents / 100,
        paymentMethod: parsed.paymentMethod,
        paymentDetails: parsed.paymentDetails
      });
      savedSale = await sale.save({ session });

      for (const item of parsed.requestedItems) {
        const product = productsById.get(item.productId);
        const quantityAfter = product.stockQuantity - item.quantity;
        const result = await dbModels.Product.updateOne(
          { _id: item.productId, isArchived: { $ne: true }, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity } },
          { session }
        );
        if (result.matchedCount !== 1) throw new CheckoutError(409, 'Stock changed during checkout; please review the cart');
        await new dbModels.StockMovement({
          product: product._id,
          quantityDelta: -item.quantity,
          quantityBefore: product.stockQuantity,
          quantityAfter,
          type: 'sale',
          reason: 'Sale checkout',
          user: cashierId,
          sale: savedSale._id
        }).save({ session });
      }

      const attemptResult = await dbModels.CheckoutAttempt.updateOne({
        cashier: cashierId,
        idempotencyKey,
        requestHash,
        status: 'processing',
        ownerToken
      }, {
        $set: { status: 'completed', sale: savedSale._id, expiresAt: new Date(Date.now() + ATTEMPT_RETENTION_MS) },
        $unset: { ownerToken: 1, leaseExpiresAt: 1 }
      }, { session });
      if (attemptResult.matchedCount !== 1) throw new CheckoutError(409, 'Checkout ownership changed before transaction commit');
    });
  } catch (error) {
    if (error?.code === 11000 || error?.cause?.code === 11000) {
      const completedSale = await findStoredSale(dbModels.Sale, cashierId, idempotencyKey);
      if (completedSale) {
        if (completedSale.checkoutRequestHash !== requestHash) throw idempotencyConflict();
        return publicSaleResult(completedSale);
      }
    }
    if (ownerToken && !error?.hasErrorLabel?.('UnknownTransactionCommitResult')) {
      await dbModels.CheckoutAttempt.updateOne({
        cashier: cashierId,
        idempotencyKey,
        status: 'processing',
        ownerToken
      }, {
        $set: {
          status: 'reserved',
          reservationToken: randomUUID(),
          ownerToken: null,
          leaseExpiresAt: null
        }
      }).catch(() => {});
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }

  return publicSaleResult(savedSale);
}

module.exports = {
  CheckoutError,
  createSale,
  checkoutRequestHash,
  parseCheckoutRequest,
  reserveCheckoutAttempt,
  getCheckoutAttemptStatus,
  findCompletedSale,
  validateIdempotencyKey,
  getCheckoutSettings
};