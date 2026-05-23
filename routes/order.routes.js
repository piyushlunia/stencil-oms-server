const router = require('express').Router();
const ctrl   = require('../controllers/order.controller');
const { protect }  = require('../middleware/auth.middleware');
const { can }      = require('../middleware/permission.middleware');

router.use(protect);

router.get  ('/',              can('viewAllOrders'), ctrl.getOrders);
router.get  ('/:id',           can('viewAllOrders'), ctrl.getOrder);
router.post ('/',              can('createOrder'),   ctrl.createOrder);
router.put  ('/:id',           can('editOrder'),     ctrl.updateOrder);
router.patch('/:id/status',    can('logisticsUpdate'), ctrl.updateStatus);
router.patch('/:id/eta',       can('editOrder'),     ctrl.updateEta);
router.post ('/:id/comment',   can('viewAllOrders'), ctrl.addComment);
router.patch('/:id/grn',       can('raiseGrn'),      ctrl.raiseGrn);
router.patch('/:id/billing',   can('purchaseOrder'), ctrl.addBilling);
router.patch('/:id/delivery',  can('deliver'),       ctrl.markDelivered);
router.post ('/:id/split',     can('editOrder'),     ctrl.splitOrder);
router.get  ('/:id/trail',     can('viewAllOrders'), ctrl.getTrail);
router.delete('/:id',          can('deleteOrder'),   ctrl.deleteOrder);

module.exports = router;
