const router = require('express').Router();
const ctrl   = require('../controllers/report.controller');
const { protect }  = require('../middleware/auth.middleware');
const { can }      = require('../middleware/permission.middleware');

router.use(protect);

router.get('/orders',                can('viewReports'),   ctrl.ordersReport);
router.get('/orders/export',         can('exportReports'), ctrl.exportOrders);
router.get('/eta-edited/export',     can('exportReports'), ctrl.exportEtaEdited);
router.get('/dealer-summary/export', can('exportReports'), ctrl.exportDealerSummary);

module.exports = router;
