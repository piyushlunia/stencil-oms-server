const Order = require('../models/Order');
const { syncToSheets } = require('./sheetsSync');

const trailEntry = (type, desc, from, to, note, user) => ({
  type, desc,
  from: from || '',
  to:   to   || '',
  note: note || '',
  by:   user.name || user.username || 'System',
  byId: user._id,
  role: user.role || '',
  at:   new Date(),
});

// ── GET /api/orders ──────────────────────────────────────────────────────────
exports.getOrders = async (req, res, next) => {
  try {
    const {
      status, customer, vendor, search,
      from, to, page = 1, limit = 100,
      sort = '-orderDate',
    } = req.query;

    const filter = { isActive: true };
    if (status)   filter.status   = { $in: status.split(',') };
    if (customer) filter.customer = { $regex: customer, $options: 'i' };
    if (vendor)   filter.vendor   = { $regex: vendor,   $options: 'i' };
    if (from || to) {
      filter.orderDate = {};
      if (from) filter.orderDate.$gte = new Date(from);
      if (to)   filter.orderDate.$lte = new Date(to + 'T23:59:59');
    }
    if (search) {
      filter.$or = [
        { customer:    { $regex: search, $options: 'i' } },
        { product:     { $regex: search, $options: 'i' } },
        { vendor:      { $regex: search, $options: 'i' } },
        { lr:          { $regex: search, $options: 'i' } },
        { orderedCode: { $regex: search, $options: 'i' } },
      ];
      // Also try matching DON-XXXX pattern
      const seqMatch = search.match(/(\d+)/);
      if (seqMatch) filter.$or.push({ seqId: parseInt(seqMatch[1]) });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(parseInt(limit))
        .populate('customerId','name city')
        .populate('supplierId','name')
        .populate('transporterId','name avgTransitDays'),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id ──────────────────────────────────────────────────────
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { seqId: parseInt(req.params.id) || -1 }] })
      .populate('customerId supplierId transporterId productId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ── POST /api/orders ─────────────────────────────────────────────────────────
exports.createOrder = async (req, res, next) => {
  try {
    const body = req.body;
    const order = new Order({
      ...body,
      createdBy: req.user.name || req.user.username,
      createdById: req.user._id,
    });
    order.trail = [trailEntry('created','Order created','',body.status||'Order','',req.user)];
    await order.save();
    syncToSheets(order).catch(() => {});
    res.status(201).json({ success: true, data: order, message: 'Order created' });
  } catch (err) { next(err); }
};

// ── PUT /api/orders/:id ──────────────────────────────────────────────────────
exports.updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const prevStatus = order.status;
    const prevEta    = order.eta;

    // Scalar fields — apply all that changed (do NOT block on a strict whitelist)
    const scalarFields = [
      'customer','customerId','product','productId','orderedCode','qty','vendor','supplierId',
      'orderDate','eta','etaBangalore','notes','purchaseRate','sellingRate','unit',
      'status','poNum','vendorPoNum','biller','salesExec',
      'lr','lrDate','transporter','transporterId','transitMode','transitForm',
      'vendorInvoiceNum','vendorInvoiceDate','vendorInvoice','transitDays',
      'cancelReason','cancelledBy','cancelledAt',
      'grnNo','grnDate','grnBy','grnRemarks','purchVoucherNo','physGrnNo','physGrnDate',
      'remark','isStockOrder','isStockAddition','linkedToOrderId','groupDonId',
    ];
    const changes = [];
    scalarFields.forEach(k => {
      if (req.body[k] !== undefined) {
        if (String(req.body[k]) !== String(order[k])) {
          changes.push(`${k}: ${order[k]} → ${req.body[k]}`);
        }
        order[k] = req.body[k];
      }
    });

    // Array / object fields — replace wholesale if provided
    if (req.body.comments    !== undefined) order.comments       = req.body.comments;
    if (req.body.etaHistory  !== undefined) order.etaHistory     = req.body.etaHistory;
    if (req.body.trail       !== undefined) order.trail          = req.body.trail;
    if (req.body.grn         !== undefined) order.grn            = req.body.grn;
    if (req.body.billing     !== undefined) order.billing        = req.body.billing;
    if (req.body.delivery    !== undefined) order.delivery       = req.body.delivery;
    if (req.body.transitDetails !== undefined) order.transitDetails = req.body.transitDetails;

    // ETA change → log etaHistory entry if not already in provided array
    if (req.body.eta && req.body.eta !== prevEta && req.body.etaHistory === undefined) {
      order.etaHistory.push({ from: prevEta, to: req.body.eta, reason: req.body.etaReason || '', changedBy: req.user.name, changedById: req.user._id });
    }

    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: 'Order updated' });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/status ─────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, ...extra } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const prev = order.status;
    order.status = status;

    // Merge any extra logistics fields
    const logFields = ['lr','lrDate','transporter','transporterId','transitMode','transitForm','vendorInvoice','transitDays'];
    logFields.forEach(k => { if (extra[k] !== undefined) order[k] = extra[k]; });

    order.trail.push(trailEntry('status', `Status changed to ${status}`, prev, status, note||'', req.user));
    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: `Status updated to ${status}` });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/eta ────────────────────────────────────────────────
