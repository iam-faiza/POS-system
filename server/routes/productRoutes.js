const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// Normalize SKU consistently
const normalizeSku = (sku) => String(sku || '').trim().toUpperCase();

// Validate product data
const validateProduct = ({ name, sku, category, price, stockQuantity, lowStockThreshold }) => {
  const trimmedName = String(name || '').trim();
  const normalizedSku = normalizeSku(sku);

  if (trimmedName.length < 2) {
    return 'Product name must be at least 2 characters';
  }

  if (trimmedName.length > 100) {
    return 'Product name cannot exceed 100 characters';
  }

  if (!/^[A-Z0-9_-]{3,50}$/.test(normalizedSku)) {
    return 'SKU must be 3-50 characters and contain only letters, numbers, hyphens, or underscores';
  }

  if (!category) {
    return 'Category is required';
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return 'Price must be greater than 0';
  }

  const numericStock = Number(stockQuantity);
  if (!Number.isFinite(numericStock) || numericStock < 0) {
    return 'Stock quantity cannot be negative';
  }

  const numericThreshold = Number(lowStockThreshold);
  if (!Number.isFinite(numericThreshold) || numericThreshold < 0) {
    return 'Low stock threshold cannot be negative';
  }

  return null;
};

// Get all products
router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find({}).populate('category', 'name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create product (Admin only)
router.post('/', protect, admin, async (req, res) => {
  const {
    name,
    sku,
    category,
    price,
    stockQuantity,
    lowStockThreshold
  } = req.body;

  const normalizedSku = normalizeSku(sku);
  const trimmedName = String(name || '').trim();

  const validationError = validateProduct({
    name: trimmedName,
    sku: normalizedSku,
    category,
    price,
    stockQuantity,
    lowStockThreshold
  });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existingProduct = await Product.findOne({ sku: normalizedSku });

    if (existingProduct) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    const product = new Product({
      name: trimmedName,
      sku: normalizedSku,
      category,
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      lowStockThreshold: Number(lowStockThreshold)
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    res.status(400).json({ message: error.message });
  }
});

// Update product (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
  const {
    name,
    sku,
    category,
    price,
    stockQuantity,
    lowStockThreshold
  } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    const updatedName = name !== undefined
      ? String(name).trim()
      : product.name;

    const updatedSku = sku !== undefined
      ? normalizeSku(sku)
      : product.sku;

    const updatedCategory = category !== undefined
      ? category
      : product.category;

    const updatedPrice = price !== undefined
      ? Number(price)
      : product.price;

    const updatedStock = stockQuantity !== undefined
      ? Number(stockQuantity)
      : product.stockQuantity;

    const updatedThreshold = lowStockThreshold !== undefined
      ? Number(lowStockThreshold)
      : product.lowStockThreshold;

    const validationError = validateProduct({
      name: updatedName,
      sku: updatedSku,
      category: updatedCategory,
      price: updatedPrice,
      stockQuantity: updatedStock,
      lowStockThreshold: updatedThreshold
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const duplicateProduct = await Product.findOne({
      sku: updatedSku,
      _id: { $ne: product._id }
    });

    if (duplicateProduct) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    product.name = updatedName;
    product.sku = updatedSku;
    product.category = updatedCategory;
    product.price = updatedPrice;
    product.stockQuantity = updatedStock;
    product.lowStockThreshold = updatedThreshold;

    const updatedProduct = await product.save();

    res.json(updatedProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    res.status(400).json({ message: error.message });
  }
});

// Delete product (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
