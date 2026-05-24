const Role = require('../models/Role');
const User = require('../models/User');
const { ROLE_DEFAULTS } = require('../middleware/permission.middleware');

// GET /api/permissions/roles
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort('name');
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
};

// GET /api/permissions/roles/:name
exports.getRole = async (req, res, next) => {
  try {
    const role = await Role.findOne({ name: req.params.name });
    if (!role) {
      const defaults = ROLE_DEFAULTS[req.params.name];
      if (defaults) return res.json({ success: true, data: { name: req.params.name, permissions: defaults, isBuiltIn: true } });
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.json({ success: true, data: role });
  } catch (err) { next(err); }
};

// POST /api/permissions/roles
exports.createRole = async (req, res, next) => {
  try {
    const { name, label, permissions, description } = req.body;
    if (!name || !label) return res.status(400).json({ success: false, message: 'name and label required' });
    const role = await Role.create({ name, label, permissions: permissions||[], description, createdBy: req.user._id });
    res.status(201).json({ success: true, data: role, message: 'Role created' });
  } catch (err) { next(err); }
};

// PUT /api/permissions/roles/:name
exports.updateRole = async (req, res, next) => {
  try {
    const { permissions, label, description } = req.body;
    let role = await Role.findOne({ name: req.params.name });
    if (!role) {
      role = new Role({ name: req.params.name, label: label || req.params.name, permissions: permissions || [], description });
    } else {
      if (permissions !== undefined) role.permissions = permissions;
      if (label !== undefined) role.label = label;
      if (description !== undefined) role.description = description;
    }
    await role.save();
    res.json({ success: true, data: role, message: 'Role updated' });
  } catch (err) { next(err); }
};

// PATCH /api/permissions/roles/:name/toggle
exports.togglePermission = async (req, res, next) => {
  try {
    const { permission, enabled } = req.body;
    if (!permission) return res.status(400).json({ success: false, message: 'permission required' });
    let role = await Role.findOne({ name: req.params.name });
    if (!role) {
      const defaults = ROLE_DEFAULTS[req.params.name] || [];
      role = new Role({ name: req.params.name, label: req.params.name, permissions: [...defaults] });
    }
    if (enabled && !role.permissions.includes(permission)) role.permissions.push(permission);
    if (!enabled) role.permissions = role.permissions.filter(p => p !== permission);
    await role.save();
    res.json({ success: true, data: role.permissions, message: 'Permission updated' });
  } catch (err) { next(err); }
};

// DELETE /api/permissions/roles/:name
exports.deleteRole = async (req, res, next) => {
  try {
    const builtin = ['superadmin','admin','manager','logistics','purchase','biller','salesman'];
    if (builtin.includes(req.params.name))
      return res.status(400).json({ success: false, message: 'Cannot delete built-in roles' });
    await Role.findOneAndDelete({ name: req.params.name });
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { next(err); }
};

// GET /api/permissions/matrix
exports.getMatrix = async (req, res, next) => {
  const PM_MATRIX = [
    { module:'Orders',       icon:'📋', cells:{ View:'viewAllOrders', Create:'createOrder', Edit:'editOrder', Delete:'deleteOrder', Export:'exportOrders', Assign:'approve', Find:'updateOrderStatus' } },
    { module:'Pending DONs', icon:'📦', cells:{ View:'viewPendingDon', Edit:'editPendingDon' } },
    { module:'Pending SPOs', icon:'📄', cells:{ View:'viewPendingSpo', Create:'raisePo', Edit:'editPendingSpo' } },
    { module:'Shipments',    icon:'🚛', cells:{ View:'viewShipments', Edit:'logisticsUpdate', Assign:'transitUpdate' } },
    { module:'Delivery',     icon:'📬', cells:{ View:'viewDelivery', Assign:'deliver' } },
    { module:'Supplier PO',  icon:'🧾', cells:{ View:'viewSupplierPo', Edit:'editSupplierPo' } },
    { module:'GRN/Purchase', icon:'📝', cells:{ View:'viewAllOrders', Create:'raiseGrn', Edit:'purchaseOrder' } },
    { module:'Visibility',   icon:'👁', cells:{ View:'viewVendor', Create:'viewBiller' } },
    { module:'Masters',      icon:'🗂', cells:{ View:'viewMaster', Edit:'editMaster' } },
    { module:'Reports',      icon:'📈', cells:{ View:'viewReports', Export:'exportReports' } },
    { module:'Admin',        icon:'⚙️', cells:{ View:'viewBackend', Create:'manageUsers', Edit:'manageRoles' } },
  ];
  res.json({ success: true, data: PM_MATRIX });
};

// GET /api/permissions/all-keys
exports.getAllKeys = (req, res) => {
  const keys = [...new Set(Object.values(ROLE_DEFAULTS).flat())].sort();
  res.json({ success: true, data: keys });
};
