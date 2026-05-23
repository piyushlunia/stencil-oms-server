const mongoose = require('mongoose');

const transporterSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  code:        { type: String, trim: true },
  phone:       { type: String, trim: true },
  email:       { type: String, trim: true, lowercase: true },
  address:     { type: String, trim: true },
  city:        { type: String, trim: true },
  avgTransitDays: { type: Number, default: 5 },
  isActive:    { type: Boolean, default: true },
  notes:       { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Transporter', transporterSchema);
