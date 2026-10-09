const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');

// Process a sale
router.post('/', protect, async (req, res) => {
  const { customer, items, subtotal, tax, discount, total, paymentMethod } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in sale' });
  }

  try {
    // Generate simple invoice number
    const invoiceNumber = `INV-${Date.now()}`;

    const sale = new Sale({
      invoiceNumber,
      cashier: req.user.id,
      customer,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod
    });

    const savedSale = await sale.save();

    // Decrement stock for each item
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stockQuantity: -item.quantity }
      });
    }

    res.status(201).json(savedSale);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get sales history
router.get('/', protect, async (req, res) => {
  try {
    const sales = await Sale.find({}).populate('cashier', 'name').populate('customer', 'name').sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
