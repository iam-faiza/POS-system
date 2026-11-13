const mongoose = require('mongoose');

const posSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  locked: { type: Boolean, default: false },
  lockedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PosSession', posSessionSchema);
