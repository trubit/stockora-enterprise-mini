import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AuthService } from '../services/auth.service.js';
import { DBConnectionManager } from '../database/connection.js';

describe('Authentication Lifecycle & Security Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_auth_lifecycle');
    }
    await User.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  it('1. Securely hashes password on user creation without double-hashing', async () => {
    const email = `test_${Date.now()}@authtest.com`;
    const password = 'Password123!';

    const user = await User.create({
      username: 'test_user_hash',
      email,
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    expect(user.password).not.toBe(password);
    expect(user.password?.startsWith('$2')).toBe(true);

    // Call save again without modifying password
    user.username = 'test_user_hash_updated';
    await user.save();

    const reloaded = await User.findById(user._id).select('+password');
    const isMatch = await bcrypt.compare(password, reloaded!.password!);
    expect(isMatch).toBe(true);
  });

  it('2. Normalizes email (case insensitivity & whitespace trimming) on authenticate', async () => {
    const email = `case_test_${Date.now()}@authtest.com`;
    const password = 'Password123!';

    await User.create({
      username: 'case_user',
      email: email.toLowerCase(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // Login with uppercase email
    const auth1 = await AuthService.authenticate(email.toUpperCase(), password);
    expect(auth1.user.email).toBe(email.toLowerCase());
    expect(auth1.accessToken).toBeDefined();

    // Login with leading/trailing spaces
    const auth2 = await AuthService.authenticate(`  ${email}  `, password);
    expect(auth2.user.email).toBe(email.toLowerCase());
    expect(auth2.accessToken).toBeDefined();
  });

  it('3. Successfully supports repeated logins and token issuance', async () => {
    const email = `repeat_test_${Date.now()}@authtest.com`;
    const password = 'Password123!';

    await User.create({
      username: 'repeat_user',
      email,
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // 5 consecutive successful logins
    for (let i = 0; i < 5; i++) {
      const auth = await AuthService.authenticate(email, password);
      expect(auth.accessToken).toBeTruthy();
      expect(auth.refreshToken).toBeTruthy();
    }
  });

  it('4. Rejects invalid password with AuthenticationError', async () => {
    const email = `fail_test_${Date.now()}@authtest.com`;
    const password = 'Password123!';

    await User.create({
      username: 'fail_user',
      email,
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    await expect(AuthService.authenticate(email, 'WrongPassword999!')).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('5. Profile & settings updates do not corrupt or clear password hash', async () => {
    const email = `update_test_${Date.now()}@authtest.com`;
    const password = 'Password123!';

    const user = await User.create({
      username: 'update_user',
      email,
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // Update non-auth fields
    user.themePreference = 'light';
    user.preferredLanguage = 'fr';
    user.timeZone = 'Africa/Lagos';
    await user.save();

    // Verify authentication still succeeds seamlessly
    const auth = await AuthService.authenticate(email, password);
    expect(auth.user._id.toString()).toBe(user._id.toString());
  });
});
