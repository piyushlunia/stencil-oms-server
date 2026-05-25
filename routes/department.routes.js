const router     = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Department = require('../models/Department');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const deps = await Department.find({ isActive: true }).sort('name');
    res.json({ success: true, data: deps });
  } catch (err) { next(err); }
});

router.post('/', restrictTo('superadmin'), async (req, res, next) => {
  try {
    const dep = await Department.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: dep });
  } catch (err) { next(err); }
});

router.put('/:id', restrictTo('superadmin'), async (req, res, next) => {
  try {
    const dep = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dep) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, data: dep });
  } catch (err) { next(err); }
});

router.delete('/:id', restrictTo('superadmin'), async (req, res, next) => {
  try {
    await Department.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
