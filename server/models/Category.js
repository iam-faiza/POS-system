const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  normalizedName: { type: String, unique: true, sparse: true, select: false },
  referenceVersion: { type: Number, default: 0, select: false }
}, { timestamps: true });

categorySchema.pre('validate', function normalizeCategoryName() {
  if (typeof this.name === 'string') {
    this.name = this.name.trim().replace(/\s+/g, ' ');
    this.normalizedName = this.name.toLocaleLowerCase('en');
  }
});

module.exports = mongoose.model('Category', categorySchema);
