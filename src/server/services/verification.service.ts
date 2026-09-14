import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  Verification,
  type IVerification,
  type VerificationPurpose,
} from '../models/Verification.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, AuthenticationError } from '../errors/AppError.js';
import { config } from '../../config/environment.js';
import { logger } from '../logger.js';

export interface CreateVerificationParams {
  email: string;
  purpose: VerificationPurpose;
  userId?: string | mongoose.Types.ObjectId;
  tenantId?: string | mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyOtpParams {
  email: string;
  otp: string;
  purpose: VerificationPurpose;
  tenantId?: string | mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
}

export class VerificationService {
  /**
   * Generates a cryptographically secure 6-digit numeric OTP.
   * Uniformly sampled from [100000, 999999].
   */
  public static generateOtp(length = 6): string {
    if (length === 6) {
      const num = crypto.randomInt(100000, 1000000);
      return num.toString();
    }
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length);
    return crypto.randomInt(min, max).toString();
  }

  /**
   * Securely hashes the OTP with HMAC-SHA256 using server secrets.
   * Plaintext OTP is NEVER stored in database or logs.
   */
  public static hashOtp(otp: string, email: string, purpose: VerificationPurpose): string {
    const normalizedEmail = email.toLowerCase().trim();
    const hmac = crypto.createHmac('sha256', config.jwtSecret || 'stockora-verification-salt');
    hmac.update(`${normalizedEmail}:${purpose}:${otp.trim()}`);
    return hmac.digest('hex');
  }

  /**
   * Generates, stores, and returns a new verification OTP.
   * Enforces cooldowns, invalidates prior active codes for the purpose, and sets short TTL.
   */
  public static async createVerification(params: CreateVerificationParams): Promise<{
    rawOtp: string;
    verification: IVerification;
  }> {
    const normalizedEmail = params.email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new ValidationError('A valid email address is required.');
    }

    const tenantObjectId = params.tenantId
      ? new mongoose.Types.ObjectId(params.tenantId.toString())
      : undefined;
    const userObjectId = params.userId
      ? new mongoose.Types.ObjectId(params.userId.toString())
      : undefined;

    // 1. Resend Cooldown Enforcement
    const cooldownSeconds = config.otpResendCooldownSeconds || 60;
    const cooldownThreshold = new Date(Date.now() - cooldownSeconds * 1000);

    const query: Record<string, unknown> = {
      email: normalizedEmail,
      purpose: params.purpose,
      isConsumed: false,
      lastSentAt: { $gt: cooldownThreshold },
    };
    if (tenantObjectId) {
      query.tenantId = tenantObjectId;
    }

    const recentActive = await Verification.findOne(query).sort({ lastSentAt: -1 });
    if (recentActive) {
      const remainingSeconds = Math.ceil(
        (recentActive.lastSentAt.getTime() + cooldownSeconds * 1000 - Date.now()) / 1000
      );
      throw new ValidationError(
        `Please wait ${Math.max(1, remainingSeconds)} second(s) before requesting another code.`
      );
    }

    // 2. Invalidate previous unconsumed verification records for this user/email & purpose
    const invalidateQuery: Record<string, unknown> = {
      email: normalizedEmail,
      purpose: params.purpose,
      isConsumed: false,
    };
    if (tenantObjectId) {
      invalidateQuery.tenantId = tenantObjectId;
    }
    await Verification.updateMany(invalidateQuery, {
      $set: { isConsumed: true },
    });

    // 3. Generate Cryptographically Secure OTP and Hash
    const rawOtp = this.generateOtp(6);
    const otpHash = this.hashOtp(rawOtp, normalizedEmail, params.purpose);

    const expirationMinutes = config.otpExpirationMinutes || 10;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const maxAttempts = config.otpMaxAttempts || 5;

    // 4. Create and persist new Verification document
    const verification = await Verification.create({
      userId: userObjectId,
      tenantId: tenantObjectId,
      email: normalizedEmail,
      purpose: params.purpose,
      otpHash,
      expiresAt,
      attemptCount: 0,
      maxAttempts,
      lastSentAt: new Date(),
      isConsumed: false,
      metadata: params.metadata || {},
    });

    // 5. Audit log (Never log the raw OTP)
    try {
      await AuditLog.create({
        userId: userObjectId,
        tenantId: tenantObjectId,
        action: 'OTP_REQUESTED',
        targetModel: 'Verification',
        targetId: verification._id.toString(),
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'Unknown',
        newValues: {
          email: normalizedEmail,
          purpose: params.purpose,
          expiresAt,
        },
      });
    } catch (auditErr) {
      logger.warn('[VerificationService] Failed to record OTP_REQUESTED audit log:', auditErr);
    }

