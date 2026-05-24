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

exports.getOrders = async (req, res, next) => {
  try {
    const { status, customer, vendor, search, from, to, page = 1, limit = 100, sort = '-orderDate' } = req.query;
    const filter = { isActive: true };
    if (status)   filter.status   = { $in: status.split(',') };
    if (customer) filter.customer = { $regex: customer, $options: 'i' };
    if (vendor)   filter.vendor   = { $regex: vendor,   $options: 'i' };
    if (from || to) { filter.orderDate = {}; if (from) filter.orderDate.$gte = new Date(from); if (to) filter.orderDate.$lte = new Date(to + 'T23:59:59'); }
    if (search) { filter.$or = [{ customer: { $regex: search, $options: 'i' } }, { product: { $regex: search, $options: 'i' } }, { vendor: { $regex: search, $options: 'i' } }, { lr: { $regex: search, $options: 'i' } }]; const seqMatch = search.match(/(\d+)/); if (seqMatch) filter.$or.push({ seqId: parseInt(seqMatch[1]) }); }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([Order.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).populate('customerId','name city').populate('supplierId','name').populate('transporterId','name avgTransitDays'), Order.countDocuments(filter)]);
    res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getOrder = async (req, res, next) => { try { const order = await Order.findOne({ $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { seqId: parseInt(req.params.id) || -1 }] }).populate('customerId supplierId transporterId productId'); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); res.json({ success: true, data: order }); } catch (err) { next(err); } };

exports.createOrder = async (req, res, next) => { try { const body = req.body; const order = new Order({ ...body, createdBy: req.user.name || req.user.username, createdById: req.user._id }); order.trail = [trailEntry('created','Order created','',body.status||'Order','',req.user)]; await order.save(); syncToSheets(order).catch(()=>{}); res.status(201).json({ success: true, data: order, message: 'Order created' }); } catch (err) { next(err); } };

exports.updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const prevEta = order.eta;
    const prevStatus = order.status;
    const changes = [];

    const denied = new Set(['_id', '__v', 'seqId', 'createdAt', 'updatedAt', 'createdById', 'isActive']);

    Object.keys(req.body).forEach(k => {
      if (denied.has(k)) return;
      const newVal = req.body[k];
      const oldVal = order[k];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        changes.push(k + ': ' + oldVal + ' -> ' + newVal);
      }
      order[k] = newVal;
    });

    if (req.body.eta && req.body.eta !== prevEta) {
      order.etaHistory = order.etaHistory || [];
      order.etaHistory.push({ from: prevEta, to: req.body.eta, reason: req.body.etaReason || '', changedBy: req.user.name, changedById: req.user._id });
      order.trail.push(trailEntry('eta', 'ETA changed', prevEta, req.body.eta, req.body.etaReason || '', req.user));
    }

    if (req.body.status && req.body.status !== prevStatus) {
      order.trail.push(trailEntry('status', 'Status changed to ' + req.body.status, prevStatus, req.body.status, '', req.user));
    }

    if (changes.length) {
      order.trail.push(trailEntry('edited', 'Order updated', '', changes.slice(0, 5).join(' | '), '', req.user));
    }

    await order.save();
    syncToSheets(order).catch(()=>{});
    res.json({ success: true, data: order, message: 'Order updated' });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => { try { const { status, note, ...extra } = req.body; if (!status) return res.status(400).json({ success: false, message: 'Status required' }); const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); const prev = order.status; order.status = status; const logFields = ['lr','lrDate','transporter','transporterId','transitMode','transitForm','vendorInvoice','transitDays']; logFields.forEach(k => { if (extra[k] !== undefined) order[k] = extra[k]; }); order.trail.push(trailEntry('status', 'Status changed to ' + status, prev, status, note||'', req.user)); await order.save(); syncToSheets(order).catch(()=>{}); res.json({ success: true, data: order, message: 'Status updated to ' + status }); } catch (err) { next(err); } };

exports.updateEta = async (req, res, next) => { try { const { eta, reason } = req.body; if (!eta) return res.status(400).json({ success: false, message: 'ETA required' }); const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); const prevEta = order.eta; order.eta = eta; order.etaHistory.push({ from: prevEta, to: eta, reason: reason||'', changedBy: req.user.name, changedById: req.user._id }); order.trail.push(trailEntry('eta','ETA changed', prevEta, eta, reason||'', req.user)); await order.save(); res.json({ success: true, data: order, message: 'ETA updated' }); } catch (err) { next(err); } };

exports.addComment = async (req, res, next) => { try { const { text } = req.body; if (!text) return res.status(400).json({ success: false, message: 'Comment text required' }); const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); order.trail.push(trailEntry('comment', text, '', text, '', req.user)); await order.save(); res.json({ success: true, data: order.trail.at(-1), message: 'Comment added' }); } catch (err) { next(err); } };

exports.raiseGrn = async (req, res, next) => { try { const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); order.grn = { ...req.body, raisedBy: req.user.name, raisedById: req.user._id, raisedAt: new Date() }; order.status = 'GRN'; order.trail.push(trailEntry('grn','GRN raised', order.status, 'GRN', req.body.notes||'', req.user)); await order.save(); res.json({ success: true, data: order, message: 'GRN raised' }); } catch (err) { next(err); } };

exports.addBilling = async (req, res, next) => { try { const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); order.billing = { ...req.body, billedBy: req.user.name, billedById: req.user._id, billedAt: new Date() }; order.status = 'Billed'; order.trail.push(trailEntry('billing','Order billed', order.status, 'Billed', req.body.notes||'', req.user)); await order.save(); res.json({ success: true, data: order, message: 'Billing recorded' }); } catch (err) { next(err); } };

exports.markDelivered = async (req, res, next) => { try { const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); order.delivery = { ...req.body, deliveredBy: req.user.name, deliveredById: req.user._id, deliveredAt: new Date() }; order.status = 'Delivered'; order.trail.push(trailEntry('delivery','Order delivered', order.status, 'Delivered', req.body.notes||'', req.user)); await order.save(); res.json({ success: true, data: order, message: 'Marked as delivered' }); } catch (err) { next(err); } };

exports.splitOrder = async (req, res, next) => { try { const { splitQty } = req.body; const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); if (splitQty >= order.qty) return res.status(400).json({ success: false, message: 'Split qty must be less than total qty' }); const remQty = order.qty - splitQty; order.qty = splitQty; order.isSplit = true; order.trail.push(trailEntry('split', 'Order split ' + splitQty + ' / ' + remQty, '','','', req.user)); await order.save(); const remainder = new Order({ ...order.toObject(), _id: undefined, seqId: undefined, qty: remQty, isSplit: true, linkedToOrderId: order.seqId, trail: [trailEntry('created','Split from DON-' + order.seqId,'','Order','',req.user)], etaHistory: [], grn: undefined, billing: undefined, delivery: undefined }); await remainder.save(); res.json({ success: true, data: { original: order, split: remainder }, message: 'Order split' }); } catch (err) { next(err); } };

exports.getTrail = async (req, res, next) => { try { const order = await Order.findById(req.params.id).select('trail seqId customer'); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); res.json({ success: true, data: order.trail }); } catch (err) { next(err); } };

exports.deleteOrder = async (req, res, next) => { try { const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); order.isActive = false; order.trail.push(trailEntry('edited','Order deleted (soft)','','Deleted','', req.user)); await order.save(); res.json({ success: true, message: 'Order deleted' }); } catch (err) { next(err); } };
