import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/stockora');
  const user = await mongoose.connection.collection('users').findOne({ email: 'trustezika831@gmail.com' });
  console.log('User found in DB:', user ? {
    _id: user._id,
    email: user.email,
    username: user.username,
    roleName: user.roleName,
    isPlatformAdmin: user.isPlatformAdmin,
    failedLoginAttempts: user.failedLoginAttempts,
    lockUntil: user.lockUntil,
    hasPassword: !!user.password,
    passwordLength: user.password?.length
  } : 'NOT_FOUND');

  if (user && user.password) {
    const isMatch = await bcrypt.compare('TRust222$', user.password);
    console.log('Password comparison for TRust222$:', isMatch);
  }

  const allUsers = await mongoose.connection.collection('users').find({}).project({ email: 1, username: 1, roleName: 1, isPlatformAdmin: 1 }).toArray();
  console.log('All users in stockora DB:', allUsers);

  await mongoose.connection.close();
}

check().catch(console.error);
