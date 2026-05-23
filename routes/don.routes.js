const router  = require('express').Router();
const Order   = require('../models/Order');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect, can('viewPendingDon'));

// GET /api/dons — Pending DONs (Order or Approved status)
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true, status: { $in: ['Order','Approved'] } };
    if (search) filter.$or = [
      { customer: { $regex: search, $options: 'i' } },
      { product:  { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort('-orderDate').skip(skip).limit(parseInt(limit))
        .select('seqId customer product qty orderDate eta status vendor notes createdBy'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

// PATCH /api/dons/:id/approve
router.patch('/:id/approve', can('approve'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const prev = order.status;
    order.status = 'Approved';
    order.trail.push({ type:'status', desc:'DON Approved', from: prev, to:'Approved', note: req.body.note||'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: 'DON approved' });
  } catch (err) { next(err); }
});

module.exports = router;
