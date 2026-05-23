const Customer    = require('../models/Customer');
const Supplier    = require('../models/Supplier');
const Product     = require('../models/Product');
const Transporter = require('../models/Transporter');

const makeCrud = (Model, label) => ({
  getAll: async (req, res, next) => {
    try {
      const { search, isActive = 'true' } = req.query;
      const filter = {};
      if (isActive !== 'all') filter.isActive = isActive === 'true';
      if (search) filter.name = { $regex: search, $options: 'i' };
      const items = await Model.find(filter).sort('name');
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },
  getOne: async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: `${label} not found` });
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const item = await Model.create({ ...req.body, createdBy: req.user._id });
      res.status(201).json({ success: true, data: item, message: `${label} created` });
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ success: false, message: `${label} not found` });
      res.json({ success: true, data: item, message: `${label} updated` });
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const item = await Model.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
      if (!item) return res.status(404).json({ success: false, message: `${label} not found` });
      res.json({ success: true, message: `${label} deactivated` });
    } catch (err) { next(err); }
  },
});

exports.customers    = makeCrud(Customer,    'Customer');
exports.suppliers    = makeCrud(Supplier,    'Supplier');
exports.products     = makeCrud(Product,     'Product');
exports.transporters = makeCrud(Transporter, 'Transporter');
