/**
 * sheetsSync.js — Stencil OMS
 * ============================
 * Fire-and-forget sync to Google Sheets webhook.
 * Called after every order create / update.
 * Never throws — a Sheets failure must never break the main API response.
 *
 * Env var required:
 *   SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
 */

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

async function syncToSheets(orders) {
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return;

  const list = Array.isArray(orders) ? orders : [orders];

  const payload = list.map(o => ({
    seqId:              o.seqId,
    customer:           o.customer,
    product:            o.product,
    orderedCode:        o.orderedCode,
    vendor:             o.vendor,
    qty:                o.qty,
    unit:               o.unit,
    orderDate:          o.orderDate,
    eta:                o.eta,
    status:             o.status,
    poNum:              o.poNum,
    vendorPoNum:        o.vendorPoNum,
    lr:                 o.lr,
    transporter:        o.transporter,
    transitDetails:     o.transitDetails || {},
    grnNo:              o.grnNo,
    grnDate:            o.grnDate,
    purchVoucherNo:     o.purchVoucherNo,
    vendorInvoiceNum:   o.vendorInvoiceNum,
    vendorInvoiceDate:  o.vendorInvoiceDate,
    cancelReason:       o.cancelReason,
    biller:             o.biller,
    salesExec:          o.salesExec,
    purchaseRate:       o.purchaseRate,
    sellingRate:        o.sellingRate,
    notes:              o.notes,
    remark:             o.remark,
    createdBy:          o.createdBy,
  }));

  const body = JSON.stringify(payload);

  try {
    await _post(webhookUrl, body);
  } catch (err) {
    console.warn('[sheetsSync] Failed to sync to Google Sheets:', err.message);
  }
}

function _post(urlStr, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(urlStr);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 120)));
        }
      });
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

module.exports = { syncToSheets };
