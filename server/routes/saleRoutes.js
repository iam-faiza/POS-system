const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');
const { createSale, CheckoutError, getCheckoutSettings } = require('../services/checkoutService');
const { salesQueryForUser } = require('../utils/salesAccess');
const { buildSalesDateFilter, getStoreTimeZone, parseSalesPagination } = require('../utils/salesFilters');

function createSaleRouter({
  SaleModel = Sale,
  ProductModel = Product,
  protectMiddleware = protect,
  adminMiddleware = admin,
  createSaleService = createSale,
  env = process.env
} = {}) {
  const saleRouter = express.Router();

  saleRouter.get('/settings', protectMiddleware, (req, res) => {
    try {
      res.json({
        taxRate: getCheckoutSettings(env).taxRate,
        baseCurrency: 'PKR'
      });
    } catch (error) {
      res.status(503).json({ message: 'Checkout settings are unavailable' });
    }
  });

  saleRouter.get('/summary', protectMiddleware, adminMiddleware, async (req, res) => {
    try {
      const timeZone = getStoreTimeZone(env);
      const todayFilter = buildSalesDateFilter({ preset: 'today' }, timeZone);
      const [salesSummary, inventorySummary] = await Promise.all([
        SaleModel.aggregate([
          { $match: todayFilter },
          { $group: { _id: null, saleCount: { $sum: 1 }, revenue: { $sum: '$total' } } }
        ]),
        ProductModel.aggregate([
          {
            $match: {
              isArchived: { $ne: true },
              $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
            }
          },
          {
            $facet: {
              count: [{ $count: 'value' }],
              products: [
                { $sort: { stockQuantity: 1 } },
                { $limit: 10 },
                { $project: { name: 1, sku: 1, stockQuantity: 1, lowStockThreshold: 1 } }
              ]
            }
          }
        ])
      ]);
      const lowStockSummary = inventorySummary[0] || { count: [], products: [] };
      res.json({
        date: todayFilter.createdAt.$gte,
        timeZone,
        salesToday: salesSummary[0]?.saleCount || 0,
        revenueToday: salesSummary[0]?.revenue || 0,
        lowStockCount: lowStockSummary.count[0]?.value || 0,
        lowStockProducts: lowStockSummary.products
      });
    } catch (error) {
      res.status(500).json({ message: 'Unable to load dashboard summary' });
    }
  });

  // Process a sale
  saleRouter.post('/', protectMiddleware, async (req, res) => {
    try {
      const sale = await createSaleService({
        body: req.body,
        cashierId: req.user.id
      });
      res.status(201).json(sale);
    } catch (error) {
      const status = error instanceof CheckoutError ? error.status : 500;
      const message = error instanceof CheckoutError
        ? error.message
        : 'Checkout failed; no sale was committed';
      res.status(status).json({ message });
    }
  });

  // Get sales history
  saleRouter.get('/', protectMiddleware, async (req, res) => {
    try {
      const ownerQuery = salesQueryForUser(req.user);
      if (!ownerQuery) {
        return res.status(403).json({ message: 'Not authorized to view sales' });
      }
      const pagination = parseSalesPagination(req.query);
      const timeZone = getStoreTimeZone(env);
      const dateFilter = buildSalesDateFilter(req.query, timeZone);
      const query = { ...ownerQuery, ...(dateFilter || {}) };

      let salesQuery = SaleModel.find(query);
      const excludedFields = [
        '-paymentDetails.cardholderName',
        '-paymentDetails.last4',
        '-paymentDetails.transactionRef'
      ];
      if (req.user.role === 'cashier') {
        excludedFields.push('-customerSnapshot.phone', '-customerSnapshot.email');
      }
      salesQuery = salesQuery.select(excludedFields.join(' '));
      const sales = await salesQuery
        .populate('cashier', 'name')
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.pageSize);
      const total = await SaleModel.countDocuments(query);
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(pagination.page));
      res.set('X-Page-Size', String(pagination.pageSize));
      res.set('X-Total-Pages', String(Math.ceil(total / pagination.pageSize)));
      res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
      res.json(sales);
    } catch (error) {
      res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to load sales history' });
    }
  });

  return saleRouter;
}

module.exports = createSaleRouter();
module.exports.createSaleRouter = createSaleRouter;
