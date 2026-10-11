const mongoose = require('mongoose');
const { Schema } = mongoose;

const stockMovementSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true },
  quantityDelta: {
    type: Number,
    required: true,
    immutable: true,
    validate: Number.isSafeInteger
  },
  quantityBefore: {
    type: Number,
    required: true,
    immutable: true,
    validate: Number.isSafeInteger
  },
  quantityAfter: {
    type: Number,
    required: true,
    immutable: true,
    validate: Number.isSafeInteger
  },
  type: { type: String, enum: ['sale', 'adjustment'], required: true, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 160, immutable: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  sale: { type: Schema.Types.ObjectId, ref: 'Sale', immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

stockMovementSchema.index({ product: 1, createdAt: -1 });

stockMovementSchema.pre('validate', function validateMovement() {
  if (!Number.isSafeInteger(this.quantityDelta) || this.quantityDelta === 0) {
    this.invalidate('quantityDelta', 'Movement delta must be a non-zero safe whole number');
  }
  if (!Number.isSafeInteger(this.quantityBefore) || this.quantityBefore < 0 ||
      !Number.isSafeInteger(this.quantityAfter) || this.quantityAfter < 0 ||
      this.quantityBefore + this.quantityDelta !== this.quantityAfter) {
    this.invalidate('quantityAfter', 'Movement before/after quantities are inconsistent');
  }
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);