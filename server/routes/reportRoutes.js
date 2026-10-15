const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { buildSalesDateFilter, getStoreTimeZone, localDateKey, localHour } = require('../utils/salesFilters');
const { buildProfitReport } = require('../utils/profitReport');

// GET /api/reports/profit?preset=today|yesterday|week|month|year|date|range|all
// Defaults to this month so an unfiltered request never scans the whole history.
router.get('/profit', protect, checkPermission(PERMISSIONS.SALES_VIEW_ALL), async (req, res) => {
  try {
    const timeZone = getStoreTimeZone(process.env);
    const dateFilter = buildSalesDateFilter({
      preset: req.query.preset || 'month',
      date: req.query.date,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    }, timeZone) || {};

    const sales = await Sale.find(dateFilter)
      .select('createdAt subtotal discount items cashier')
      .populate('cashier', 'name')
      .lean();

    const productIds = [...new Set(sales.flatMap((sale) => sale.items.map((item) => String(item.productId))))];
    const products = await Product.find({ _id: { $in: productIds } }).select('category').lean();
    const categories = await Category.find({}).select('name').lean();

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

module.exports = router;
