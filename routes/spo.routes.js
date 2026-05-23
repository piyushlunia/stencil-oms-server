const router = require('express').Router();
const Order  = require('../models/Order');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect, can('viewPendingSpo'));

// GET /api/spos — Pending SPOs (PO Raised status)
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true, status: 'PO Raised' };
    if (search) filter.$or = [
      { customer: { $regex: search, $options: 'i' } },
      { vendor:   { $regex: search, $options: 'i' } },
      { product:  { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort('-orderDate').skip(skip).limit(parseInt(limit))
        .select('seqId customer product qty orderDate eta status vendor vendorInvoice'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

// PATCH /api/spos/:id/raise-po
router.patch('/:id/raise-po', can('raisePo'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const prev = order.status;
    if (req.body.vendor)       order.vendor = req.body.vendor;
    if (req.body.supplierId)   order.supplierId = req.body.supplierId;
    if (req.body.eta)          order.eta = req.body.eta;
    order.status = 'PO Raised';
    order.trail.push({ type:'po', desc:'PO Raised', from: prev, to:'PO Raised', note: req.body.note||'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: 'PO raised' });
  } catch (err) { next(err); }
});

module.exports = router;
