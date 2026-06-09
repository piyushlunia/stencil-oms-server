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

const _custCrud = makeCrud(Customer, 'Customer');
// Upsert by unique name: a POST with an existing customer name UPDATES it instead of failing on duplicate.
_custCrud.create = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (name) {
      const existing = await Customer.findOne({ name });
      if (existing) {
        Object.keys(req.body).forEach(k => { if (k !== '_id' && k !== 'createdBy') existing[k] = req.body[k]; });
        existing.isActive = true;
        await existing.save();
        return res.json({ success: true, data: existing, message: 'Customer updated' });
      }
    }
    const item = await Customer.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: item, message: 'Customer created' });
  } catch (err) { next(err); }
};
exports.customers = _custCrud;
exports.suppliers    = makeCrud(Supplier,    'Supplier');
const _prodCrud = makeCrud(Product, 'Product');
_prodCrud.create = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const code = (req.body.code || '').trim();
    if (!code) delete req.body.code;
    let existing = null;
    if (name) existing = await Product.findOne({ name });
    if (!existing && code) existing = await Product.findOne({ code });
    if (existing) {
      Object.keys(req.body).forEach(k => { if (k !== '_id' && k !== 'createdBy') existing[k] = req.body[k]; });
      if (!code) existing.code = undefined;
      existing.isActive = true;
      await existing.save();
      return res.json({ success: true, data: existing, message: 'Product updated' });
    }
    const item = await Product.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: item, message: 'Product created' });
  } catch (err) { next(err); }
};
exports.products = _prodCrud;
exports.transporters = makeCrud(Transporter, 'Transporter');
