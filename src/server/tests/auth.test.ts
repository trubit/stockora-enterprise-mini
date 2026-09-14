import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { AuthService } from '../services/auth.service.js';
import { PasswordService } from '../services/password.service.js';

describe('Authentication & Session Services', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_auth_service');
    }
    await Role.deleteMany({});
    await User.deleteMany({});
    await Role.create({
      name: 'Company Owner',
      description: 'Owner role',
      permissions: ['users:read', 'users:write'],
      isSystem: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Role.deleteMany({});
    await mongoose.connection.close();
  });

  it('should validate password strength correctly', () => {
    expect(PasswordService.validateStrength('Weak')).toBe(false);
    expect(PasswordService.validateStrength('StrongPass123!')).toBe(true);
  });

  it('should hash user password and authenticate successfully', async () => {
    const user = await User.create({
      username: 'testadmin',
      email: 'testadmin@stockora.com',
      password: 'StrongPass123!',
      roleName: 'Company Owner',
    });

    expect(user.password).not.toBe('StrongPass123!');

    const authRes = await AuthService.authenticate('testadmin@stockora.com', 'StrongPass123!');
    expect(authRes.accessToken).toBeDefined();
    expect(authRes.refreshToken).toBeDefined();
    expect(authRes.user.username).toBe('testadmin');
  }, 15000);

  it('should lock user out after 5 consecutive login failures', async () => {
    const email = 'lockout@stockora.com';
    await User.create({
      username: 'lockoutuser',
      email,
      password: 'StrongPass123!',
      roleName: 'Company Owner',
    });

    for (let i = 0; i < 5; i++) {
      try {
        await AuthService.authenticate(email, 'wrongpass');
      } catch {
        // suppress auth error
      }
    }

    await expect(AuthService.authenticate(email, 'StrongPass123!')).rejects.toThrow(/locked/);
  }, 20000);
});
