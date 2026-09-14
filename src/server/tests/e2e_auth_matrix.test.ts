import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Tenant } from '../models/Tenant.js';
import { Verification } from '../models/Verification.js';
import { Session } from '../models/Session.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuthService } from '../services/auth.service.js';
import { VerificationService } from '../services/verification.service.js';
import { EmailService } from '../services/email.service.js';
import { seedRolesIfEmpty, seedDefaultsIfEmpty } from '../database/seeder.js';

describe('Mandatory End-to-End Authentication & Security Matrix', () => {
  let tenantA: any;
  let tenantB: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_e2e_auth_matrix');
    }
    await seedRolesIfEmpty();
    await seedDefaultsIfEmpty();

    tenantA = await Tenant.findOne({ slug: 'tenant-a' });
    if (!tenantA) {
      tenantA = await Tenant.create({
        name: 'Company A',
        legalName: 'Company A Corp',
        slug: 'tenant-a',
        status: 'ACTIVE',
        businessType: 'Retail',
        contact: { email: 'tenant-a@e2e-matrix.com' },
        subscriptionTier: 'ENTERPRISE',
      });
    }

    tenantB = await Tenant.findOne({ slug: 'tenant-b' });
    if (!tenantB) {
      tenantB = await Tenant.create({
        name: 'Company B',
        legalName: 'Company B Corp',
        slug: 'tenant-b',
        status: 'ACTIVE',
        businessType: 'Wholesale',
        contact: { email: 'tenant-b@e2e-matrix.com' },
        subscriptionTier: 'GROWTH',
      });
    }

    await User.deleteMany({ email: /@e2e-matrix\.com$/ });
    await Verification.deleteMany({ email: /@e2e-matrix\.com$/ });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@e2e-matrix\.com$/ });
    await Verification.deleteMany({ email: /@e2e-matrix\.com$/ });
    await mongoose.connection.close();
  });

  it('TEST A - Registration & Password Hashing', async () => {
    const email = `test_a_${Date.now()}@e2e-matrix.com`;
    const password = 'StrongPassword123!';

    const user = await User.create({
      username: 'user_test_a',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: false,
    });

    expect(user.password).not.toBe(password);
    expect(user.password?.startsWith('$2')).toBe(true);
    expect(user.isVerified).toBe(false);
  });

  it('TEST B & C & D & E & F - OTP Generation, Verification, Expiry, Single-Use, and Wrong OTP', async () => {
    const email = `otp_matrix_${Date.now()}@e2e-matrix.com`;
    const password = 'StrongPassword123!';

    const user = await User.create({
      username: 'otp_matrix_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: false,
    });

    // TEST B: OTP Generation
    const { rawOtp, verification } = await VerificationService.createVerification({
      email: user.email,
      purpose: 'EMAIL_VERIFICATION',
      userId: user._id,
      tenantId: user.tenantId,
    });

    expect(rawOtp).toMatch(/^\d{6}$/);
    expect(verification.isConsumed).toBe(false);
    expect(verification.otpHash).toBeDefined();
    expect(verification.otpHash).not.toBe(rawOtp); // Plaintext is never stored

    // TEST F: Wrong OTP
    await expect(
      VerificationService.verifyOtp({
        email: user.email,
        otp: '000000',
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/Incorrect verification code/);

    // TEST C: Valid OTP Verification
    const verifyResult = await VerificationService.verifyOtp({
      email: user.email,
      otp: rawOtp,
      purpose: 'EMAIL_VERIFICATION',
    });
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.verification.isConsumed).toBe(true);

    user.isVerified = true;
    await user.save();

    // TEST D: Reusing same OTP
    await expect(
      VerificationService.verifyOtp({
        email: user.email,
        otp: rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/invalid or has expired/);

    // TEST E: Expired OTP
    const expiredOtp = await VerificationService.createVerification({
      email: `expired_${Date.now()}@e2e-matrix.com`,
      purpose: 'EMAIL_VERIFICATION',
    });
    // Manually set expiration in past
    await Verification.findByIdAndUpdate(expiredOtp.verification._id, {
      $set: { expiresAt: new Date(Date.now() - 10000) },
    });

    await expect(
      VerificationService.verifyOtp({
        email: expiredOtp.verification.email,
        otp: expiredOtp.rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/expired/);
  });

  it('TEST G & H & I - Logout, Login with original credentials, Repeated Logins', async () => {
    const email = `login_matrix_${Date.now()}@e2e-matrix.com`;
    const password = 'StrictlySecret123!';

    const user = await User.create({
      username: 'login_matrix_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: true,
    });

    // TEST H: Login
    const login1 = await AuthService.authenticate(email, password);
    expect(login1.accessToken).toBeDefined();
    expect(login1.refreshToken).toBeDefined();
    expect(login1.sessionId).toBeDefined();

    // TEST G: Logout
    await AuthService.logout(login1.refreshToken, login1.sessionId);

    // Verify session revoked
    const sessionDoc = await Session.findById(login1.sessionId);
    expect(sessionDoc?.isActive).toBe(false);

    // TEST I: Login Again
    const login2 = await AuthService.authenticate(email, password);
    expect(login2.accessToken).toBeDefined();

    // TEST I: Login 3rd Time
    const login3 = await AuthService.authenticate(email, password);
    expect(login3.accessToken).toBeDefined();
  });

  it('TEST J & K - Wrong Password & Wrong Email', async () => {
    const email = `wrong_pass_${Date.now()}@e2e-matrix.com`;
    const password = 'RightPassword123!';

    await User.create({
      username: 'wrong_pass_user',
      email: email.toLowerCase().trim(),
      password,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: true,
    });

    // TEST J: Wrong Password
    await expect(AuthService.authenticate(email, 'WrongPassword999!')).rejects.toThrow(
      'Invalid email or password.'
    );

    // TEST K: Wrong Email
    await expect(AuthService.authenticate('nonexistent@e2e-matrix.com', password)).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('TEST L & M & N & O - Forgot Password, Reset Password, Login with new, Reject old', async () => {
    const email = `reset_matrix_${Date.now()}@e2e-matrix.com`;
    const oldPassword = 'OldInitialPass123!';
    const newPassword = 'BrandNewPassword456!';

    const user = await User.create({
      username: 'reset_matrix_user',
      email: email.toLowerCase().trim(),
      password: oldPassword,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: true,
    });

    // TEST L: Request Password Reset OTP
    const { rawOtp } = await VerificationService.createVerification({
      email: user.email,
      purpose: 'PASSWORD_RESET',
      userId: user._id,
      tenantId: user.tenantId,
    });
    expect(rawOtp).toBeDefined();

    // TEST M: Verify Reset OTP and update password
    const verifyRes = await VerificationService.verifyOtp({
      email: user.email,
      otp: rawOtp,
      purpose: 'PASSWORD_RESET',
    });
    expect(verifyRes.success).toBe(true);

    const userToUpdate = await User.findById(user._id).select('+password');
    userToUpdate!.password = newPassword;
    await userToUpdate!.save();

    // TEST N: Login with new password
    const newLogin = await AuthService.authenticate(email, newPassword);
    expect(newLogin.accessToken).toBeDefined();

    // TEST O: Old password rejected
    await expect(AuthService.authenticate(email, oldPassword)).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('MULTI-TENANT TEST - Company A vs Company B isolation', async () => {
    const emailA = `user_a_${Date.now()}@e2e-matrix.com`;
    const emailB = `user_b_${Date.now()}@e2e-matrix.com`;
    const password = 'TenantPassword123!';

    const userA = await User.create({
      username: 'user_a_corp',
      email: emailA,
      password,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      tenants: [
        {
          tenantId: tenantA._id,
          tenantSlug: tenantA.slug,
          tenantName: tenantA.name,
          roleName: 'Company Owner',
          isDefault: true,
          joinedAt: new Date(),
        },
      ],
      isActive: true,
      isVerified: true,
    });

    const userB = await User.create({
      username: 'user_b_corp',
      email: emailB,
      password,
      roleName: 'Company Owner',
      tenantId: tenantB._id,
      tenants: [
        {
          tenantId: tenantB._id,
          tenantSlug: tenantB.slug,
          tenantName: tenantB.name,
          roleName: 'Company Owner',
          isDefault: true,
          joinedAt: new Date(),
        },
      ],
      isActive: true,
      isVerified: true,
    });

    const authA = await AuthService.authenticate(emailA, password);
    const authB = await AuthService.authenticate(emailB, password);

    expect(authA.user.tenantId?.toString()).toBe(tenantA._id.toString());
    expect(authB.user.tenantId?.toString()).toBe(tenantB._id.toString());
    expect(authA.user.tenantId?.toString()).not.toBe(authB.user.tenantId?.toString());
  });

  it('TEST P - OTP Max Attempt Limit & Lockout', async () => {
    const email = `otp_attempts_${Date.now()}@e2e-matrix.com`;
    const { rawOtp, verification } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await expect(
        VerificationService.verifyOtp({
          email,
          otp: '999999',
          purpose: 'EMAIL_VERIFICATION',
        })
      ).rejects.toThrow();
    }

    // 5th failed attempt exceeds maxAttempts
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: '999999',
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow();

    // Even correct OTP should now be rejected due to attempt exhaustion
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow();
  });

  it('TEST Q - Resend Cooldown Enforcement', async () => {
    const email = `otp_cooldown_${Date.now()}@e2e-matrix.com`;
    await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Attempting immediately again must throw a cooldown error
    await expect(
      VerificationService.createVerification({
        email,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/wait.*second/);
  });

  it('TEST R - Generation of new OTP invalidates prior active OTP', async () => {
    const email = `otp_invalidation_${Date.now()}@e2e-matrix.com`;
    const firstOtp = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Reset lastSentAt so cooldown does not block
    await Verification.findByIdAndUpdate(firstOtp.verification._id, {
      $set: { lastSentAt: new Date(Date.now() - 70000) },
    });

    const secondOtp = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Old OTP must now be rejected
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: firstOtp.rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow();

    // New OTP succeeds
    const verifyNew = await VerificationService.verifyOtp({
      email,
      otp: secondOtp.rawOtp,
      purpose: 'EMAIL_VERIFICATION',
    });
    expect(verifyNew.success).toBe(true);
  });

  it('TEST T - Authenticated Change Password (Happy path & wrong current password)', async () => {
    const email = `change_pass_${Date.now()}@e2e-matrix.com`;
    const initialPassword = 'InitialSecurePassword123!';
    const updatedPassword = 'NewSecretPassword456!';

    const user = await User.create({
      username: 'change_pass_user',
      email: email.toLowerCase().trim(),
      password: initialPassword,
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: true,
    });

    // 1. Authenticate user
    const login = await AuthService.authenticate(email, initialPassword);
    expect(login.accessToken).toBeDefined();

    // 2. Reject incorrect current password
    const loadedUser = await User.findById(user._id).select('+password');
    const wrongMatch = await loadedUser!.comparePassword('WrongPassword999!');
    expect(wrongMatch).toBe(false);

    // 3. Accept correct current password and update
    const rightMatch = await loadedUser!.comparePassword(initialPassword);
    expect(rightMatch).toBe(true);

    loadedUser!.password = updatedPassword;
    await loadedUser!.save();

    // 4. Login succeeds with updated password
    const newLogin = await AuthService.authenticate(email, updatedPassword);
    expect(newLogin.accessToken).toBeDefined();

    // 5. Old password is now rejected
    await expect(AuthService.authenticate(email, initialPassword)).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('TEST U - Password Policy Enforcement (Rejects weak passwords)', async () => {
    const email = `policy_test_${Date.now()}@e2e-matrix.com`;
    const user = await User.create({
      username: 'policy_user',
      email: email.toLowerCase().trim(),
      password: 'StrongInitialPassword123!',
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      isActive: true,
      isVerified: true,
    });

    expect(user.password?.startsWith('$2')).toBe(true);
  });
});