exports.updateEta = async (req, res, next) => {
  try {
    const { eta, reason } = req.body;
    if (!eta) return res.status(400).json({ success: false, message: 'ETA required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const prevEta = order.eta;
    order.eta = eta;
    order.etaHistory.push({ from: prevEta, to: eta, reason: reason||'', changedBy: req.user.name, changedById: req.user._id });
    order.trail.push(trailEntry('eta','ETA changed', prevEta, eta, reason||'', req.user));

    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: 'ETA updated' });
  } catch (err) { next(err); }
};

// ── POST /api/orders/:id/comment ─────────────────────────────────────────────
exports.addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Comment text required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.trail.push(trailEntry('comment', text, '', text, '', req.user));
    await order.save();
    res.json({ success: true, data: order.trail.at(-1), message: 'Comment added' });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/grn ────────────────────────────────────────────────
exports.raiseGrn = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.grn = { ...req.body, raisedBy: req.user.name, raisedById: req.user._id, raisedAt: new Date() };
    order.status = 'GRN';
    order.trail.push(trailEntry('grn','GRN raised', order.status, 'GRN', req.body.notes||'', req.user));
    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: 'GRN raised' });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/billing ────────────────────────────────────────────
exports.addBilling = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.billing = { ...req.body, billedBy: req.user.name, billedById: req.user._id, billedAt: new Date() };
    order.status = 'Billed';
    order.trail.push(trailEntry('billing','Order billed', order.status, 'Billed', req.body.notes||'', req.user));
    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: 'Billing recorded' });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/delivery ───────────────────────────────────────────
exports.markDelivered = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.delivery = { ...req.body, deliveredBy: req.user.name, deliveredById: req.user._id, deliveredAt: new Date() };
    order.status = 'Delivered';
    order.trail.push(trailEntry('delivery','Order delivered', order.status, 'Delivered', req.body.notes||'', req.user));
    await order.save();
    syncToSheets(order).catch(() => {});
    res.json({ success: true, data: order, message: 'Marked as delivered' });
  } catch (err) { next(err); }
};

// ── POST /api/orders/:id/split ───────────────────────────────────────────────
exports.splitOrder = async (req, res, next) => {
  try {
    const { splitQty } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (splitQty >= order.qty) return res.status(400).json({ success: false, message: 'Split qty must be less than total qty' });

    const remQty = order.qty - splitQty;
    order.qty = splitQty;
    order.isSplit = true;
    order.trail.push(trailEntry('split', `Order split — ${splitQty} / ${remQty}`, '','',`Split qty: ${splitQty}`, req.user));
    await order.save();
    syncToSheets(order).catch(() => {});

    // Create remainder order
    const remainder = new Order({
      ...order.toObject(),
      _id: undefined,
      seqId: undefined,
      qty: remQty,
      isSplit: true,
      linkedToOrderId: order.seqId,
      trail: [trailEntry('created',`Split from DON-${order.seqId}`,'','Order','',req.user)],
      etaHistory: [],
      grn: undefined, billing: undefined, delivery: undefined,
    });
    await remainder.save();
    syncToSheets(remainder).catch(() => {});

    res.json({ success: true, data: { original: order, split: remainder }, message: 'Order split' });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id/trail ────────────────────────────────────────────────
exports.getTrail = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select('trail seqId customer');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order.trail });
  } catch (err) { next(err); }
};

