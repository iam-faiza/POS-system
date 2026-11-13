const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { buildSalesDateFilter, getStoreTimeZone, localDateKey, localHour } = require('../utils/salesFilters');
const { buildProfitReport } = require('../utils/profitReport');

function createReportRouter({
  SaleModel = Sale,
  ProductModel = Product,
  CategoryModel = Category,
  protectMiddleware = protect,
  checkPermissionMiddleware = checkPermission,
  env = process.env
} = {}) {
  const reportRouter = express.Router();

  // GET /api/reports/profit?preset=today|yesterday|week|month|year|date|range|all
  // Defaults to this month so an unfiltered request never scans the whole history.
  reportRouter.get('/profit', protectMiddleware, checkPermissionMiddleware(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const timeZone = getStoreTimeZone(env);
      const dateFilter = buildSalesDateFilter({
        preset: req.query.preset || 'month',
        date: req.query.date,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      }, timeZone) || {};

      const sales = await SaleModel.find(dateFilter)
        .select('createdAt subtotal discount items cashier')
        .populate('cashier', 'name')
        .lean();

      const productIds = [...new Set(sales.flatMap((sale) => sale.items.map((item) => String(item.productId))))];
      const products = await ProductModel.find({ _id: { $in: productIds } }).select('category').lean();
      const categories = await CategoryModel.find({}).select('name').lean();

      const report = buildProfitReport({
        sales,
        timeZone,
        dayKey: localDateKey,
        hourOf: localHour,
        productCategory: new Map(products.map((p) => [String(p._id), String(p.category)])),
        categoryNames: new Map(categories.map((c) => [String(c._id), c.name]))
      });
      res.json({ preset: req.query.preset || 'month', timeZone, ...report });
    } catch (error) {
      res.status(error.status || 500).json({
        message: error.status ? error.message : 'Unable to build profit report'
      });
    }
  });

  return reportRouter;
}

module.exports = createReportRouter();
module.exports.createReportRouter = createReportRouter;
