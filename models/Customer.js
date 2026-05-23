const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  code:     { type: String, trim: true },
  phone:    { type: String, trim: true },
  email:    { type: String, trim: true, lowercase: true },
  address:  { type: String, trim: true },
  city:     { type: String, trim: true },
  state:    { type: String, trim: true },
  gst:      { type: String, trim: true },
  type:     { type: String, enum: ['Dealer','Distributor','Retailer','Direct','Other'], default: 'Dealer' },
  creditLimit: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  notes:    { type: String },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

customerSchema.index({ name: 1 });
customerSchema.index({ city: 1 });

module.exports = mongoose.model('Customer', customerSchema);
