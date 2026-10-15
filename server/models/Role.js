const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: [{ type: String }],
  isSystemRole: { type: Boolean, default: false } // To prevent deletion of critical roles like admin
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
