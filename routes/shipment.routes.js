const router = require('express').Router();
const Order  = require('../models/Order');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect);

// GET /api/shipments — all in-transit orders
router.get('/', can('viewShipments'), async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true, status: { $in: ['In Transit','At Transporter','Warehouse'] } };
    if (search) filter.$or = [
      { lr: { $regex: search, $options: 'i' } },
      { transporter: { $regex: search, $options: 'i' } },
      { customer: { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort('eta').skip(skip).limit(parseInt(limit))
        .select('seqId customer product qty status eta lr lrDate transporter vendor transitMode'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, data: orders, total });
  } catch (err) { next(err); }
});

// PATCH /api/shipments/:id/dispatch — mark In Transit
router.patch('/:id/dispatch', can('logisticsUpdate'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const prev = order.status;
    const { lr, lrDate, transporter, transporterId, transitMode, transitForm, vendorInvoice, transitDays, eta, note } = req.body;

    if (lr)           order.lr           = lr;
    if (lrDate)       order.lrDate       = lrDate;
    if (transporter)  order.transporter  = transporter;
    if (transporterId)order.transporterId= transporterId;
    if (transitMode)  order.transitMode  = transitMode;
    if (transitForm)  order.transitForm  = transitForm;
    if (vendorInvoice)order.vendorInvoice= vendorInvoice;
    if (transitDays)  order.transitDays  = transitDays;
    if (eta) {
      const prevEta = order.eta;
      order.eta = eta;
      order.etaHistory.push({ from: prevEta, to: eta, reason:'Transit dispatch', changedBy: req.user.name, changedById: req.user._id });
      order.trail.push({ type:'eta', desc:'ETA updated on dispatch', from: prevEta, to: eta, note:'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    }
    order.status = 'In Transit';
    order.trail.push({ type:'logistics', desc:'Dispatched / In Transit', from: prev, to:'In Transit', note: note || `${transitMode||''} · LR: ${lr||''}`, by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: 'Marked as In Transit' });
  } catch (err) { next(err); }
});

// PATCH /api/shipments/:id/arrived — mark At Transporter or Warehouse
router.patch('/:id/arrived', can('transitUpdate'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const prev = order.status;
    const newStatus = req.body.status || 'At Transporter';
    order.status = newStatus;
    order.trail.push({ type:'status', desc:`Arrived: ${newStatus}`, from: prev, to: newStatus, note: req.body.note||'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: `Status updated to ${newStatus}` });
  } catch (err) { next(err); }
});

module.exports = router;
