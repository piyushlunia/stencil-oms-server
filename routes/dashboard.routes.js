const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect, can('viewAllOrders'));

router.get('/summary',         ctrl.getSummary);
router.get('/pipeline',        ctrl.getPipeline);
router.get('/recent-orders',   ctrl.getRecentOrders);
router.get('/due-orders',      ctrl.getDueOrders);
router.get('/purchased',       ctrl.getPurchased);
router.get('/lr-at-transporter', ctrl.getLrAtTransporter);
router.get('/eta-edited',      ctrl.getEtaEdited);
router.get('/dealer-summary',  ctrl.getDealerSummary);
router.get('/supplier-summary', ctrl.getSupplierSummary);

module.exports = router;
