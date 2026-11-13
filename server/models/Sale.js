const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const saleSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerSnapshot: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, min: 0 }
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true, default: 0 },
  taxRate: { type: Number, min: 0, max: 100 },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  cashReceived: { type: Number, min: 0 },
  changeDue: { type: Number, min: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card'], default: 'cash' },
  paymentDetails: {
    cardType: { type: String },
    cardholderName: { type: String },
    last4: { type: String },
    transactionRef: { type: String }
  },
  idempotencyKey: { type: String, select: false },
  checkoutRequestHash: { type: String, select: false }
}, { timestamps: true });

// Speeds up sales history, today's summary and per-cashier views as data grows.
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashier: 1, createdAt: -1 });
saleSchema.index({ customer: 1 });
saleSchema.index(
  { cashier: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } }
  }
);

module.exports = mongoose.model('Sale', saleSchema);
