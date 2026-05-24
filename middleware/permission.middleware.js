const Role = require('../models/Role');

// Role default permission sets
const ROLE_DEFAULTS = {
  superadmin: ['viewAllOrders','createOrder','editOrder','updateOrderStatus','deleteOrder','exportOrders','approve',
    'viewPendingDon','editPendingDon','viewPendingSpo','editPendingSpo',
    'raisePo','logisticsUpdate','transitUpdate',
    'viewSupplierPo','editSupplierPo',
    'viewShipments','editShipments',
    'viewDelivery','deliver',
    'raiseGrn','purchaseOrder',
    'viewVendor','viewBiller',
    'viewMaster','editMaster',
    'viewReports','manageUsers','manageRoles','exportReports','viewBackend'],
  admin: ['viewAllOrders','createOrder','editOrder','updateOrderStatus','deleteOrder','exportOrders','approve',
    'viewPendingDon','editPendingDon','viewPendingSpo','editPendingSpo',
    'raisePo','logisticsUpdate','transitUpdate',
    'viewSupplierPo','editSupplierPo',
    'viewShipments','editShipments',
    'viewDelivery','deliver',
    'raiseGrn','purchaseOrder',
    'viewVendor','viewBiller',
    'viewMaster','editMaster',
    'viewReports','manageUsers','manageRoles','exportReports','viewBackend'],
  manager: ['viewAllOrders','createOrder','editOrder','updateOrderStatus','exportOrders','approve',
    'viewPendingDon','editPendingDon','viewPendingSpo','editPendingSpo',
    'raisePo','logisticsUpdate','transitUpdate',
    'viewSupplierPo','editSupplierPo',
    'viewShipments','editShipments',
    'viewDelivery','deliver',
    'raiseGrn','purchaseOrder',
    'viewVendor','viewBiller',
    'viewMaster','viewReports','exportReports'],
  logistics: ['viewAllOrders','updateOrderStatus','logisticsUpdate','transitUpdate',
    'viewShipments','editShipments','viewDelivery','deliver',
    'viewPendingDon','viewSupplierPo','viewMaster'],
  purchase: ['viewAllOrders','createOrder','editOrder','approve',
    'viewPendingDon','editPendingDon','viewPendingSpo','editPendingSpo',
    'raisePo','viewSupplierPo','editSupplierPo',
    'raiseGrn','purchaseOrder','viewMaster','editMaster'],
  biller: ['viewAllOrders','viewPendingDon','viewDelivery','purchaseOrder','viewBiller','viewMaster'],
  salesman: ['viewAllOrders','createOrder','viewPendingDon','viewDelivery','viewMaster'],
};

/**
 * Middleware to check if user has a specific permission.
 * Checks: user-level overrides first, then role permissions, then role defaults.
 */
const can = (permission) => async (req, res, next) => {
  try {
    const user = req.user;

    // Superadmin bypasses everything
    if (user.role === 'superadmin') return next();

    // Check user-level override first
    if (user.permissionOverrides && user.permissionOverrides.length > 0) {
      if (user.permissionOverrides.includes(permission)) return next();
      // If user has overrides set but permission not in list, deny
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permission}`
      });
    }

    // Check custom role from DB
    const roleDoc = await Role.findOne({ name: user.role });
    if (roleDoc && roleDoc.permissions) {
      if (roleDoc.permissions.includes(permission)) return next();
      return res.status(403).json({ success: false, message: `Permission denied: ${permission}` });
    }

    // Fallback to hardcoded role defaults
    const defaults = ROLE_DEFAULTS[user.role] || [];
    if (defaults.includes(permission)) return next();

    return res.status(403).json({ success: false, message: `Permission denied: ${permission}` });
  } catch (err) {
    next(err);
  }
};

module.exports = { can, ROLE_DEFAULTS };
