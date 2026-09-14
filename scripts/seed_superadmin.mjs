import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function seed() {
  await mongoose.connect('mongodb://127.0.0.1:27017/stockora');
  const email = 'trustezika831@gmail.com';
  const hashedPassword = await bcrypt.hash('TRust222$', 12);

  const existing = await mongoose.connection.collection('users').findOne({ email });
  if (existing) {
    await mongoose.connection.collection('users').updateOne(
      { _id: existing._id },
      {
        $set: {
          password: hashedPassword,
          roleName: 'Super Administrator',
          isPlatformAdmin: true,
          isActive: true,
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      }
    );
    console.log(`✅ Updated existing user ${email} with role Super Administrator & password.`);
  } else {
    await mongoose.connection.collection('users').insertOne({
      username: 'trustezika',
      email,
      password: hashedPassword,
      roleName: 'Super Administrator',
      isPlatformAdmin: true,
      isActive: true,
      isVerified: true,
      failedLoginAttempts: 0,
      themePreference: 'dark',
      preferredLanguage: 'en',
      timeZone: 'UTC',
      tenants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Created Super Administrator account: ${email}`);
  }

  await mongoose.connection.close();
}

seed().catch(console.error);
