import mongoose from 'mongoose';
import { User } from './src/server/models/User.js';
import { Session } from './src/server/models/Session.js';
import { RefreshToken } from './src/server/models/RefreshToken.js';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/stockora');
  const users = await User.find({}).select('+password').lean();
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    const hasHash = Boolean(u.password && u.password.startsWith('$2'));
    console.log({
      id: u._id.toString(),
      email: u.email,
      username: u.username,
      roleName: u.roleName,
      isActive: u.isActive,
      isVerified: u.isVerified,
      failedLoginAttempts: u.failedLoginAttempts,
      lockUntil: u.lockUntil,
      hasValidHashPrefix: hasHash,
      hashLength: u.password ? u.password.length : 0,
      tenantId: u.tenantId?.toString(),
    });
  }

  const { AuditLog } = await import('./src/server/models/AuditLog.js');
  const logs = await AuditLog.find({
    createdAt: {
      $gte: new Date('2026-09-08T00:00:00Z')
    }
  }).sort({ createdAt: 1 }).lean();
  console.log(`Found ${logs.length} audit logs today:`);
  for (const l of logs) {
    console.log({
      action: l.action,
      targetModel: l.targetModel,
      targetId: l.targetId,
      userId: l.userId?.toString(),
      createdAt: l.createdAt,
      newValues: l.newValues,
    });
  }

  await mongoose.disconnect();
}

check().catch(console.error);
