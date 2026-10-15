const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { categoryNameError, normalizeCategoryKey, normalizeCategoryName } = require('../utils/categoryValidation');

function createCategoryRouter({
  CategoryModel = Category,
  ProductModel = Product,
  mongooseClient = mongoose,
  protectMiddleware = protect,
  checkPermissionMiddleware = checkPermission
  // adminMiddleware = admin
} = {}) {
  const router = express.Router();

  router.get('/', protectMiddleware, async (req, res) => {
    try {
      const categories = await CategoryModel.find({}).sort({ name: 1 });
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: 'Unable to load categories' });
    }
  });

  router.post('/', protectMiddleware, checkPermissionMiddleware(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) =>{
    const name = normalizeCategoryName(req.body?.name);
    const validationError = categoryNameError(name);
    if (validationError) return res.status(400).json({ message: validationError });

    try {
      const categories = await CategoryModel.find({}, 'name normalizedName');
      const key = normalizeCategoryKey(name);
      if (categories.some((item) => normalizeCategoryKey(item.normalizedName || item.name) === key)) {
        return res.status(409).json({ message: 'A category with this name already exists' });
      }

      const created = await new CategoryModel({ name, normalizedName: key }).save();
      return res.status(201).json(created);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'A category with this name already exists' });
      }
      return res.status(400).json({ message: error.message });
    }
  });

  router.put('/:id', protectMiddleware, checkPermissionMiddleware(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: 'Category ID is invalid' });
    }
    const name = normalizeCategoryName(req.body?.name);
    const validationError = categoryNameError(name);
    if (validationError) return res.status(400).json({ message: validationError });

    try {
      const categories = await CategoryModel.find({ _id: { $ne: req.params.id } }, 'name normalizedName');
      const key = normalizeCategoryKey(name);
      if (categories.some((item) => normalizeCategoryKey(item.normalizedName || item.name) === key)) {
        return res.status(409).json({ message: 'A category with this name already exists' });
      }

      const category = await CategoryModel.findById(req.params.id);
      if (!category) return res.status(404).json({ message: 'Category not found' });
      category.name = name;
      category.normalizedName = key;
      const updated = await category.save();
      return res.json(updated);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'A category with this name already exists' });
      }
      return res.status(400).json({ message: error.message });
    }
  });

  router.delete('/:id', protectMiddleware, checkPermissionMiddleware(PERMISSIONS.PRODUCTS_MANAGE), async (req, res) =>{
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: 'Category ID is invalid' });
    }

    let session;
    try {
      session = await mongooseClient.startSession();
      await session.withTransaction(async () => {
        const category = await CategoryModel.findById(req.params.id).session(session);
        if (!category) {
          const error = new Error('Category not found');
          error.status = 404;
          throw error;
        }

        const touched = await CategoryModel.updateOne(
          { _id: req.params.id },
          { $inc: { referenceVersion: 1 } },
          { session }
        );
        if (touched.matchedCount !== 1) {
          const error = new Error('Category not found');
          error.status = 404;
          throw error;
        }

        const referencingProduct = await ProductModel.findOne({ category: req.params.id }).session(session);
        if (referencingProduct) {
          const error = new Error('Category is in use by one or more products');
          error.status = 409;
          throw error;
        }

        await category.deleteOne({ session });
      });
      return res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.status ? error.message : 'Unable to delete category'
      });
    } finally {
      if (session) await session.endSession();
    }
  });

  return router;
}

module.exports = createCategoryRouter();
module.exports.createCategoryRouter = createCategoryRouter;
