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
  const exists = await User.findOne({ username: 'admin' });
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
  }

  await mongoose.disconnect();
  console.log('\n🌱 Seed complete!');
}

seed().catch(err => { console.error(err); process.exit(1); });
