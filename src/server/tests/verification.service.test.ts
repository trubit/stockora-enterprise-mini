import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { VerificationService } from '../services/verification.service.js';
import { Verification } from '../models/Verification.js';
import { AuditLog } from '../models/AuditLog.js';

describe('Stockora Verification Service & OTP Engine Security Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_verification_engine');
    }
  });

  afterAll(async () => {
    await Verification.deleteMany({});
    await AuditLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Verification.deleteMany({});
    await AuditLog.deleteMany({});
  });

  it('1. Generates cryptographically secure 6-digit numeric OTPs without predictable patterns', () => {
    const otps = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const otp = VerificationService.generateOtp(6);
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
      otps.add(otp);
    }
    // High entropy — 100 random 6-digit OTPs should produce at least 95 unique values
    expect(otps.size).toBeGreaterThanOrEqual(95);
  });

  it('2. Securely hashes OTP with HMAC-SHA256 and never stores plaintext in MongoDB', async () => {
    const email = 'security@stockora.com';
    const { rawOtp, verification } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    expect(rawOtp).toMatch(/^\d{6}$/);

    const recordInDb = await Verification.findById(verification._id);
    expect(recordInDb).toBeTruthy();
    expect(recordInDb?.otpHash).toBeDefined();
    // Plaintext OTP is NEVER stored in database
    expect(recordInDb?.otpHash).not.toBe(rawOtp);
    expect(recordInDb?.otpHash.length).toBe(64); // SHA-256 hex digest length
  });

  it('3. Successfully verifies valid OTP and consumes the code atomically', async () => {
    const email = 'user1@stockora.com';
    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    const result = await VerificationService.verifyOtp({
      email,
      otp: rawOtp,
      purpose: 'EMAIL_VERIFICATION',
    });

    expect(result.success).toBe(true);
    expect(result.verification.isConsumed).toBe(true);
    expect(result.verification.verifiedAt).toBeDefined();
  });

  it('4. Rejects incorrect OTP and increments attempt counter', async () => {
    const email = 'user2@stockora.com';
    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    const wrongOtp = rawOtp === '123456' ? '654321' : '123456';

    await expect(
      VerificationService.verifyOtp({
        email,
        otp: wrongOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/Incorrect verification code/);

    const record = await Verification.findOne({ email });
    expect(record?.attemptCount).toBe(1);
    expect(record?.isConsumed).toBe(false);
  });

  it('5. Locks and invalidates OTP after maximum failed attempts (5 attempts)', async () => {
    const email = 'user3@stockora.com';
    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    const wrongOtp = rawOtp === '123456' ? '654321' : '123456';

    for (let i = 0; i < 4; i++) {
      await expect(
        VerificationService.verifyOtp({
          email,
          otp: wrongOtp,
          purpose: 'EMAIL_VERIFICATION',
        })
      ).rejects.toThrow(/attempt\(s\) remaining/);
    }

    // 5th failed attempt triggers maximum attempt lock
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: wrongOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/Maximum verification attempts exceeded/);

    const record = await Verification.findOne({ email });
    expect(record?.isConsumed).toBe(true);

    // Even with correct OTP, subsequent verification must fail
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/invalid or has expired|exceeded/);
  });

  it('6. Rejects expired OTP codes', async () => {
    const email = 'user_expired@stockora.com';
    const { rawOtp, verification } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Manually set expiration in the past
    await Verification.findByIdAndUpdate(verification._id, {
      $set: { expiresAt: new Date(Date.now() - 60000) },
    });

    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/expired/);
  });

  it('7. Enforces single-use / replay protection (re-verifying a consumed OTP fails)', async () => {
    const email = 'replay@stockora.com';
    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // First verification succeeds
    const res1 = await VerificationService.verifyOtp({
      email,
      otp: rawOtp,
      purpose: 'EMAIL_VERIFICATION',
    });
    expect(res1.success).toBe(true);

    // Second verification attempt fails immediately
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/invalid or has expired/);
  });

  it('8. Invalidates previous active OTP when a new OTP is created for the same purpose', async () => {
    const email = 'replaced@stockora.com';

    // First OTP
    const first = await VerificationService.createVerification({
      email,
      purpose: 'PASSWORD_RESET',
    });

    // Simulate cooldown passing by backdating lastSentAt
    await Verification.findByIdAndUpdate(first.verification._id, {
      $set: { lastSentAt: new Date(Date.now() - 120000) },
    });

    // Second OTP
    const second = await VerificationService.createVerification({
      email,
      purpose: 'PASSWORD_RESET',
    });

    expect(second.rawOtp).toBeDefined();

    // First OTP must be consumed/invalidated
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: first.rawOtp,
        purpose: 'PASSWORD_RESET',
      })
    ).rejects.toThrow();

    // Second OTP succeeds
    const res = await VerificationService.verifyOtp({
      email,
      otp: second.rawOtp,
      purpose: 'PASSWORD_RESET',
    });
    expect(res.success).toBe(true);
  });

  it('9. Enforces resend cooldown protection within 60 seconds', async () => {
    const email = 'cooldown@stockora.com';

    await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Immediate second request within 60s cooldown must throw ValidationError
    await expect(
      VerificationService.createVerification({
        email,
        purpose: 'EMAIL_VERIFICATION',
      })
    ).rejects.toThrow(/Please wait \d+ second\(s\) before requesting another code/);
  });

  it('10. Enforces strict purpose isolation (EMAIL_VERIFICATION cannot be used for PASSWORD_RESET)', async () => {
    const email = 'purpose@stockora.com';

    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Attempt to verify with PASSWORD_RESET purpose must fail
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'PASSWORD_RESET',
      })
    ).rejects.toThrow(/invalid or has expired/);

    // Verify with correct EMAIL_VERIFICATION purpose succeeds
    const res = await VerificationService.verifyOtp({
      email,
      otp: rawOtp,
      purpose: 'EMAIL_VERIFICATION',
    });
    expect(res.success).toBe(true);
  });

  it('11. Enforces multi-tenant isolation for employee invitations', async () => {
    const email = 'employee@stockora.com';
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();

    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMPLOYEE_INVITATION',
      tenantId: tenantA,
    });

    // Attempting to verify under Tenant B context must fail
    await expect(
      VerificationService.verifyOtp({
        email,
        otp: rawOtp,
        purpose: 'EMPLOYEE_INVITATION',
        tenantId: tenantB,
      })
    ).rejects.toThrow(/invalid or has expired/);

    // Verifying under Tenant A succeeds
    const res = await VerificationService.verifyOtp({
      email,
      otp: rawOtp,
      purpose: 'EMPLOYEE_INVITATION',
      tenantId: tenantA,
    });
    expect(res.success).toBe(true);
  });

  it('12. Concurrent verification simulation ensures only one request succeeds', async () => {
    const email = 'concurrent@stockora.com';
    const { rawOtp } = await VerificationService.createVerification({
      email,
      purpose: 'EMAIL_VERIFICATION',
    });

    // Fire 5 simultaneous verification requests with the same OTP
    const promises = Array(5)
      .fill(null)
      .map(() =>
        VerificationService.verifyOtp({
          email,
          otp: rawOtp,
          purpose: 'EMAIL_VERIFICATION',
        })
          .then(() => 'SUCCESS')
          .catch((err) => err.message)
      );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r === 'SUCCESS').length;

    // Exactly one concurrent request MUST succeed; all others must be rejected
    expect(successCount).toBe(1);
  });
});
