const User = require('../models/User');
const Role = require('../models/Role');
const { ROLE_DEFAULTS } = require('../middleware/permission.middleware');

// GET /api/users
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, isActive = 'true' } = req.query;
    const filter = {};
    if (isActive !== 'all') filter.isActive = isActive === 'true';
    if (role)   filter.role   = role;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const users = await User.find(filter).populate('roleRef').sort('name');
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

// GET /api/users/:id
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('roleRef');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// POST /api/users
exports.createUser = async (req, res, next) => {
  try {
    const { name, username, email, password, role, phone } = req.body;
    const user = await User.create({ name, username, email, password, role, phone, createdBy: req.user._id });
    res.status(201).json({ success: true, data: user, message: 'User created' });
  } catch (err) { next(err); }
};

// PUT /api/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, phone, isActive, permissionOverrides, roleRef } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name  !== undefined) user.name  = name;
    if (email !== undefined) user.email = email;
    if (role  !== undefined) user.role  = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissionOverrides !== undefined) user.permissionOverrides = permissionOverrides;
    if (roleRef !== undefined) user.roleRef = roleRef;

    await user.save();
    res.json({ success: true, data: user, message: 'User updated' });
  } catch (err) { next(err); }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === String(req.user._id))
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = false;
    await user.save();
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
};

// PATCH /api/users/:id/reset-password (admin only)
exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
};

// PATCH /api/users/:id/permissions
exports.setPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.permissionOverrides = Array.isArray(permissions) ? permissions : [];
    await user.save();
    res.json({ success: true, data: user.permissionOverrides, message: 'Permissions updated' });
  } catch (err) { next(err); }
};

// POST /api/users/copy-permissions
exports.copyPermissions = async (req, res, next) => {
  try {
    const { fromUserId, fromRole, toUserId } = req.body;
    let perms = [];

    if (fromUserId) {
      const src = await User.findById(fromUserId);
      if (!src) return res.status(404).json({ success: false, message: 'Source user not found' });
      perms = src.permissionOverrides.length ? src.permissionOverrides : (ROLE_DEFAULTS[src.role] || []);
    } else if (fromRole) {
      const roleDoc = await Role.findOne({ name: fromRole });
      perms = roleDoc ? roleDoc.permissions : (ROLE_DEFAULTS[fromRole] || []);
    } else {
      return res.status(400).json({ success: false, message: 'fromUserId or fromRole required' });
    }

    const target = await User.findById(toUserId);
    if (!target) return res.status(404).json({ success: false, message: 'Target user not found' });
    target.permissionOverrides = perms;
    await target.save();
    res.json({ success: true, data: perms, message: 'Permissions copied' });
  } catch (err) { next(err); }
};
