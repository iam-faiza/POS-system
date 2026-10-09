const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const saleSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true, default: 0 },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'card'], default: 'cash' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
