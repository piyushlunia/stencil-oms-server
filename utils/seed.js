/**
 * Seed script — creates default roles + a superadmin user
 * Run: node utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname,'../.env') });
const mongoose = require('mongoose');
const User  = require('../models/User');
const Role  = require('../models/Role');
const { ROLE_DEFAULTS } = require('../middleware/permission.middleware');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Create / update roles
  for (const [name, perms] of Object.entries(ROLE_DEFAULTS)) {
    await Role.findOneAndUpdate(
      { name },
      { name, label: name.charAt(0).toUpperCase()+name.slice(1), permissions: perms, isBuiltIn: true },
      { upsert: true, new: true }
    );
    console.log(`✅ Role: ${name}`);
  }

  // Create superadmin if not exists
  const exists = await User.findOne({ email: 'admin@stencil.com' });
  if (!exists) {
    await User.create({
      name:     'Super Admin',
      username: 'admin',
      email:    'admin@stencil.com',
      password: 'admin123',
      role:     'superadmin',
    });
    console.log('✅ Superadmin created — username: admin / password: admin123');
  } else {
    console.log('ℹ️  Superadmin already exists');
        if (process.env.RESET_ADMIN_PASSWORD) {
                const bcrypt = require('bcryptjs');
                const hash = await bcrypt.hash(process.env.RESET_ADMIN_PASSWORD, 10);
                await User.updateOne({ email: 'admin@stencil.com' }, { $set: { password: hash, username: 'admin', role: 'superadmin' } });
                console.log('Reset admin password to:', process.env.RESET_ADMIN_PASSWORD);
        }
  }

  await mongoose.disconnect();
  console.log('\n🌱 Seed complete!');
}

seed().catch(err => { console.error(err); process.exit(1); });
