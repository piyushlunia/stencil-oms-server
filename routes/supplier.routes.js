const router = require('express').Router();
const { suppliers: ctrl } = require('../controllers/master.controller');
const { protect } = require('../middleware/auth.middleware');
const { can }     = require('../middleware/permission.middleware');

router.use(protect);
router.get   ('/',    can('viewMaster'),  ctrl.getAll);
router.get   ('/:id', can('viewMaster'),  ctrl.getOne);
router.post  ('/',    can('editMaster'),  ctrl.create);
router.put   ('/:id', can('editMaster'),  ctrl.update);
router.delete('/:id', can('editMaster'),  ctrl.remove);
module.exports = router;
