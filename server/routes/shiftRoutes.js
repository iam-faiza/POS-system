const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const Sale = require('../models/Sale');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// GET /api/shifts/current - Get active shift for logged-in cashier
router.get('/current', protect, async (req, res) => {
  try {
    const activeShift = await Shift.findOne({
      cashier: req.user.id || req.user._id,
      status: 'OPEN'
    });
    res.json({ activeShift });
  } catch (error) {
    res.status(500).json({ message: 'Error checking active shift status' });
  }
});

// POST /api/shifts/open - Start a new register shift
router.post('/open', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const existingShift = await Shift.findOne({ cashier: userId, status: 'OPEN' });

    if (existingShift) {
      return res.status(400).json({ message: 'You already have an active shift open.' });
    }

    const { startingFloat } = req.body;
    if (startingFloat === undefined || startingFloat < 0) {
      return res.status(400).json({ message: 'Please provide a valid starting float amount.' });
    }

    const newShift = await Shift.create({
      cashier: userId,
      startingFloat: Number(startingFloat),
      openedAt: new Date()
    });

    res.status(201).json(newShift);
  } catch (error) {
    res.status(500).json({ message: 'Failed to start shift' });
  }
});

// POST /api/shifts/close - Close shift and return populated Z-Report
router.post('/close', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const activeShift = await Shift.findOne({ cashier: userId, status: 'OPEN' });

    if (!activeShift) {
      return res.status(400).json({ message: 'No active shift found to close.' });
    }

    const { actualCashCounted, notes } = req.body;
    if (actualCashCounted === undefined || actualCashCounted < 0) {
      return res.status(400).json({ message: 'Please provide physical cash counted.' });
    }

    const shiftSales = await Sale.find({
      cashier: userId,
      createdAt: { $gte: activeShift.openedAt }
    });

    let cashSales = 0;
    let cardSales = 0;

    shiftSales.forEach((sale) => {
      const method = String(sale.paymentMethod || '').toLowerCase();
      if (method === 'cash') {
        cashSales += sale.total || 0;
      } else {
        cardSales += sale.total || 0;
      }
    });

    const totalSales = cashSales + cardSales;
    const expectedCash = activeShift.startingFloat + cashSales;
    const difference = Number(actualCashCounted) - expectedCash;

    activeShift.status = 'CLOSED';
    activeShift.closedAt = new Date();
    activeShift.actualCashCounted = Number(actualCashCounted);
    activeShift.expectedCash = expectedCash;
    activeShift.cashSales = cashSales;
    activeShift.cardSales = cardSales;
    activeShift.totalSales = totalSales;
    activeShift.difference = difference;
    activeShift.notes = notes || '';

    await activeShift.save();

    // Populate cashier name/email before sending to frontend
    const populatedShift = await Shift.findById(activeShift._id).populate('cashier', 'name email role');

    res.json({
      message: 'Shift closed successfully',
      zReport: populatedShift
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to close shift and generate Z-Report' });
  }
});



// GET /api/shifts - Get shift history / Z-Reports
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { cashier: req.user.id || req.user._id };
    const shifts = await Shift.find(query)
      .populate('cashier', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch shifts' });
  }
});

module.exports = router;