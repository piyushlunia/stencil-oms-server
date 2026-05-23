const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.use(protect);

router.get  ('/',                    restrictTo('superadmin','admin','manager'), ctrl.getUsers);
router.get  ('/:id',                 restrictTo('superadmin','admin','manager'), ctrl.getUser);
router.post ('/',                    restrictTo('superadmin','admin'),           ctrl.createUser);
router.put  ('/:id',                 restrictTo('superadmin','admin'),           ctrl.updateUser);
router.delete('/:id',                restrictTo('superadmin','admin'),           ctrl.deleteUser);
router.patch('/:id/reset-password',  restrictTo('superadmin','admin'),           ctrl.resetPassword);
router.patch('/:id/permissions',     restrictTo('superadmin','admin'),           ctrl.setPermissions);
router.post ('/copy-permissions',    restrictTo('superadmin','admin'),           ctrl.copyPermissions);

module.exports = router;
