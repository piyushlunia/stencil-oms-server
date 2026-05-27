require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { protect } = require('./middleware/auth.middleware');

// ── Routes ──────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth.routes');
const orderRoutes       = require('./routes/order.routes');
const userRoutes        = require('./routes/user.routes');
const customerRoutes    = require('./routes/customer.routes');
const supplierRoutes    = require('./routes/supplier.routes');
const productRoutes     = require('./routes/product.routes');
const transporterRoutes = require('./routes/transporter.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const reportRoutes      = require('./routes/report.routes');
const permissionRoutes  = require('./routes/permission.routes');
const donRoutes         = require('./routes/don.routes');
const spoRoutes         = require('./routes/spo.routes');
const grnRoutes         = require('./routes/grn.routes');
const shipmentRoutes    = require('./routes/shipment.routes');
const departmentRoutes  = require('./routes/department.routes');

// ── App ────────────────────────────────────────────────────────────
const app = express();
connectDB();

// ── Security & Parsing ─────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Rate Limiting ────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth requests — try again in 15 minutes' },
}));

// ── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Stencil OMS API is running 🚀', env: process.env.NODE_ENV });
});

// ── Admin: Wipe ALL data (superadmin only) ───────────────────────────
app.delete('/api/admin/wipe-all', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Superadmin only' });
    }
    const Order       = require('./models/Order');
    const Customer    = require('./models/Customer');
    const Supplier    = require('./models/Supplier');
    const Product     = require('./models/Product');
    const Transporter = require('./models/Transporter');
    const User        = require('./models/User');

    // Hard-delete everything
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Supplier.deleteMany({});
    await Product.deleteMany({});
    await Transporter.deleteMany({});
    // Keep superadmin user, delete all others
    await User.deleteMany({ role: { $ne: 'superadmin' } });

    res.json({ success: true, message: 'All data wiped from database' });
  } catch (err) { next(err); }
});
// Admin: Wipe individual collections (superadmin/admin only)
const _superAdminGuard = (req, res, next) => {
  if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Superadmin only' });
  }
  next();
};
app.delete('/api/admin/wipe-orders',    protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/Order');    await M.deleteMany({});                               res.json({ success: true }); } catch(e) { next(e); } });
app.delete('/api/admin/wipe-products',  protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/Product');  await M.deleteMany({});                               res.json({ success: true }); } catch(e) { next(e); } });
app.delete('/api/admin/wipe-customers', protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/Customer'); await M.deleteMany({});                               res.json({ success: true }); } catch(e) { next(e); } });
app.delete('/api/admin/wipe-suppliers', protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/Supplier'); await M.deleteMany({});                               res.json({ success: true }); } catch(e) { next(e); } });
app.delete('/api/admin/wipe-users',     protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/User');    await M.deleteMany({ role: { $ne: 'superadmin' } }); res.json({ success: true }); } catch(e) { next(e); } });
app.delete('/api/admin/wipe-roles',     protect, _superAdminGuard, async (req, res, next) => { try { const M = require('./models/Role');    await M.deleteMany({});                               res.json({ success: true }); } catch(e) { next(e); } });


// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/customers',    customerRoutes);
app.use('/api/suppliers',    supplierRoutes);
app.use('/api/products',     productRoutes);
app.use('/api/transporters', transporterRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/permissions',  permissionRoutes);
app.use('/api/dons',         donRoutes);
app.use('/api/spos',         spoRoutes);
app.use('/api/grns',         grnRoutes);
app.use('/api/shipments',    shipmentRoutes);
app.use('/api/departments',  departmentRoutes);

// ── Error Handling ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// One-time admin password reset (reads from env var, safe to leave in)
async function resetAdminIfRequested() {
  const newPass = process.env.RESET_ADMIN_PASSWORD;
  if (!newPass) return;
  try {
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');
    const hash = await bcrypt.hash(newPass, 10);
    const result = await User.updateOne({ username: 'admin' }, { $set: { password: hash } });
    console.log('[RESET] Admin password reset:', result.modifiedCount, 'doc(s) updated');
  } catch(e) {
    console.error('[RESET] Failed:', e.message);
  }
}

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
resetAdminIfRequested();
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
