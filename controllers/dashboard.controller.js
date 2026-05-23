const Order = require('../models/Order');

const todayStr = () => new Date().toISOString().slice(0, 10);
const dateStr  = (d) => d.toISOString().slice(0, 10);

// GET /api/dashboard/summary
exports.getSummary = async (req, res, next) => {
  try {
    const today = todayStr();
    const yesterday = dateStr(new Date(Date.now() - 86400000));

    const [
      totalActive,
      pendingApproval,
      inTransit,
      atTransporter,
      warehouse,
      overdueCount,
      purchasedToday,
      purchasedYesterday,
      pendingDons,
      pendingSpos,
    ] = await Promise.all([
      Order.countDocuments({ isActive: true, status: { $nin: ['Delivered','Cancelled'] } }),
      Order.countDocuments({ isActive: true, status: 'Order' }),
      Order.countDocuments({ isActive: true, status: 'In Transit' }),
      Order.countDocuments({ isActive: true, status: 'At Transporter' }),
      Order.countDocuments({ isActive: true, status: 'Warehouse' }),
      Order.countDocuments({ isActive: true, eta: { $lt: today }, status: { $nin: ['Purchased','Billed','Delivered','Cancelled'] } }),
      Order.countDocuments({ isActive: true, status: 'Purchased', 'grn.receivedDate': { $gte: new Date(today) } }),
      Order.countDocuments({ isActive: true, status: 'Purchased', 'grn.receivedDate': { $gte: new Date(yesterday), $lt: new Date(today) } }),
      Order.countDocuments({ isActive: true, status: { $in: ['Order','Approved'] } }),
      Order.countDocuments({ isActive: true, status: 'PO Raised' }),
    ]);

    res.json({
      success: true,
      data: {
        totalActive, pendingApproval, inTransit, atTransporter, warehouse,
        overdueCount, purchasedToday, purchasedYesterday, pendingDons, pendingSpos,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/dashboard/pipeline
exports.getPipeline = async (req, res, next) => {
  try {
    const stages = ['Order','Approved','PO Raised','In Transit','At Transporter','Warehouse','GRN','Purchased','Billed','Delivered'];
    const counts = await Order.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 }, qty: { $sum: '$qty' } } },
    ]);
    const map = {};
    counts.forEach(c => { map[c._id] = { count: c.count, qty: c.qty }; });
    const pipeline = stages.map(s => ({ stage: s, count: map[s]?.count || 0, qty: map[s]?.qty || 0 }));
    res.json({ success: true, data: pipeline });
  } catch (err) { next(err); }
};

// GET /api/dashboard/recent-orders
exports.getRecentOrders = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const orders = await Order.find({ isActive: true })
      .sort('-orderDate')
      .limit(parseInt(limit))
      .select('seqId customer product qty status orderDate eta vendor lr');
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// GET /api/dashboard/due-orders
exports.getDueOrders = async (req, res, next) => {
  try {
    const today = todayStr();
    const tomorrow = dateStr(new Date(Date.now() + 86400000));
    const activeStatuses = ['Order','Approved','PO Raised','In Transit','At Transporter','Warehouse','GRN'];

    const [overdue, dueToday, dueThisWeek] = await Promise.all([
      Order.find({ isActive: true, status: { $in: activeStatuses }, eta: { $lt: today } }).sort('eta').select('seqId customer product qty status eta vendor'),
      Order.find({ isActive: true, status: { $in: activeStatuses }, eta: today }).sort('customer').select('seqId customer product qty status eta vendor'),
      Order.find({ isActive: true, status: { $in: activeStatuses }, eta: { $gte: today, $lte: dateStr(new Date(Date.now() + 7*86400000)) } }).sort('eta').select('seqId customer product qty status eta vendor'),
    ]);

    res.json({ success: true, data: { overdue, dueToday, dueThisWeek } });
  } catch (err) { next(err); }
};

// GET /api/dashboard/purchased
exports.getPurchased = async (req, res, next) => {
  try {
    const today = todayStr();
    const yesterday = dateStr(new Date(Date.now() - 86400000));

    const orders = await Order.find({
      isActive: true,
      status: { $in: ['Purchased','Billed','Delivered'] },
      orderDate: { $gte: new Date(yesterday) },
    }).sort('-orderDate').select('seqId customer product qty status orderDate vendor purchaseRate sellingRate');

    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// GET /api/dashboard/lr-at-transporter
exports.getLrAtTransporter = async (req, res, next) => {
  try {
    const orders = await Order.find({ isActive: true, status: { $in: ['In Transit','At Transporter'] } })
      .sort('eta')
      .select('seqId customer product qty status eta lr lrDate transporter vendor');
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// GET /api/dashboard/eta-edited
exports.getEtaEdited = async (req, res, next) => {
  try {
    const today = todayStr();
    const PREPARED_STATUSES = ['At Transporter','Warehouse','Purchased'];

    const orders = await Order.find({
      isActive: true,
      'etaHistory.0': { $exists: true },
    }).select('seqId groupDonId customer product qty status eta etaHistory trail vendor');

    const result = orders.map(o => {
      const edits = o.trail.filter(h => h.type === 'eta');
      const origEta = o.etaHistory[0]?.from || '';
      const slip = origEta && o.eta ? Math.round((new Date(o.eta) - new Date(origEta)) / 86400000) : 0;
      const overdue = o.eta && o.eta < today ? Math.round((new Date(today) - new Date(o.eta)) / 86400000) : 0;
      const flag = PREPARED_STATUSES.includes(o.status) ? 'preponed' : (o.eta && o.eta < today ? 'delayed' : 'delayed');
      return { ...o.toObject(), origEta, slip, overdue, flag, editCount: edits.length };
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// GET /api/dashboard/dealer-summary
exports.getDealerSummary = async (req, res, next) => {
  try {
    const summary = await Order.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: '$customer',
        totalOrders: { $sum: 1 },
        totalQty:    { $sum: '$qty' },
        pendingOrders: { $sum: { $cond: [{ $in: ['$status',['Order','Approved','PO Raised','In Transit','At Transporter','Warehouse']] }, 1, 0] } },
        deliveredOrders: { $sum: { $cond: [{ $eq: ['$status','Delivered'] }, 1, 0] } },
        overdueOrders: { $sum: { $cond: [{ $and: [{ $lt: ['$eta', new Date().toISOString().slice(0,10)] }, { $nin: ['$status',['Purchased','Billed','Delivered','Cancelled']] }] }, 1, 0] } },
      }},
      { $sort: { totalOrders: -1 } },
    ]);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};

// GET /api/dashboard/supplier-summary
exports.getSupplierSummary = async (req, res, next) => {
  try {
    const summary = await Order.aggregate([
      { $match: { isActive: true, vendor: { $ne: null, $ne: '' } } },
      { $group: {
        _id: '$vendor',
        totalOrders: { $sum: 1 },
        totalQty:    { $sum: '$qty' },
        pendingOrders: { $sum: { $cond: [{ $in: ['$status',['PO Raised','In Transit','At Transporter','Warehouse']] }, 1, 0] } },
        deliveredOrders: { $sum: { $cond: [{ $eq: ['$status','Delivered'] }, 1, 0] } },
      }},
      { $sort: { totalOrders: -1 } },
    ]);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};
