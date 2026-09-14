import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthService, validatePasswordStrength } from '../services/auth.service.js';
import { VerificationService } from '../services/verification.service.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Session } from '../models/Session.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { Verification } from '../models/Verification.js';
import {
  ValidationError,
  ConflictError,
  AuthenticationError,
  NotFoundError,
} from '../errors/AppError.js';
import { EmailService } from '../services/email.service.js';
import { redis } from '../database/redis.js';
import { config } from '../../config/environment.js';
import { sanitizeInput } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Plan } from '../models/Plan.js';
import { BillingService } from '../services/billing.service.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { logger } from '../logger.js';
import { getEffectivePermissions } from '../../shared/permissions.js';

/** TTL for short-lived password-reset authorization tokens stored in Redis: 15 minutes */
const RESET_AUTH_TOKEN_TTL_SECONDS = 900;
const RESET_AUTH_TOKEN_REDIS_PREFIX = 'pwd_reset_auth:';

export class AuthController {
  /**
   * POST /auth/register
   * Creates a new user account with isVerified: false,
   * generates an authoritative Stockora EMAIL_VERIFICATION OTP,
   * and delivers the code via Brevo email delivery.
   */
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { username, email, password, roleName, companyName, branchId, allowedBranches } =
      req.body;

    if (!username || !email || !password || !roleName) {
      return next(new ValidationError('Username, email, password, and roleName are required.'));
    }

