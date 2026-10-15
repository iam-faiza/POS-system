const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN'
  },
  startingFloat: {
    type: Number,
    required: true,
    min: 0
  },
  openedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  },
  actualCashCounted: {
    type: Number,
    default: 0
  },
  expectedCash: {
    type: Number,
    default: 0
  },
  cashSales: {
    type: Number,
    default: 0
  },
  cardSales: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  difference: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);