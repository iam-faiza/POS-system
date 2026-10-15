const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Product name must be at least 2 characters'],
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [3, 'SKU must be at least 3 characters'],
    maxlength: [50, 'SKU cannot exceed 50 characters'],
    match: [/^[A-Z0-9_-]{3,50}$/, 'SKU must contain only letters, numbers, hyphens, or underscores']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    validate: {
      validator: Number.isSafeInteger,
      message: 'Stock quantity must be a safe whole number'
    },
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    required: [true, 'Low stock threshold is required'],
    min: [0, 'Low stock threshold cannot be negative'],
    validate: {
      validator: Number.isSafeInteger,
      message: 'Low stock threshold must be a safe whole number'
    },
    default: 5
  },
  costPrice: {
    type: Number,
    default: null,
    min: [0, 'Cost price cannot be negative']
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

productSchema.index({ isArchived: 1, category: 1 });
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
