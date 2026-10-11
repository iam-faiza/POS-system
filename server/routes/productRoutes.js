const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
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

// Get ACTIVE products with optional search (name or SKU) and category filter
// Use ?includeArchived=true to override (admin use)
router.get('/', protect, async (req, res) => {
  try {
    const { search, category, activeOnly, includeArchived } = req.query;
    let query = {};

    // Default: only active products. activeOnly=true or omitting includeArchived=true both give same result.
    if (includeArchived !== 'true') {
      query.isArchived = { $ne: true };
    }

    // Legacy: activeOnly=true (kept for POS terminal compatibility)
    if (activeOnly === 'true') {
      query.isArchived = { $ne: true };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && String(search).trim() !== '') {
      const s = String(search).trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex }
      ];
    }

    const products = await Product.find(query).populate('category', 'name').sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get ARCHIVED products (Admin only)
router.get('/archived', protect, admin, async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = { isArchived: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && String(search).trim() !== '') {
      const s = String(search).trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex }
      ];
    }

    const products = await Product.find(query).populate('category', 'name').sort({ updatedAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Restore an archived product (Admin only)
router.patch('/:id/restore', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (!product.isArchived) {
      return res.status(400).json({ message: 'Product is not archived' });
    }

    product.isArchived = false;

    // Strip " (Archived)" suffix if it was appended during archival
    if (product.name.endsWith(' (Archived)')) {
      product.name = product.name.slice(0, -' (Archived)'.length);
    }

    await product.save();
    res.json({ message: 'Product restored successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Error restoring product: ' + error.message });
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

// Bulk delete products (Admin only)
// Preserves historical transactions by archiving products that have sales,
// while permanently deleting products with no sales history.
router.delete('/', protect, admin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    if (totalProducts === 0) {
      return res.json({
        message: 'No products found to delete.',
        deletedCount: 0,
        archivedCount: 0,
        totalProcessed: 0
      });
    }

    // Find all product IDs referenced across all sales
    const salesWithItems = await Sale.distinct('items.productId');
    const referencedIds = salesWithItems.filter(id => id != null);

    // 1. Permanently delete products with NO historical sales
    const deleteResult = await Product.deleteMany({ _id: { $nin: referencedIds } });
    const deletedCount = deleteResult.deletedCount || 0;

    // 2. Safely archive products with historical sales
    let archivedCount = 0;
    if (referencedIds.length > 0) {
      const productsToArchive = await Product.find({
        _id: { $in: referencedIds },
        isArchived: { $ne: true }
      });

      for (const prod of productsToArchive) {
        if (!prod.name.includes('(Archived)')) {
          prod.name = `${prod.name} (Archived)`;
        }
        prod.isArchived = true;
        prod.stockQuantity = 0;
        await prod.save();
        archivedCount++;
      }
    }

    res.json({
      message: `Bulk product operation completed: ${deletedCount} product(s) deleted permanently; ${archivedCount} product(s) with historical sales safely archived.`,
      deletedCount,
      archivedCount,
      totalProcessed: totalProducts
    });
  } catch (error) {
    console.error('Bulk product delete error:', error);
    res.status(500).json({ message: 'Error during bulk product deletion: ' + error.message });
  }
});

// Delete or safely archive an individual product (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if referenced in historical sales
    const salesCount = await Sale.countDocuments({ 'items.productId': req.params.id });

    if (salesCount > 0) {
      // Historical sales exist: Safe archive to preserve receipts and records
      if (!product.name.includes('(Archived)')) {
        product.name = `${product.name} (Archived)`;
      }
      product.isArchived = true;
      product.stockQuantity = 0;
      await product.save();

      return res.json({
        message: `Product is referenced in ${salesCount} historical sales. Safely archived to preserve transaction and receipt history.`,
        archived: true
      });
    }

    // No sales reference: Safe to permanently remove
    await product.deleteOne();
    res.json({ message: 'Product deleted successfully', deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Error during product deletion: ' + error.message });
  }
});

module.exports = router;
