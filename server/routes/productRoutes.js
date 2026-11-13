const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Sale = require('../models/Sale');
const StockMovement = require('../models/StockMovement');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { canReadArchivedProducts, canReadLowStockThreshold } = require('../utils/productAccess');
const { stockValueError } = require('../utils/inventoryValidation');
const { saveInventoryAdjustment } = require('../services/inventoryService');
const { parseCostPrice } = require('../utils/costPrice');
const { uploadProductImage, resolveProductImageValue, deleteStoredProductImage } = require('../utils/uploadConfig');

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

  if (!mongoose.isObjectIdOrHexString(category)) {
    return 'Category is required';
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return 'Price must be greater than 0';
  }

  const stockError = stockValueError(stockQuantity, 'Stock quantity');
  if (stockError) return stockError;

  const thresholdError = stockValueError(lowStockThreshold, 'Low stock threshold');
  if (thresholdError) return thresholdError;

  return null;
};

// Get ACTIVE products with optional search (name or SKU) and category filter
// Use ?includeArchived=true to override (admin use)
router.get('/', protect, checkPermission(PERMISSIONS.PRODUCTS_VIEW), async (req, res) => {
  try {
    const { search, category, activeOnly, includeArchived } = req.query;
    if (!canReadArchivedProducts(req.user.role, includeArchived)) {
      // Re-evaluate: if they have PRODUCTS_MANAGE, they should probably see archived
      if (!req.user.permissions.includes(PERMISSIONS.PRODUCTS_MANAGE)) {
        return res.status(403).json({ message: 'Not authorized as an admin' });
      }
    }

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

    let productsQuery = Product.find(query).populate('category', 'name').sort({ name: 1 });
    if (!canReadLowStockThreshold(req.user.role)) productsQuery = productsQuery.select('-lowStockThreshold -costPrice');
    const products = await productsQuery;
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get ARCHIVED products (Admin only)
router.get('/archived', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) => {
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
router.patch('/:id/restore', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) => {
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

router.get('/:id/stock-movements', protect, checkPermission(PERMISSIONS.INVENTORY_VIEW), async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Product ID is invalid' });
  }
  try {
    const productExists = await Product.exists({ _id: req.params.id });
    if (!productExists) return res.status(404).json({ message: 'Product not found' });
    const movements = await StockMovement.find({ product: req.params.id })
      .populate('user', 'name')
      .populate('sale', 'invoiceNumber')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load stock movements' });
  }
});

// Create product (Admin only)
router.post('/', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), uploadProductImage, async (req, res) => {
  const {
    name,
    sku,
    category,
    price,
    stockQuantity,
    lowStockThreshold,
    costPrice
  } = req.body;

  const cost = parseCostPrice(costPrice);
  if (cost.error) return res.status(400).json({ message: cost.error });

  const normalizedSku = normalizeSku(sku);
  const trimmedName = String(name || '').trim();
  const uploadedImage = resolveProductImageValue({ file: req.file, body: req.body, removeImage: req.body.removeImage, currentImage: null });

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

  let session;
  try {
    session = await mongoose.startSession();
    let createdProduct;
    await session.withTransaction(async () => {
      const categoryDoc = await Category.findById(category).session(session);
      if (!categoryDoc) throw Object.assign(new Error('Category not found'), { status: 400 });

      const categoryUpdate = await Category.updateOne(
        { _id: category },
        { $inc: { referenceVersion: 1 } },
        { session }
      );
      if (categoryUpdate.matchedCount !== 1) throw Object.assign(new Error('Category not found'), { status: 400 });

      const existingProduct = await Product.findOne({ sku: normalizedSku }).session(session);
      if (existingProduct) {
        throw Object.assign(new Error('A product with this SKU already exists'), { status: 400 });
      }

      const product = new Product({
        name: trimmedName,
        sku: normalizedSku,
        category,
        price: Number(price),
        stockQuantity: Number(stockQuantity),
        lowStockThreshold: Number(lowStockThreshold),
        costPrice: cost.value,
        image: uploadedImage
      });
      createdProduct = await product.save({ session });

      if (product.stockQuantity > 0) {
        await new StockMovement({
          product: product._id,
          quantityDelta: product.stockQuantity,
          quantityBefore: 0,
          quantityAfter: product.stockQuantity,
          type: 'adjustment',
          reason: 'Initial product stock',
          user: req.user.id
        }).save({ session });
      }
    });
    if (req.file) req.productImagePersisted = true;
    res.status(201).json(createdProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    if (req.file) {
      deleteStoredProductImage(req.file.filename ? `/uploads/products/${req.file.filename}` : null);
    }

    res.status(error.status || 400).json({ message: error.message });
  } finally {
    if (session) await session.endSession();
  }
});

// Update product (Admin only)
router.put('/:id', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), uploadProductImage, async (req, res) =>{
  const { name, sku, category, price, stockQuantity, lowStockThreshold } = req.body;
  const costUpdate = req.body.costPrice !== undefined ? parseCostPrice(req.body.costPrice) : null;
  if (costUpdate?.error) return res.status(400).json({ message: costUpdate.error });
  if (req.body.stockAdjustmentReason !== undefined &&
      (typeof req.body.stockAdjustmentReason !== 'string' || req.body.stockAdjustmentReason.trim().length > 160)) {
    return res.status(400).json({ message: 'Stock adjustment reason cannot exceed 160 characters' });
  }
  let session;
  let imageToDeleteAfterCommit = null;
  try {
    session = await mongoose.startSession();
    let updatedProduct;
    await session.withTransaction(async () => {
      const product = await Product.findById(req.params.id).session(session);
      if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
      if (product.isArchived) {
        throw Object.assign(new Error('Restore the product before editing it'), { status: 409 });
      }

      const previousImage = product.image;
      const resolvedImage = resolveProductImageValue({
        file: req.file,
        body: req.body,
        removeImage: req.body.removeImage,
        currentImage: previousImage
      });

      const updatedName = name !== undefined ? String(name).trim() : product.name;
      const updatedSku = sku !== undefined ? normalizeSku(sku) : product.sku;
      const updatedCategory = category !== undefined ? category : product.category;
      const updatedPrice = price !== undefined ? Number(price) : product.price;
      const updatedStock = stockQuantity !== undefined ? stockQuantity : product.stockQuantity;
      const updatedThreshold = lowStockThreshold !== undefined ? lowStockThreshold : product.lowStockThreshold;

      const validationError = validateProduct({
        name: updatedName,
        sku: updatedSku,
        category: updatedCategory,
        price: updatedPrice,
        stockQuantity: updatedStock,
        lowStockThreshold: updatedThreshold
      });
      if (validationError) throw Object.assign(new Error(validationError), { status: 400 });

      const targetCategoryId = String(updatedCategory);
      const targetCategory = await Category.findById(targetCategoryId).session(session);
      if (!targetCategory) throw Object.assign(new Error('Category not found'), { status: 400 });

      const duplicateProduct = await Product.findOne({
        sku: updatedSku,
        _id: { $ne: product._id }
      }).session(session);
      if (duplicateProduct) {
        throw Object.assign(new Error('A product with this SKU already exists'), { status: 400 });
      }

      const previousStock = product.stockQuantity;
      const previousCategoryId = String(product.category);
      if (previousCategoryId !== targetCategoryId) {
        const oldCategoryUpdate = await Category.updateOne(
          { _id: previousCategoryId },
          { $inc: { referenceVersion: 1 } },
          { session }
        );
        if (oldCategoryUpdate.matchedCount !== 1) {
          throw Object.assign(new Error('Previous category not found'), { status: 409 });
        }
        const targetCategoryUpdate = await Category.updateOne(
          { _id: targetCategoryId },
          { $inc: { referenceVersion: 1 } },
          { session }
        );
        if (targetCategoryUpdate.matchedCount !== 1) {
          throw Object.assign(new Error('Category not found'), { status: 409 });
        }
      }

      if (previousImage && previousImage !== resolvedImage) imageToDeleteAfterCommit = previousImage;

      if (costUpdate) product.costPrice = costUpdate.value;
      product.name = updatedName;
      product.sku = updatedSku;
      product.category = targetCategoryId;
      product.price = updatedPrice;
      product.lowStockThreshold = Number(updatedThreshold);
      product.image = resolvedImage;

      if (previousStock !== Number(updatedStock)) {
        const reason = typeof req.body.stockAdjustmentReason === 'string'
          ? req.body.stockAdjustmentReason.trim()
          : '';
        updatedProduct = await saveInventoryAdjustment({
          product,
          quantityAfter: Number(updatedStock),
          userId: req.user.id,
          reason,
          session,
          StockMovementModel: StockMovement
        });
      } else {
        updatedProduct = await product.save({ session });
      }
    });

    if (req.file) req.productImagePersisted = true;
    if (imageToDeleteAfterCommit) deleteStoredProductImage(imageToDeleteAfterCommit);
    res.json(updatedProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A product with this SKU already exists'
      });
    }

    if (req.file) {
      deleteStoredProductImage(`/uploads/products/${req.file.filename}`);
    }

    res.status(error.status || 400).json({ message: error.message });
  } finally {
    if (session) await session.endSession();
  }
});

