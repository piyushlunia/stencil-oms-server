const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: {
    type: String,
    enum: ['superadmin','admin','manager','logistics','purchase','biller','salesman'],
    default: 'salesman',
  },
  roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  // User-level permission overrides (empty = use role defaults)
  permissionOverrides: [{ type: String }],
  isActive:  { type: Boolean, default: true },
  phone:     { type: String, trim: true },
  avatar:    { type: String },
  lastLogin: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Clean output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
