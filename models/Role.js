const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  label:       { type: String, required: true, trim: true },
  isBuiltIn:   { type: Boolean, default: false },
  permissions: [{ type: String }],
  description: { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
