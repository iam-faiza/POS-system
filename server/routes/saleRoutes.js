const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Shift = require('../models/Shift');
const { protect, admin, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { createSale, CheckoutError, getCheckoutSettings } = require('../services/checkoutService');
const { salesQueryForUser } = require('../utils/salesAccess');
const { buildSalesDateFilter, getStoreTimeZone, parseSalesPagination } = require('../utils/salesFilters');

function createSaleRouter({
  SaleModel = Sale,
  ProductModel = Product,
  ShiftModel = Shift,
  protectMiddleware = protect,
  adminMiddleware = admin,
  checkPermissionMiddleware = checkPermission,
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

  saleRouter.get('/summary', protectMiddleware, async (req, res) => {
    try {
      const ownerQuery = salesQueryForUser(req.user);
      if (!ownerQuery) {
        return res.status(403).json({ message: 'Not authorized to view dashboard summary' });
      }

      const query = { ...ownerQuery };

      // Apply today's date filter using store timezone utility
      const timeZone = getStoreTimeZone(env);
      const dateFilter = buildSalesDateFilter({ preset: 'today' }, timeZone);
      if (dateFilter) {
        Object.assign(query, dateFilter);
      }

      const roleName = String(req.user.role || '').toLowerCase();
      const canSeeStockAlerts = roleName === 'admin' ||
        (req.user.permissions || []).includes(PERMISSIONS.ROLES_MANAGE);

      const [salesResult, stockResult] = await Promise.all([
        SaleModel.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              saleCount: { $sum: 1 },
              revenue: { $sum: '$total' }
            }
          }
        ]),
        canSeeStockAlerts
          ? ProductModel.aggregate([
            {
              $match: {
                isArchived: { $ne: true },
                $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
              }
            },
            { $sort: { stockQuantity: 1, name: 1 } },
            {
              $facet: {
                count: [{ $count: 'value' }],
                products: [
                  { $limit: 10 },
                  { $project: { name: 1, sku: 1, stockQuantity: 1, lowStockThreshold: 1 } }
                ]
              }
            }
          ])
          : Promise.resolve(null)
      ]);

      const salesToday = salesResult[0]?.saleCount || 0;
      const revenueToday = salesResult[0]?.revenue || 0;

      const summary = { salesToday, revenueToday };
      if (canSeeStockAlerts) {
        summary.lowStockCount = stockResult?.[0]?.count?.[0]?.value || 0;
        summary.lowStockProducts = stockResult?.[0]?.products || [];
      }
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: 'Unable to load summary' });
    }
  });

  // Process a sale (Shift check enforced)
  saleRouter.post('/', protectMiddleware, checkPermission(PERMISSIONS.SALES_CREATE), async (req, res) => {
    try {
      const cashierId = req.user.id || req.user._id;

      // 1. Verify that cashier has an active OPEN register shift
      const activeShift = await ShiftModel.findOne({ cashier: cashierId, status: 'OPEN' });
      if (!activeShift) {
        return res.status(400).json({
          message: 'No active register shift found. You must open a register shift before processing sales.'
        });
      }

      // 2. Pass shift ID to checkout service to associate transaction with Z-Report
      const sale = await createSaleService({
        body: req.body,
        cashierId,
        shiftId: activeShift._id
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
      // Cost prices are business-sensitive: only viewers who see all sales get them.
      const canSeeCost = (req.user.permissions || []).includes(PERMISSIONS.SALES_VIEW_ALL);
      const payload = canSeeCost ? sales : sales.map((sale) => {
        const plain = sale.toObject();
        plain.items = (plain.items || []).map(({ costPrice: _costPrice, ...line }) => line);
        return plain;
      });
      res.json(payload);
    } catch (error) {
      res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to load sales history' });
    }
  });

  return saleRouter;
}

module.exports = createSaleRouter();
module.exports.createSaleRouter = createSaleRouter;