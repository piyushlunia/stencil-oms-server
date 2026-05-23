const Order = require('../models/Order');
const xl = require('excel4node');

const buildFilter = (q) => {
  const filter = { isActive: true };
  if (q.status)   filter.status   = { $in: q.status.split(',') };
  if (q.customer) filter.customer = { $regex: q.customer, $options: 'i' };
  if (q.vendor)   filter.vendor   = { $regex: q.vendor,   $options: 'i' };
  if (q.from || q.to) {
    filter.orderDate = {};
    if (q.from) filter.orderDate.$gte = new Date(q.from);
    if (q.to)   filter.orderDate.$lte = new Date(q.to + 'T23:59:59');
  }
  return filter;
};

// GET /api/reports/orders — JSON report
exports.ordersReport = async (req, res, next) => {
  try {
    const orders = await Order.find(buildFilter(req.query)).sort('-orderDate').limit(5000);
    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) { next(err); }
};

// GET /api/reports/orders/export — Excel download
exports.exportOrders = async (req, res, next) => {
  try {
    const orders = await Order.find(buildFilter(req.query)).sort('-orderDate').limit(10000);

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet('Orders');

    const hStyle = wb.createStyle({ font: { bold: true, color: '#FFFFFF', size: 11 }, fill: { type: 'pattern', patternType: 'solid', fgColor: '#1e293b' }, alignment: { horizontal: 'center' } });
    const dStyle = wb.createStyle({ font: { size: 10 }, alignment: { horizontal: 'left', wrapText: true } });
    const numStyle = wb.createStyle({ font: { size: 10 }, numberFormat: '#,##0' });
    const dateStyle = wb.createStyle({ font: { size: 10 }, numberFormat: 'DD/MM/YYYY' });

    const headers = ['DON','Order Date','Customer','Product','Code','Qty','Unit','Vendor','ETA','Status','LR','Transporter','LR Date','Purchase Rate','Selling Rate','Notes'];
    headers.forEach((h, i) => ws.cell(1, i+1).string(h).style(hStyle));

    orders.forEach((o, r) => {
      const row = r + 2;
      ws.cell(row, 1).string(`DON-${o.seqId}`).style(dStyle);
      ws.cell(row, 2).date(new Date(o.orderDate)).style(dateStyle);
      ws.cell(row, 3).string(o.customer || '').style(dStyle);
      ws.cell(row, 4).string(o.product || '').style(dStyle);
      ws.cell(row, 5).string(o.orderedCode || '').style(dStyle);
      ws.cell(row, 6).number(o.qty || 0).style(numStyle);
      ws.cell(row, 7).string(o.unit || 'pcs').style(dStyle);
      ws.cell(row, 8).string(o.vendor || '').style(dStyle);
      ws.cell(row, 9).string(o.eta || '').style(dStyle);
      ws.cell(row, 10).string(o.status || '').style(dStyle);
      ws.cell(row, 11).string(o.lr || '').style(dStyle);
      ws.cell(row, 12).string(o.transporter || '').style(dStyle);
      ws.cell(row, 13).string(o.lrDate || '').style(dStyle);
      ws.cell(row, 14).number(o.purchaseRate || 0).style(numStyle);
      ws.cell(row, 15).number(o.sellingRate || 0).style(numStyle);
      ws.cell(row, 16).string(o.notes || '').style(dStyle);
    });

    // Column widths
    [8,12,20,20,12,6,6,18,12,14,12,16,12,10,10,20].forEach((w,i) => ws.column(i+1).setWidth(w));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="orders_export_${Date.now()}.xlsx"`);
    wb.write('orders.xlsx', res);
  } catch (err) { next(err); }
};

// GET /api/reports/eta-edited/export
exports.exportEtaEdited = async (req, res, next) => {
  try {
    const orders = await Order.find({ isActive: true, 'etaHistory.0': { $exists: true } }).sort('-updatedAt').limit(5000);

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet('ETA Edited Orders');
    const hStyle = wb.createStyle({ font: { bold: true, color: '#FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '#f59e0b' } });
    const dStyle = wb.createStyle({ font: { size: 10 } });

    const headers = ['DON','Customer','Product','Qty','Status','Original ETA','Current ETA','Days Slipped','Edit Count','Last Changed By','Last Changed At','Last Reason'];
    headers.forEach((h, i) => ws.cell(1, i+1).string(h).style(hStyle));

    orders.forEach((o, r) => {
      const row = r + 2;
      const origEta = o.etaHistory[0]?.from || '';
      const editCount = o.etaHistory.length;
      const lastH = o.etaHistory[editCount - 1] || {};
      const slip = origEta && o.eta ? Math.round((new Date(o.eta) - new Date(origEta)) / 86400000) : 0;

      ws.cell(row,1).string(`DON-${o.seqId}`).style(dStyle);
      ws.cell(row,2).string(o.customer||'').style(dStyle);
      ws.cell(row,3).string(o.product||'').style(dStyle);
      ws.cell(row,4).number(o.qty||0).style(dStyle);
      ws.cell(row,5).string(o.status||'').style(dStyle);
      ws.cell(row,6).string(origEta).style(dStyle);
      ws.cell(row,7).string(o.eta||'').style(dStyle);
      ws.cell(row,8).number(slip).style(dStyle);
      ws.cell(row,9).number(editCount).style(dStyle);
      ws.cell(row,10).string(lastH.changedBy||'').style(dStyle);
      ws.cell(row,11).string(lastH.changedAt ? new Date(lastH.changedAt).toLocaleString() : '').style(dStyle);
      ws.cell(row,12).string(lastH.reason||'').style(dStyle);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="eta_edited_${Date.now()}.xlsx"`);
    wb.write('eta_edited.xlsx', res);
  } catch (err) { next(err); }
};

// GET /api/reports/dealer-summary/export
exports.exportDealerSummary = async (req, res, next) => {
  try {
    const summary = await Order.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: '$customer',
        totalOrders: { $sum: 1 },
        totalQty: { $sum: '$qty' },
        pending: { $sum: { $cond: [{ $in: ['$status',['Order','Approved','PO Raised','In Transit','At Transporter','Warehouse']] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status','Delivered'] }, 1, 0] } },
      }},
      { $sort: { totalOrders: -1 } },
    ]);

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet('Dealer Summary');
    const hStyle = wb.createStyle({ font: { bold: true, color: '#FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '#1a73e8' } });
    const dStyle = wb.createStyle({ font: { size: 10 } });

    ['Dealer','Total Orders','Total Qty','Pending','Delivered'].forEach((h,i) => ws.cell(1,i+1).string(h).style(hStyle));
    summary.forEach((s,r) => {
      ws.cell(r+2,1).string(s._id||'').style(dStyle);
      ws.cell(r+2,2).number(s.totalOrders).style(dStyle);
      ws.cell(r+2,3).number(s.totalQty).style(dStyle);
      ws.cell(r+2,4).number(s.pending).style(dStyle);
      ws.cell(r+2,5).number(s.delivered).style(dStyle);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dealer_summary_${Date.now()}.xlsx"`);
    wb.write('dealer_summary.xlsx', res);
  } catch (err) { next(err); }
};
