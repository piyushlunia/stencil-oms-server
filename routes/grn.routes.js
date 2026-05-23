const router = require('express').Router();
const Order  = require('../models/Order');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect);

// GET /api/grns — Orders that have GRN raised
router.get('/', can('viewAllOrders'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { isActive: true, status: { $in: ['GRN','Purchased','Billed','Delivered'] }, grn: { $exists: true } };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort('-updatedAt').skip(skip).limit(parseInt(limit))
        .select('seqId customer product qty status grn orderDate vendor'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, data: orders, total });
  } catch (err) { next(err); }
});

// PATCH /api/grns/:id — Raise or update GRN
router.patch('/:id', can('raiseGrn'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.grn = { ...req.body, raisedBy: req.user.name, raisedById: req.user._id, raisedAt: new Date() };
    if (order.status === 'Warehouse' || order.status === 'At Transporter') order.status = 'GRN';
    order.trail.push({ type:'grn', desc:'GRN raised/updated', from:'', to:'GRN', note: req.body.notes||'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: 'GRN updated' });
  } catch (err) { next(err); }
});

// PATCH /api/grns/:id/purchase — Mark as Purchased
router.patch('/:id/purchase', can('purchaseOrder'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const prev = order.status;
    order.status = 'Purchased';
    if (req.body.purchaseRate) order.purchaseRate = req.body.purchaseRate;
    if (req.body.sellingRate)  order.sellingRate  = req.body.sellingRate;
    order.trail.push({ type:'status', desc:'Marked as Purchased', from: prev, to:'Purchased', note: req.body.note||'', by: req.user.name, byId: req.user._id, role: req.user.role, at: new Date() });
    await order.save();
    res.json({ success: true, data: order, message: 'Marked as Purchased' });
  } catch (err) { next(err); }
});

module.exports = router;
