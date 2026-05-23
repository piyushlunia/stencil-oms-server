const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  code:     { type: String, trim: true },
  phone:    { type: String, trim: true },
  email:    { type: String, trim: true, lowercase: true },
  address:  { type: String, trim: true },
  city:     { type: String, trim: true },
  state:    { type: String, trim: true },
  gst:      { type: String, trim: true },
  category: { type: String, trim: true },
  paymentTerms: { type: String, default: '30 days' },
  leadTimeDays: { type: Number, default: 7 },
  isActive: { type: Boolean, default: true },
  notes:    { type: String },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

supplierSchema.index({ name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
