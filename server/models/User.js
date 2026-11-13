const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'cashier' },
  roleRef: { type: Schema.Types.ObjectId, ref: 'Role' },
  pinHash: { type: String, select: false, default: null },
  pinFailedAttempts: { type: Number, select: false, default: 0 },
  pinLockedUntil: { type: Date, select: false, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