    return { rawOtp, verification };
  }

  /**
   * Atomically verifies an OTP against an active verification record.
   * Protects against brute-force, concurrency races, expired codes, and purpose mismatch.
   */
  public static async verifyOtp(params: VerifyOtpParams): Promise<{
    success: boolean;
    verification: IVerification;
  }> {
    const normalizedEmail = params.email.toLowerCase().trim();
    const cleanOtp = (params.otp || '').trim();

    if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
      throw new ValidationError('A 6-digit numeric verification code is required.');
    }

    const tenantObjectId = params.tenantId
      ? new mongoose.Types.ObjectId(params.tenantId.toString())
      : undefined;

    const query: Record<string, unknown> = {
      email: normalizedEmail,
      purpose: params.purpose,
      isConsumed: false,
    };
    if (tenantObjectId) {
      query.tenantId = tenantObjectId;
    }

    // Find the latest active unconsumed record
    const record = await Verification.findOne(query).sort({ createdAt: -1 });

    if (!record) {
      throw new AuthenticationError('The verification code is invalid or has expired.');
    }

    // Purpose Isolation Check
    if (record.purpose !== params.purpose) {
      throw new AuthenticationError('Invalid verification purpose.');
    }

    // Expiration Check
    if (record.expiresAt < new Date()) {
      record.isConsumed = true;
      await record.save();

      await AuditLog.create({
        userId: record.userId,
        tenantId: record.tenantId,
        action: 'OTP_EXPIRED',
        targetModel: 'Verification',
        targetId: record._id.toString(),
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'Unknown',
        newValues: { email: normalizedEmail, purpose: params.purpose },
      }).catch(() => {});

      throw new AuthenticationError('The verification code has expired. Please request a new one.');
    }

    // Attempt Limit Check
    if (record.attemptCount >= record.maxAttempts) {
      record.isConsumed = true;
      await record.save();

      await AuditLog.create({
        userId: record.userId,
        tenantId: record.tenantId,
        action: 'OTP_MAX_ATTEMPTS_EXCEEDED',
        targetModel: 'Verification',
        targetId: record._id.toString(),
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'Unknown',
        newValues: { email: normalizedEmail, purpose: params.purpose },
      }).catch(() => {});

      throw new AuthenticationError(
        'Maximum verification attempts exceeded. Please request a new code.'
      );
    }

    // Compute expected hash and compare in constant time
    const expectedHash = this.hashOtp(cleanOtp, normalizedEmail, params.purpose);
    const isMatch =
      record.otpHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(record.otpHash), Buffer.from(expectedHash));

    if (!isMatch) {
      // Increment attempt counter atomically
      const updated = await Verification.findOneAndUpdate(
        { _id: record._id, isConsumed: false },
        { $inc: { attemptCount: 1 } },
        { new: true }
      );

      const currentAttempts = updated?.attemptCount || record.attemptCount + 1;
      const remainingAttempts = Math.max(0, record.maxAttempts - currentAttempts);

      if (currentAttempts >= record.maxAttempts) {
        await Verification.findByIdAndUpdate(record._id, { $set: { isConsumed: true } });
      }

      await AuditLog.create({
        userId: record.userId,
        tenantId: record.tenantId,
        action: 'OTP_VERIFICATION_FAILED',
        targetModel: 'Verification',
        targetId: record._id.toString(),
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'Unknown',
        newValues: {
          email: normalizedEmail,
          purpose: params.purpose,
          attemptCount: currentAttempts,
        },
      }).catch(() => {});

      if (remainingAttempts === 0) {
        throw new AuthenticationError(
          'Maximum verification attempts exceeded. Please request a new code.'
        );
      }

      throw new AuthenticationError(
        `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`
      );
    }

    // Atomic consumption to prevent concurrency race conditions & replay
    const consumed = await Verification.findOneAndUpdate(
      {
        _id: record._id,
        isConsumed: false,
        expiresAt: { $gt: new Date() },
        attemptCount: { $lt: record.maxAttempts },
      },
      {
        $set: {
          isConsumed: true,
          verifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!consumed) {
      throw new AuthenticationError(
        'Verification already processed or expired. Please request a new code.'
      );
    }

    // Audit log successful verification
    await AuditLog.create({
      userId: consumed.userId,
      tenantId: consumed.tenantId,
      action: 'OTP_VERIFICATION_SUCCESS',
      targetModel: 'Verification',
      targetId: consumed._id.toString(),
      ipAddress: params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || 'Unknown',
      newValues: { email: normalizedEmail, purpose: params.purpose },
    }).catch(() => {});

    return { success: true, verification: consumed };
  }
}