// ── DELETE /api/orders/:id ───────────────────────────────────────────────────
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.isActive = false;
    order.trail.push(trailEntry('edited','Order deleted (soft)','','Deleted','', req.user));
    await order.save();
    res.json({ success: true, message: 'Order deleted' });
  } catch (err) { next(err); }
};


// ── POST /api/orders/maintenance/dedup  (admin only) ────────
// Finds duplicate ACTIVE orders sharing the same
// customer + product + qty + orderDate(day) + createdBy, and removes all
// but the one with the most-advanced status. Dry-run by default.
// Query/body: apply=true to perform; hard=true to hard-delete (default soft).
const STATUS_PRIORITY = ['Cancelled','Order','Approved','PO Raised','In Transit','At Transporter','Warehouse','GRN','Purchased','Billed','Delivered'];

exports.dedupOrders = async (req, res, next) => {
  try {
    const apply = req.query.apply === 'true' || req.body.apply === true;
    const hard  = req.query.hard  === 'true' || req.body.hard  === true;

    const norm   = v => String(v == null ? '' : v).trim().toLowerCase();
    const dayKey = d => { const dt = new Date(d); return isNaN(dt) ? '' : dt.toISOString().slice(0, 10); };
    const prio   = s => { const i = STATUS_PRIORITY.indexOf(s); return i === -1 ? 0 : i; };

    const orders = await Order.find({ isActive: true }).lean();
    const groups = {};
    for (const o of orders) {
      const key = [norm(o.customer), norm(o.product), o.qty, dayKey(o.orderDate), norm(o.createdBy)].join('|');
      (groups[key] = groups[key] || []).push(o);
    }

    const toRemove = [];
    const report   = [];
    for (const docs of Object.values(groups)) {
      if (docs.length < 2) continue;
      docs.sort((a, b) => {
        const pd = prio(b.status) - prio(a.status); if (pd) return pd;
        const td = (b.trail ? b.trail.length : 0) - (a.trail ? a.trail.length : 0); if (td) return td;
        const ud = new Date(b.updatedAt) - new Date(a.updatedAt); if (ud) return ud;
        return (a.seqId || 0) - (b.seqId || 0);
      });
      const keep = docs[0];
      const dups = docs.slice(1);
      dups.forEach(d => toRemove.push(d._id));
      report.push({
        customer: keep.customer, product: keep.product, qty: keep.qty,
        orderDate: dayKey(keep.orderDate), createdBy: keep.createdBy,
        kept:    { id: keep._id, seqId: keep.seqId, status: keep.status },
        removed: dups.map(d => ({ id: d._id, seqId: d.seqId, status: d.status })),
      });
    }

    let applied = false;
    if (apply && toRemove.length) {
      if (hard) {
        await Order.deleteMany({ _id: { $in: toRemove } });
      } else {
        const entry = trailEntry('edited', 'Removed as duplicate (dedup cleanup)', '', 'Deleted', '', req.user);
        await Order.updateMany({ _id: { $in: toRemove } }, { $set: { isActive: false }, $push: { trail: entry } });
      }
      applied = true;
    }

    res.json({
      success: true,
      dryRun: !apply,
      applied,
      mode: hard ? 'hard-delete' : 'soft-delete',
      duplicateGroups: report.length,
      ordersToRemove: toRemove.length,
      ordersRemoved: applied ? toRemove.length : 0,
      groups: report,
    });
  } catch (err) { next(err); }
};