    // Sanitize inputs to prevent NoSQL injection
    const normalizedEmail = String(sanitizeInput(email) || '')
      .toLowerCase()
      .trim();
    const normalizedUsername = String(sanitizeInput(username) || '').trim();
    const rawCompanyName = String(sanitizeInput(companyName) || '').trim();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return next(new ValidationError('A valid email address is required.'));
    }

    try {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return next(new ConflictError('Email is already registered.'));
      }

      const roleExists = await Role.findOne({ name: String(sanitizeInput(roleName)) });
      if (!roleExists) {
        return next(new ValidationError(`Specified role [${roleName}] does not exist.`));
      }

      // Password policy validation
      let sysConfig = await SystemConfig.findOne();
      if (!sysConfig) {
        sysConfig = await SystemConfig.create({
          maintenanceMode: false,
          featureFlags: new Map([
            ['loyaltyProgram', true],
            ['offlinePOS', true],
            ['returns_exchanges', true],
          ]),
          allowedIPs: [],
          deniedIPs: [],
          maxConcurrentSessions: 3,
          sessionTimeoutMinutes: 60,
        });
      }

      const passError = validatePasswordStrength(password, sysConfig.passwordPolicy);
      if (passError) {
        return next(new ValidationError(passError));
      }

      // Determine platform admin status strictly via environment variable
      const platformAdminEmail = config.platformAdminEmail;
      const isAdminEmail = Boolean(
        platformAdminEmail && normalizedEmail === platformAdminEmail.toLowerCase().trim()
      );

      let requestedRole = String(sanitizeInput(roleName));
      // STRICT SECURITY: Under NO circumstance may an unauthorized email claim 'Super Administrator'
      if (
        !isAdminEmail &&
        (requestedRole === 'Super Administrator' || requestedRole.toLowerCase().includes('super'))
      ) {
        requestedRole = 'Company Owner';
      }

      const finalRoleName = isAdminEmail ? 'Super Administrator' : requestedRole;
      const isPlatformAdmin = isAdminEmail;

      const { Tenant } = await import('../models/Tenant.js');
      const { TenantService } = await import('../services/tenant.service.js');

      let userTenantId: any = undefined;
      let userTenantsList: any[] = [];
      let initialTenantDoc: any = null;

      if (finalRoleName === 'Company Owner' || rawCompanyName) {
        const businessName = rawCompanyName || 'My Company';
        const tenantSlug = await TenantService.generateUniqueSlug(businessName);

        // Ensure default plans are present and load authoritative FREE tier
        await BillingService.ensureDefaultPlans();
        const freePlan = await Plan.findOne({ tier: 'FREE', status: 'ACTIVE' });
        const freeFeatures = freePlan?.features
          ? (freePlan.features as any).toObject
            ? (freePlan.features as any).toObject()
            : freePlan.features
          : { pos: true, inventory: true };
        const freeLimits = {
          maxUsers: freePlan?.limits?.users?.count ?? 1,
          maxBranches: freePlan?.limits?.branches?.count ?? 1,
          maxWarehouses: freePlan?.limits?.warehouses?.count ?? 1,
          maxPOSTerminals: freePlan?.limits?.posTerminals?.count ?? 1,
          maxProducts: freePlan?.limits?.products?.count ?? 50,
          maxStorageMb: freePlan?.limits?.storageMb?.count ?? 512,
        };

        initialTenantDoc = await Tenant.create({
          name: businessName,
          legalName: businessName,
          slug: tenantSlug,
          status: 'ACTIVE',
          businessType: 'Retail',
          contact: {
            email: normalizedEmail,
          },
          fiscalConfig: {
            currency: 'USD',
            currencySymbol: '$',
            timezone: 'UTC',
            locale: 'en-US',
          },
          branding: {
            primaryColor: '#6366f1',
            secondaryColor: '#4f46e5',
            accentColor: '#10b981',
          },
          features: new Map(Object.entries(freeFeatures)),
          limits: freeLimits,
          subscriptionTier: 'FREE',
          onboardingCompleted: false,
          onboardingStep: 1,
        });

        // Initialize authoritative Free subscription record
        if (freePlan) {
          try {
            const initialSub = await SubscriptionService.createSubscription({
              tenantId: initialTenantDoc._id.toString(),
              planId: freePlan._id.toString(),
              billingInterval: 'MONTHLY',
              isTrial: false,
            });
            initialTenantDoc.subscriptionReference = initialSub._id.toString();
            await initialTenantDoc.save();
          } catch (subErr) {
            logger.warn(
              `[AuthController] Failed to initialize default free subscription: ${subErr}`
            );
          }
        }

        userTenantId = initialTenantDoc._id;
        userTenantsList = [
          {
            tenantId: initialTenantDoc._id,
            tenantSlug: initialTenantDoc.slug,
            tenantName: initialTenantDoc.name,
            roleName: finalRoleName,
            isDefault: true,
            joinedAt: new Date(),
          },
        ];
      }

      const user = await User.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        roleName: finalRoleName,
        isPlatformAdmin,
        branchId,
        allowedBranches: allowedBranches || (branchId ? [branchId] : []),
        isActive: true,
        isVerified: false, // Verification required
        tenantId: userTenantId,
        tenants: userTenantsList,
      });

      if (initialTenantDoc) {
        await Tenant.findByIdAndUpdate(initialTenantDoc._id, { ownerUserId: user._id });
      }

      // Generate Verification OTP via Stockora Verification Service
      const { rawOtp } = await VerificationService.createVerification({
        email: user.email,
        purpose: 'EMAIL_VERIFICATION',
        userId: user._id,
        tenantId: user.tenantId,
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
      });

      // Dispatch real email through Brevo delivery layer
      try {
        await EmailService.sendVerificationOtp(user.email, user.username, rawOtp);
      } catch (emailErr: any) {
        logger.error(
          '[AuthController.register] Email delivery failed:',
          emailErr?.message || emailErr
        );
        // User is created; notify client that verification code delivery needs retry
        res.status(201).json({
          success: true,
          message:
            'Account registered. Please click "Resend Code" on the verification screen if the email does not arrive.',
          email: user.email,
          requiresVerification: true,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message:
          'Account registered successfully. A verification code has been sent to your email.',
        email: user.email,
        requiresVerification: true,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/verify-email
   * Atomically verifies the 6-digit OTP for EMAIL_VERIFICATION,
   * marks user.isVerified = true, and returns authenticated session tokens.
   */
  public static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return next(new ValidationError('Email and 6-digit verification code are required.'));
    }

    const normalizedEmail = String(sanitizeInput(email)).toLowerCase().trim();

    try {
      await VerificationService.verifyOtp({
        email: normalizedEmail,
        otp: String(otp).trim(),
        purpose: 'EMAIL_VERIFICATION',
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
      });

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return next(new NotFoundError('User account not found.'));
      }

      user.isVerified = true;
      await user.save();

      // Dispatch welcome email asynchronously
      EmailService.sendWelcome(user.email, user.username).catch(() => {});

      // Establish authenticated session
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = await AuthService.generateRefreshToken(user);

      const role = await Role.findOne({ name: user.roleName }).select('permissions').lean();
      const effectivePermissions = getEffectivePermissions({
        roleName: user.roleName,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions: role ? (role.permissions as string[]) : [],
      });

      res.json({
        success: true,
        message: 'Email verified successfully.',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          roleName: user.roleName,
          tenantId: user.tenantId,
          isPlatformAdmin: user.isPlatformAdmin,
          tenants: user.tenants || [],
          permissions: effectivePermissions,
          isActive: user.isActive,
          themePreference: user.themePreference,
          preferredLanguage: user.preferredLanguage,
          timeZone: user.timeZone,
          avatarUrl: user.avatarUrl,
          branchId: user.branchId,
          allowedBranches: user.allowedBranches,
        },
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/resend-verification-otp
   * Generates and dispatches a new EMAIL_VERIFICATION code subject to cooldown and rate limits.
   */
  public static async resendVerificationOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { email } = req.body;
    if (!email) {
      return next(new ValidationError('Email address is required.'));
    }

    const normalizedEmail = String(sanitizeInput(email)).toLowerCase().trim();

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        // Return generic success to prevent email enumeration
        res.json({
          success: true,
          message: 'If an account exists, a new verification code has been dispatched.',
        });
        return;
      }

      if (user.isVerified) {
        res.json({
          success: true,
          message: 'Your account is already verified. You may sign in.',
          alreadyVerified: true,
        });
        return;
      }

      const { rawOtp } = await VerificationService.createVerification({
        email: user.email,
        purpose: 'EMAIL_VERIFICATION',
        userId: user._id,
        tenantId: user.tenantId,
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
      });

      try {
        await EmailService.sendVerificationOtp(user.email, user.username, rawOtp);
      } catch (emailErr: any) {
        logger.error(
          '[AuthController.resendVerificationOtp] Email delivery failed:',
          emailErr?.message || emailErr
        );
        return next(
          new ValidationError(
            'Unable to dispatch verification email at this moment. Please try again shortly.'
          )
        );
      }

      res.json({
        success: true,
        message: 'A new verification code has been dispatched to your email.',
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, password, deviceFingerprint } = req.body;
    if (!email || !password) {
      return next(new ValidationError('Email and password are required.'));
    }

    const xForwardedFor = req.headers['x-forwarded-for'];
    const parsedForwardedIp =
      typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0].trim()
        : Array.isArray(xForwardedFor) && xForwardedFor.length > 0
          ? xForwardedFor[0].split(',')[0].trim()
          : '';
    const ipAddress = parsedForwardedIp || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    try {
      const { user, accessToken, refreshToken, sessionId } = await AuthService.authenticate(
        String(sanitizeInput(email)),
        password,
        ipAddress,
        userAgent,
        deviceFingerprint
      );

      const role = await Role.findOne({ name: user.roleName }).select('permissions').lean();
      const effectivePermissions = getEffectivePermissions({
        roleName: user.roleName,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions: role ? (role.permissions as string[]) : [],
      });

      res.json({
        accessToken,
        refreshToken,
        sessionId,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          roleName: user.roleName,
          tenantId: user.tenantId,
          isPlatformAdmin: user.isPlatformAdmin,
          tenants: user.tenants || [],
          permissions: effectivePermissions,
          isActive: user.isActive,
          themePreference: user.themePreference,
          preferredLanguage: user.preferredLanguage,
          timeZone: user.timeZone,
          avatarUrl: user.avatarUrl,
          branchId: user.branchId,
          allowedBranches: user.allowedBranches,
        },
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(new ValidationError('Refresh token is required.'));
    }

    try {
      const tokens = await AuthService.rotateRefreshToken(String(refreshToken));
      res.json(tokens);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/forgot-password
   * Dispatches a 6-digit PASSWORD_RESET OTP via Brevo.
   * Anti-enumeration safe.
   */
  public static async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { email } = req.body;
    if (!email) {
      return next(new ValidationError('Email is required.'));
    }

    const GENERIC_RESPONSE = {
      success: true,
      message: 'If an account with that email exists, a verification code has been sent.',
    };

    try {
      const normalizedEmail = String(sanitizeInput(email)).toLowerCase().trim();
      const user = await User.findOne({ email: normalizedEmail }).select(
        '_id email username failedLoginAttempts lockUntil tenantId'
      );

      if (!user) {
        res.json(GENERIC_RESPONSE);
        return;
      }

      // Generate secure OTP for PASSWORD_RESET purpose
      const { rawOtp } = await VerificationService.createVerification({
        email: user.email,
        purpose: 'PASSWORD_RESET',
        userId: user._id,
        tenantId: user.tenantId,
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
      });

      // Dispatch email via Brevo
      try {
        await EmailService.sendPasswordResetOtp(user.email, user.username, rawOtp);
        logger.info(
          `[AUTH][ForgotPassword] PASSWORD_RESET OTP email dispatched to domain [${user.email.split('@')[1]}] for user [${user._id}]`
        );
      } catch (emailErr: any) {
        // SAFE DIAGNOSTIC LOG — never logs OTP, token, API key, or password
        logger.error(
          `[AUTH][ForgotPassword] Password reset OTP email delivery failed. ` +
            `Recipient domain: [${user.email.split('@')[1]}]. ` +
            `Provider error: ${emailErr?.message || String(emailErr)}. ` +
            `User ID: [${user._id}]. ` +
            `Verification record was created successfully. ` +
            `User can request a new OTP after the cooldown period.`
        );
        // Return generic success intentionally for anti-enumeration security.
        // The OTP record exists in the database; the user can retry with "Resend Code".
      }

      res.json(GENERIC_RESPONSE);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/verify-reset-otp
   * Verifies the 6-digit PASSWORD_RESET OTP and issues a short-lived (15 min) resetToken in Redis.
   */
  public static async verifyResetOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return next(new ValidationError('Email and 6-digit verification code are required.'));
    }

    const normalizedEmail = String(sanitizeInput(email)).toLowerCase().trim();

    try {
      await VerificationService.verifyOtp({
        email: normalizedEmail,
        otp: String(otp).trim(),
        purpose: 'PASSWORD_RESET',
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
      });

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return next(new NotFoundError('User account not found.'));
      }

      // Unlock account if locked
      if (user.lockUntil || (user.failedLoginAttempts ?? 0) > 0) {
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
      }

      // Issue single-use short-lived reset authorization token stored in Redis & MongoDB
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      const redisKey = `${RESET_AUTH_TOKEN_REDIS_PREFIX}${hashedToken}`;
      const tokenExpiresAt = new Date(Date.now() + RESET_AUTH_TOKEN_TTL_SECONDS * 1000);

      // Store in Redis with TTL
      await redis
        .setex(redisKey, RESET_AUTH_TOKEN_TTL_SECONDS, user._id.toString())
        .catch((err) => {
          logger.warn('[AuthController.verifyResetOtp] Redis setex notice:', err?.message || err);
        });

      // Also persist on the verified MongoDB record for maximum ACID durability
      await Verification.findOneAndUpdate(
        { email: normalizedEmail, purpose: 'PASSWORD_RESET', verifiedAt: { $exists: true } },
        {
          $set: {
            resetTokenHash: hashedToken,
            resetTokenExpiresAt: tokenExpiresAt,
            resetTokenConsumed: false,
          },
        },
        { sort: { verifiedAt: -1 } }
      ).catch((err) => {
        logger.warn(
          '[AuthController.verifyResetOtp] MongoDB token persistence notice:',
          err?.message || err
        );
      });

      res.json({
        success: true,
        message: 'Verification successful.',
        resetToken: rawResetToken,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/reset-password
   * Consumes a verified reset authorization token, checks password policy,
   * updates password, and invalidates all active sessions for security.
   */
  public static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return next(new ValidationError('Reset token and new password are required.'));
    }

    try {
      const hashedToken = crypto.createHash('sha256').update(String(resetToken)).digest('hex');
      const redisKey = `${RESET_AUTH_TOKEN_REDIS_PREFIX}${hashedToken}`;

      // 1. Check Redis first
      let userId = await redis.get(redisKey).catch(() => null);

      // 2. Fallback to MongoDB Verification document
      if (!userId) {
        const verificationDoc = await Verification.findOne({
          resetTokenHash: hashedToken,
          resetTokenExpiresAt: { $gt: new Date() },
          resetTokenConsumed: { $ne: true },
        });
        if (verificationDoc?.userId) {
          userId = verificationDoc.userId.toString();
        }
      }

      if (!userId) {
        return next(
          new AuthenticationError('Password reset authorization is invalid or has expired.')
        );
      }

      const user = await User.findById(userId).select('+password');
      if (!user) {
        return next(new NotFoundError('Account not found.'));
      }

      // Validate new password against system password policy
      const sysConfig = await SystemConfig.findOne();
      if (sysConfig?.passwordPolicy) {
        const passError = validatePasswordStrength(newPassword, sysConfig.passwordPolicy);
        if (passError) {
          return next(new ValidationError(passError));
        }
      }

      // Update password
      user.password = newPassword;
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      // Consume the authorization token (single-use across Redis & MongoDB)
      await redis.del(redisKey).catch(() => {});
      await Verification.updateMany(
        { resetTokenHash: hashedToken },
        { $set: { resetTokenConsumed: true } }
      ).catch(() => {});

      // Invalidate all active sessions & refresh tokens across all devices
      await Session.updateMany({ userId: user._id, isActive: true }, { $set: { isActive: false } });
      await RefreshToken.updateMany(
        { userId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );

      res.json({
        success: true,
        message: 'Password updated successfully. You may now log in.',
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * POST /auth/change-password
   * Allows an authenticated user to update their password by verifying current password first.
   */
  public static async changePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(new ValidationError('Current password and new password are required.'));
    }

    if (!req.user?.id) {
      return next(new AuthenticationError('Authentication required.'));
    }

    try {
      const user = await User.findById(req.user.id).select('+password');
      if (!user) {
        return next(new NotFoundError('User account not found.'));
      }

      const isCurrentMatch = await user.comparePassword(currentPassword);
      if (!isCurrentMatch) {
        return next(new AuthenticationError('Current password is incorrect.'));
      }

      if (currentPassword === newPassword) {
        return next(new ValidationError('New password must be different from current password.'));
      }

      // Validate new password against system policy
      const sysConfig = await SystemConfig.findOne();
      if (sysConfig?.passwordPolicy) {
        const passError = validatePasswordStrength(newPassword, sysConfig.passwordPolicy);
        if (passError) {
          return next(new ValidationError(passError));
        }
      }

      user.password = newPassword;
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      // Revoke refresh tokens on password change
      await RefreshToken.updateMany(
        { userId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );

      res.json({
        success: true,
        message: 'Password changed successfully.',
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async logout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { refreshToken } = req.body;
    const sessionId = req.sessionId;

    try {
      await AuthService.logout(refreshToken || '', sessionId);
      res.json({ message: 'Logged out successfully.' });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async me(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Not authenticated.' } });
        return;
      }
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        res.status(401).json({ error: { message: 'User account not found.' } });
        return;
      }
      const role = await Role.findOne({ name: user.roleName }).select('permissions').lean();
      const effectivePermissions = getEffectivePermissions({
        roleName: user.roleName,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions: role ? (role.permissions as string[]) : [],
      });
      res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        roleName: user.roleName,
        tenantId: user.tenantId,
        isPlatformAdmin: user.isPlatformAdmin,
        tenants: user.tenants || [],
        permissions: effectivePermissions,
        isActive: user.isActive,
        themePreference: user.themePreference,
        preferredLanguage: user.preferredLanguage,
        timeZone: user.timeZone,
        avatarUrl: user.avatarUrl,
        branchId: user.branchId,
        allowedBranches: user.allowedBranches,
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
