const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');

const MAX_ITEMS = 100;
const MAX_QUANTITY = 10000;
const CARD_TYPES = new Set(['Visa', 'Mastercard', 'Amex', 'Other']);

class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CheckoutError';
    this.status = status;
  }
}

const badRequest = (message) => new CheckoutError(400, message);

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

async function createSale({ body, cashierId, models, mongooseClient, env }) {
  const dbModels = models || { Product, Sale, Customer, StockMovement };
  const dbClient = mongooseClient || mongoose;
  const parsed = parseCheckoutRequest(body, cashierId, getCheckoutSettings(env));

  await assertTransactionTopology(dbClient.connection);
  const session = await dbClient.startSession();
  let savedSale;

  try {
    await session.withTransaction(async () => {
      const productIds = parsed.requestedItems.map((item) => item.productId);
      const products = await dbModels.Product
        .find({ _id: { $in: productIds } })
        .session(session);
      const productsById = new Map(products.map((product) => [String(product._id), product]));
      const saleItems = [];
      let subtotalCents = 0;

      for (const requestedItem of parsed.requestedItems) {
        const product = productsById.get(requestedItem.productId);
        if (!product || product.isArchived) {
          throw new CheckoutError(409, 'A product in this sale is unavailable');
        }
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
          price: priceCents / 100
        });
      }

      const maxDiscountCents = Math.floor(subtotalCents * parsed.maxDiscountPercent / 100);
      if (parsed.discountCents > maxDiscountCents) {
        throw badRequest('Discount exceeds the configured store limit');
      }

      const taxCents = Math.round(subtotalCents * parsed.taxRate / 100);
      const totalCents = subtotalCents + taxCents - parsed.discountCents;
      if (!Number.isSafeInteger(taxCents) || !Number.isSafeInteger(totalCents)) {
        throw new CheckoutError(409, 'Sale total exceeds supported monetary precision');
      }
      const cashReceivedCents = parsed.paymentMethod === 'cash'
        ? parsed.cashReceivedCents ?? totalCents
        : undefined;
      if (cashReceivedCents !== undefined && cashReceivedCents < totalCents) {
        throw badRequest('Cash received cannot be less than the amount due');
      }
      const changeDueCents = cashReceivedCents === undefined ? undefined : cashReceivedCents - totalCents;
      let customerSnapshot;
      if (parsed.customerId) {
        const customer = await dbModels.Customer.findById(parsed.customerId).session(session);
        if (!customer) {
          throw new CheckoutError(404, 'Customer not found');
        }
        customerSnapshot = {
          name: customer.name,
          phone: customer.phone,
          email: customer.email
        };
      }

      const sale = new dbModels.Sale({
        invoiceNumber: `INV-${Date.now()}-${randomUUID()}`,
        cashier: cashierId,
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
          {
            _id: item.productId,
            isArchived: { $ne: true },
            stockQuantity: { $gte: item.quantity }
          },
          { $inc: { stockQuantity: -item.quantity } },
          { session }
        );
        if (result.matchedCount !== 1) {
          throw new CheckoutError(409, 'Stock changed during checkout; please review the cart');
        }
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
    });
  } finally {
    await session.endSession();
  }

  return savedSale;
}

module.exports = {
  CheckoutError,
  createSale,
  getCheckoutSettings,
  parseCheckoutRequest
};