// Bulk delete products (Admin only)
// Preserves historical transactions by archiving products that have sales,
// while permanently deleting products with no sales history.
router.delete('/', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) => {
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

    // Preserve products referenced by either sales or the stock audit log.
    const salesWithItems = await Sale.distinct('items.productId');
    const movedProductIds = await StockMovement.distinct('product');
    const referencedIds = [...new Map([...salesWithItems, ...movedProductIds]
      .filter(id => id != null)
      .map(id => [String(id), id])).values()];

    const productsToDelete = await Product.find({ _id: { $nin: referencedIds } });
    for (const prod of productsToDelete) {
      if (prod.image) {
        deleteStoredProductImage(prod.image);
      }
    }

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
        prod.isArchived = true;
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
router.delete('/:id', protect, checkPermission(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) =>{
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if referenced in historical sales
    const [salesCount, movementCount] = await Promise.all([
      Sale.countDocuments({ 'items.productId': req.params.id }),
      StockMovement.countDocuments({ product: req.params.id })
    ]);

    if (salesCount > 0 || movementCount > 0) {
      // Historical references must retain both the product and its movement log.
      product.isArchived = true;
      await product.save();

      return res.json({
        message: 'Product is referenced by historical records and was archived to preserve history.',
        archived: true
      });
    }

    // No sales reference: Safe to permanently remove
    if (product.image) {
      deleteStoredProductImage(product.image);
    }
    await product.deleteOne();
    res.json({ message: 'Product deleted successfully', deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Error during product deletion: ' + error.message });
  }
});

module.exports = router;
module.exports.validateProduct = validateProduct;
module.exports.normalizeSku = normalizeSku;
