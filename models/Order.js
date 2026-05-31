const mongoose = require('mongoose');

// ── Trail Entry ──────────────────────────────────────────────────
const trailEntrySchema = new mongoose.Schema({
  type:  { type: String, default: 'edit' },
  desc:  { type: String, default: '' },
  from:  { type: String, default: '' },
  to:    { type: String, default: '' },
  note:  { type: String, default: '' },
  by:    { type: String, default: 'System' },
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
  eta:            { type: String },
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

  // PO / Vendor
  poNum:          { type: String, trim: true, default: '' },
  vendorPoNum:    { type: String, trim: true, default: '' },

  // Staff fields
  biller:         { type: String, trim: true, default: '' },
  salesExec:      { type: String, trim: true, default: '' },

  // Cancel fields
  cancelReason:   { type: String, default: '' },
  cancelledBy:    { type: String, default: '' },
  cancelledAt:    { type: String, default: '' },

  // GRN flat fields
  grnNo:          { type: String, trim: true, default: '' },
  grnDate:        { type: String, default: '' },
  grnBy:          { type: String, default: '' },
  grnRemarks:     { type: String, default: '' },
  purchVoucherNo: { type: String, trim: true, default: '' },
  physGrnNo:      { type: String, trim: true, default: '' },
  physGrnDate:    { type: String, default: '' },

  // Vendor invoice flat fields
  vendorInvoiceNum:  { type: String, trim: true, default: '' },
  vendorInvoiceDate: { type: String, default: '' },

  // Remarks / comments
  remark:         { type: String, default: '' },
  comments:       [{ type: mongoose.Schema.Types.Mixed }],

  // Transit details (flexible object)
  transitDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Stock flags
  isStockOrder:     { type: Boolean, default: false },
  isStockAddition:  { type: Boolean, default: false },

  // Misc
  notes:          { type: String },
  isSplit:        { type: Boolean, default: false },
  linkedToOrderId:{ type: Number },

  // Sub-documents — stored as Mixed so frontend arrays/objects pass through without cast errors
  grn:            { type: mongoose.Schema.Types.Mixed, default: {} },
  billing:        { type: mongoose.Schema.Types.Mixed, default: [] },
  delivery:       { type: mongoose.Schema.Types.Mixed, default: {} },
  etaHistory:     [etaHistorySchema],
  trail:          [trailEntrySchema],

  // Created by
  createdBy:      { type: String },
  createdById:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive:       { type: Boolean, default: true },
  billerHistory: [{ type: String }],
  salesHistory: [{ type: String }],
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


// Accumulate every biller / sales-exec the order has ever had (for visibility)
trailEntrySchema.pre('save', function(next){
  try{
    if(this.biller){ if(!Array.isArray(this.billerHistory)) this.billerHistory=[]; if(!this.billerHistory.includes(this.biller)) this.billerHistory.push(this.biller); }
    if(this.salesExec){ if(!Array.isArray(this.salesHistory)) this.salesHistory=[]; if(!this.salesHistory.includes(this.salesExec)) this.salesHistory.push(this.salesExec); }
  }catch(e){}
  next();
});

module.exports = mongoose.model('Order', orderSchema);
