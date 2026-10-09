const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  const categories = await Category.find({});
  res.json(categories);
});

router.post('/', protect, admin, async (req, res) => {
  const { name } = req.body;
  try {
    const category = new Category({ name });
    const created = await category.save();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
