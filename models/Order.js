const mongoose = require('mongoose');

// ── Trail Entry ──────────────────────────────────────────────────
const trailEntrySchema = new mongoose.Schema({
  type:  { type: String, enum: ['created','status','eta','comment','split','grn','billing','delivery','logistics','po','edited'], required: true },
  desc:  { type: String, required: true },
  from:  { type: String, default: '' },
  to:    { type: String, default: '' },
  note:  { type: String, default: '' },
  by:    { type: String, required: true },
  byId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role:  { type: String, default: '' },
  at:    { type: Date, default: Date.now },
}, { _id: true });

// ── ETA History Entry ────────────────────────────────────────────
const etaHistorySchema = new mongoose.Schema({
  from:       { type: String },
  to:         { type: String },
  reason:     { type: String },
  changedBy:  { type: String },
  changedById:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt:  { type: Date, default: Date.now },
}, { _id: true });

// ── GRN Sub-doc ──────────────────────────────────────────────────
const grnSchema = new mongoose.Schema({
  grnNumber:    { type: String },
  receivedQty:  { type: Number },
  receivedDate: { type: Date },
  condition:    { type: String, enum: ['Good','Damaged','Partial'], default: 'Good' },
  notes:        { type: String },
  raisedBy:     { type: String },
  raisedById:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  raisedAt:     { type: Date },
}, { _id: false });

// ── Billing Sub-doc ──────────────────────────────────────────────
const billingSchema = new mongoose.Schema({
  invoiceNumber: { type: String },
  invoiceDate:   { type: Date },
  billedBy:      { type: String },
  billedById:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  billedAt:      { type: Date },
  amount:        { type: Number },
  notes:         { type: String },
}, { _id: false });

// ── Delivery Sub-doc ─────────────────────────────────────────────
const deliverySchema = new mongoose.Schema({
  deliveredDate: { type: Date },
  receivedBy:    { type: String },
  deliveredBy:   { type: String },
  deliveredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveredAt:   { type: Date },
  notes:         { type: String },
  podImage:      { type: String },
}, { _id: false });

// ── Main Order Schema ────────────────────────────────────────────
const orderSchema = new mongoose.Schema({
  // Sequential numeric DON id (for display as DON-XXXX)
  seqId:          { type: Number },
  groupDonId:     { type: Number },

  // Order details
  customer:       { type: String, required: true, trim: true },
  customerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  product:        { type: String, required: true, trim: true },
  productId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  orderedCode:    { type: String, trim: true },
  qty:            { type: Number, required: true, min: 1 },
  unit:           { type: String, default: 'pcs' },

  // Vendor / Supplier
  vendor:         { type: String, trim: true },
  supplierId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },

  // Dates
  orderDate:      { type: Date, required: true, default: Date.now },
  eta:            { type: String },   // stored as YYYY-MM-DD string (to match frontend)
  etaBangalore:   { type: String },

  // Status
  status: {
    type: String,
    enum: ['Order','Approved','PO Raised','In Transit','At Transporter','Warehouse','GRN','Purchased','Billed','Delivered','Cancelled'],
    default: 'Order',
  },

  // Logistics
  lr:             { type: String, trim: true },
  lrDate:         { type: String },
  transporter:    { type: String, trim: true },
  transporterId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Transporter' },
  transitMode:    { type: String },
  transitForm:    { type: String },
  vendorInvoice:  { type: String, trim: true },
  transitDays:    { type: Number },

  // Pricing
  purchaseRate:   { type: Number },
  sellingRate:    { type: Number },

  // Misc
  notes:          { type: String },
  isSplit:        { type: Boolean, default: false },
  linkedToOrderId:{ type: Number },

  // Sub-documents
  grn:            { type: grnSchema },
  billing:        { type: billingSchema },
  delivery:       { type: deliverySchema },
  etaHistory:     [etaHistorySchema],
  trail:          [trailEntrySchema],

  // Created by
  createdBy:      { type: String },
  createdById:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────
orderSchema.index({ seqId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ eta: 1 });
orderSchema.index({ customerId: 1 });

// ── Auto-increment seqId ─────────────────────────────────────────
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.seqId) {
    const last = await this.constructor.findOne({}, {}, { sort: { seqId: -1 } });
    this.seqId = last ? last.seqId + 1 : 1001;
    if (!this.groupDonId) this.groupDonId = this.seqId;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
