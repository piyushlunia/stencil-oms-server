const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  code:        { type: String, trim: true, unique: true, sparse: true },
  description: { type: String, trim: true },
  category:    { type: String, trim: true },
  unit:        { type: String, default: 'pcs' },
  hsn:         { type: String, trim: true },
  purchaseRate:{ type: Number, default: 0 },
  sellingRate: { type: Number, default: 0 },
  gstPercent:  { type: Number, default: 18 },
  isActive:      { type: Boolean, default: true },
  parentCode:    { type: String, trim: true, default: '' },
  parentAlias:   { type: String, trim: true, default: '' },
  defaultVendor: { type: String, trim: true, default: '' },
  preferredSuppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
  notes:       { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ code: 1 });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
