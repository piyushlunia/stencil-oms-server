const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/login',           ctrl.login);
router.get ('/me',              protect, ctrl.getMe);
router.post('/change-password', protect, ctrl.changePassword);
router.post('/refresh',         protect, ctrl.refresh);

module.exports = router;
