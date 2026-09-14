import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuthService } from '../services/auth.service.js';
import { TenantService } from '../services/tenant.service.js';
import { seedUsersIfEmpty, seedRolesIfEmpty, seedDefaultsIfEmpty } from '../database/seeder.js';
import { DBConnectionManager } from '../database/connection.js';

describe('Deep Authentication Root-Cause & Lifecycle Reproduction Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_auth_reproduce');
    }
    await seedRolesIfEmpty();
    await seedDefaultsIfEmpty();
    await User.deleteMany({ email: /@reproduce-auth\.com$/ });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@reproduce-auth\.com$/ });
    await mongoose.connection.close();
  });

  it('Flow 1: User registers -> Logs in 1st time -> Logs in 2nd time -> Continues to succeed', async () => {
    const email = `flow1_${Date.now()}@reproduce-auth.com`;
    const password = 'ValidSecurePassword123!';

    // 1. Create user (simulate register)
    const user = await User.create({
      username: 'flow1_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    expect(user.password).not.toBe(password);
    expect(user.password?.startsWith('$2')).toBe(true);

    // 2. First login
    const login1 = await AuthService.authenticate(email, password);
    expect(login1.accessToken).toBeDefined();
    expect(login1.user.email).toBe(email.toLowerCase().trim());

    // 3. Second login (the one reported failing in user prompt)
    const login2 = await AuthService.authenticate(email, password);
    expect(login2.accessToken).toBeDefined();
    expect(login2.user.email).toBe(email.toLowerCase().trim());

    // 4. Third login
    const login3 = await AuthService.authenticate(email, password);
    expect(login3.accessToken).toBeDefined();
  });

  it('Flow 2: User registers -> Onboards Tenant (updates user document) -> Subsequent logins work', async () => {
    const email = `tenant_flow_${Date.now()}@reproduce-auth.com`;
    const password = 'TenantAdminPassword123!';

    const user = await User.create({
      username: 'tenant_flow_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // Login 1
    const login1 = await AuthService.authenticate(email, password);
    expect(login1.accessToken).toBeDefined();

    // Onboard tenant
    const onboardRes = await TenantService.onboardTenant({
      name: `Corp ${Date.now()}`,
      legalName: 'Corp Global Ltd',
      email: user.email,
      businessType: 'Retail',
      industry: 'Electronics',
      currency: 'USD',
      currencySymbol: '$',
      timezone: 'UTC',
      branchName: 'Main Store',
      branchCode: 'STR1',
      userId: user._id.toString(),
    });
    expect(onboardRes.tenant).toBeDefined();

    // Reload user from database and check password hash integrity
    const reloadedUser = await User.findById(user._id).select('+password');
    expect(reloadedUser?.password).toBeDefined();
    expect(reloadedUser?.password?.startsWith('$2')).toBe(true);

    // Login 2 after tenant onboarding
    const login2 = await AuthService.authenticate(email, password);
    expect(login2.accessToken).toBeDefined();
    expect(login2.user.tenants.length).toBeGreaterThan(0);
  });

  it('Flow 3: Seed rerun simulation (server restart) does NOT corrupt registered users', async () => {
    const email = `seeder_test_${Date.now()}@reproduce-auth.com`;
    const password = 'SeederImmunityPassword123!';

    await User.create({
      username: 'seeder_test_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // Login 1
    await AuthService.authenticate(email, password);

    // Run seedUsersIfEmpty (simulating server hot-reload or reboot)
    await seedUsersIfEmpty();

    // Login 2 after seeder
    const login2 = await AuthService.authenticate(email, password);
    expect(login2.accessToken).toBeDefined();
  });

  it('Flow 4: Special characters in passwords ($ prefix, spaces in email, etc.)', async () => {
    const email = `  Special.Char_User_${Date.now()}@reproduce-auth.com  `;
    const password = '$pecialP@ssw0rd!#123';

    await User.create({
      username: 'special_char_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    // Login with exact, mixed-case email, and leading/trailing spaces
    const login1 = await AuthService.authenticate(email.toUpperCase(), password);
    expect(login1.accessToken).toBeDefined();

    const login2 = await AuthService.authenticate(email.toLowerCase(), password);
    expect(login2.accessToken).toBeDefined();
  });

  it('Flow 5: Multi-user session isolation and independent credentials', async () => {
    const userA = { email: `usera_${Date.now()}@reproduce-auth.com`, pass: 'UserAPassword123!' };
    const userB = { email: `userb_${Date.now()}@reproduce-auth.com`, pass: 'UserBPassword123!' };
    const userC = { email: `userc_${Date.now()}@reproduce-auth.com`, pass: 'UserCPassword123!' };

    await User.create([
      {
        username: 'user_a',
        email: userA.email,
        password: userA.pass,
        roleName: 'Company Owner',
        isActive: true,
        isVerified: true,
      },
      {
        username: 'user_b',
        email: userB.email,
        password: userB.pass,
        roleName: 'Branch Manager',
        isActive: true,
        isVerified: true,
      },
      {
        username: 'user_c',
        email: userC.email,
        password: userC.pass,
        roleName: 'Cashier',
        isActive: true,
        isVerified: true,
      },
    ]);

    // Independent logins
    const authA = await AuthService.authenticate(userA.email, userA.pass);
    const authB = await AuthService.authenticate(userB.email, userB.pass);
    const authC = await AuthService.authenticate(userC.email, userC.pass);

    expect(authA.user.username).toBe('user_a');
    expect(authB.user.username).toBe('user_b');
    expect(authC.user.username).toBe('user_c');

    // Logout User B
    await AuthService.logout(authB.refreshToken, authB.sessionId);

    // User A and C can still log in and use tokens
    const authA2 = await AuthService.authenticate(userA.email, userA.pass);
    expect(authA2.accessToken).toBeDefined();

    // User B logs in again with same credentials
    const authB2 = await AuthService.authenticate(userB.email, userB.pass);
    expect(authB2.accessToken).toBeDefined();
  });

  it('Flow 6: Concurrent refresh token requests within grace period succeed without account mutation', async () => {
    const email = `concurrent_refresh_${Date.now()}@reproduce-auth.com`;
    const password = 'ConcurrentPass123!';

    const user = await User.create({
      username: 'concurrent_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    const initialAuth = await AuthService.authenticate(email, password);
    const initialRefreshToken = initialAuth.refreshToken;
    expect(initialRefreshToken).toBeDefined();

    // Simulate 3 parallel API requests firing refresh concurrently with the same token
    const [res1, res2, res3] = await Promise.all([
      AuthService.rotateRefreshToken(initialRefreshToken),
      AuthService.rotateRefreshToken(initialRefreshToken),
      AuthService.rotateRefreshToken(initialRefreshToken),
    ]);

    // All three should succeed within the 30-second concurrency grace window
    expect(res1.accessToken).toBeDefined();
    expect(res2.accessToken).toBeDefined();
    expect(res3.accessToken).toBeDefined();

    // Res2 and Res3 should return the active replacement token
    expect(res2.refreshToken).toBe(res1.refreshToken);
    expect(res3.refreshToken).toBe(res1.refreshToken);

    // User record in DB must NOT be modified or deleted
    const dbUser = await User.findById(user._id).select('+password');
    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe(email.toLowerCase().trim());
    expect(dbUser?.password?.startsWith('$2')).toBe(true);

    // User can still authenticate with original password
    const subsequentLogin = await AuthService.authenticate(email, password);
    expect(subsequentLogin.accessToken).toBeDefined();
  });

  it('Flow 7: 10 consecutive refresh token cycles without user or password mutation', async () => {
    const email = `multicycle_${Date.now()}@reproduce-auth.com`;
    const password = 'MultiCyclePassword123!';

    await User.create({
      username: 'multicycle_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    const initialAuth = await AuthService.authenticate(email, password);
    let currentRefreshToken = initialAuth.refreshToken;

    for (let cycle = 1; cycle <= 10; cycle++) {
      const refreshed = await AuthService.rotateRefreshToken(currentRefreshToken);
      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.user.email).toBe(email.toLowerCase().trim());
      currentRefreshToken = refreshed.refreshToken;
    }

    // After 10 cycles, verify password and login still succeeds flawlessly
    const finalLogin = await AuthService.authenticate(email, password);
    expect(finalLogin.accessToken).toBeDefined();
    expect(finalLogin.user.email).toBe(email.toLowerCase().trim());
  });

  it('Flow 8: Refresh token reuse attempt after grace period is rejected safely without breaking login', async () => {
    const email = `reuse_attack_${Date.now()}@reproduce-auth.com`;
    const password = 'ReuseAttackPassword123!';

    await User.create({
      username: 'reuse_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      isActive: true,
      isVerified: true,
    });

    const initialAuth = await AuthService.authenticate(email, password);
    const tokenToRevoke = initialAuth.refreshToken;

    // First rotation succeeds
    const rotated = await AuthService.rotateRefreshToken(tokenToRevoke);
    expect(rotated.refreshToken).toBeDefined();

    // Manually push revokedAt into the past beyond grace period (> 30s)
    await RefreshToken.updateOne(
      { token: tokenToRevoke },
      { $set: { revokedAt: new Date(Date.now() - 60 * 1000) } }
    );

    // Now re-using tokenToRevoke must throw AuthenticationError
    await expect(AuthService.rotateRefreshToken(tokenToRevoke)).rejects.toThrow(
      'Session expired or invalid. Please log in again.'
    );

    // Critical: Account and password must remain intact; user can still log in
    const reLogin = await AuthService.authenticate(email, password);
    expect(reLogin.accessToken).toBeDefined();
  });
});
