const mongoose = require('mongoose');

const CHECKOUT_ATTEMPT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const checkoutAttemptSchema = new mongoose.Schema({
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String, required: true },
  requestHash: { type: String, required: true },
  status: { type: String, enum: ['reserved', 'processing', 'completed'], required: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  reservationToken: { type: String, select: false, default: null },
  ownerToken: { type: String, select: false, default: null },
  leaseExpiresAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

checkoutAttemptSchema.index({ cashier: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('CheckoutAttempt', checkoutAttemptSchema);
module.exports.CHECKOUT_ATTEMPT_TTL_MS = CHECKOUT_ATTEMPT_TTL_MS;
