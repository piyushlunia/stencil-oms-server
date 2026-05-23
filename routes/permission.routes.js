const router = require('express').Router();
const ctrl   = require('../controllers/permission.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.use(protect);

router.get  ('/matrix',           ctrl.getMatrix);
router.get  ('/all-keys',         ctrl.getAllKeys);
router.get  ('/roles',            ctrl.getRoles);
router.get  ('/roles/:name',      ctrl.getRole);
router.post ('/roles',            restrictTo('superadmin','admin'), ctrl.createRole);
router.put  ('/roles/:name',      restrictTo('superadmin','admin'), ctrl.updateRole);
router.patch('/roles/:name/toggle', restrictTo('superadmin','admin'), ctrl.togglePermission);
router.delete('/roles/:name',     restrictTo('superadmin'),          ctrl.deleteRole);

module.exports = router;
