import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Session } from '../models/Session.js';
import { SystemConfig, type IPasswordPolicy } from '../models/SystemConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import { AuthenticationError } from '../errors/AppError.js';
import { config } from '../../config/environment.js';
import crypto from 'crypto';

export function validatePasswordStrength(password: string, policy: IPasswordPolicy): string | null {
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters long.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

export class AuthService {
  public static generateAccessToken(user: IUser, sessionToken?: string): string {
    return jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        roleName: user.roleName,
        tenantId: user.tenantId ? user.tenantId.toString() : undefined,
        isPlatformAdmin: user.isPlatformAdmin,
        branchId: user.branchId,
        allowedBranches: user.allowedBranches,
        tenants: user.tenants
          ? user.tenants.map((t) => ({
              tenantId: t.tenantId.toString(),
              tenantSlug: t.tenantSlug,
              tenantName: t.tenantName,
              roleName: t.roleName,
              branchId: t.branchId,
              allowedBranches: t.allowedBranches,
              isDefault: t.isDefault,
            }))
          : [],
        sessionToken, // Hashed version signed in JWT payload to identify DB Session
      },
      config.jwtSecret,
      {
        expiresIn: '30m',
        issuer: 'stockora-enterprise-mini',
        audience: 'stockora-enterprise-mini',
      }
    );
  }

  public static async generateRefreshToken(user: IUser): Promise<string> {
    const tokenStr = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      token: tokenStr,
      expiresAt,
    });

    return tokenStr;
  }

  public static async authenticate(
    email: string,
    password: string,
    ipAddress = '127.0.0.1',
    userAgent = 'Unknown',
    deviceFingerprint?: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string; sessionId: string }> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw new AuthenticationError('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account has been deactivated. Please contact support.');
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const diffMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new AuthenticationError(
        `Account locked due to multiple login failures. Try again in ${diffMinutes} minutes.`
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        user.failedLoginAttempts = 0;
      }
      await user.save();

      // Log failed authentication attempt
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        targetModel: 'User',
        targetId: user._id.toString(),
        ipAddress,
        userAgent,
        newValues: { email, reason: 'Incorrect password' },
      });

      throw new AuthenticationError('Invalid email or password.');
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // 1. Fetch system configuration settings (session controls, password policies)
    let sysConfig = await SystemConfig.findOne();
    if (!sysConfig) {
      sysConfig = await SystemConfig.create({
        maintenanceMode: false,
        featureFlags: new Map([
          ['loyaltyProgram', true],
          ['offlinePOS', true],
          ['returns exchanges', true],
        ]),
        allowedIPs: [],
        deniedIPs: [],
        maxConcurrentSessions: 3,
        sessionTimeoutMinutes: 60,
      });
    }

    // 2. Concurrent Session Enforcement (invalidate oldest sessions if limit exceeded)
    //    We expire sessions that are already past their expiry first, then enforce the cap.
    const now = new Date();
    // Clean up expired sessions silently before counting
    await Session.updateMany(
      { userId: user._id, isActive: true, expiresAt: { $lt: now } },
      { $set: { isActive: false } }
    );

    const activeSessions = await Session.find({ userId: user._id, isActive: true }).sort({
      lastSeenAt: 1,
    });
    const maxSessions = sysConfig.maxConcurrentSessions || 3;
    // Only terminate oldest sessions when we are already AT the limit (not +1 over)
    if (activeSessions.length >= maxSessions) {
      const overage = activeSessions.length - maxSessions + 1;
      for (let i = 0; i < overage; i++) {
        const oldestSession = activeSessions[i];
        oldestSession.isActive = false;
        await oldestSession.save();

        // Audit log the concurrent session invalidation
        await AuditLog.create({
          userId: user._id,
          action: 'SESSION_TERMINATED_CONCURRENT',
          targetModel: 'Session',
          targetId: oldestSession._id.toString(),
          ipAddress: oldestSession.ipAddress,
          userAgent: oldestSession.userAgent,
          sessionId: oldestSession._id.toString(),
        });
      }
    }

    // 3. Create active session record in DB
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const hashedSessionToken = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
    const timeoutMin = sysConfig.sessionTimeoutMinutes || 60;
    const expiresAt = new Date(Date.now() + timeoutMin * 60 * 1000);

    const session = await Session.create({
      userId: user._id,
      sessionToken: hashedSessionToken,
      ipAddress,
      userAgent,
      deviceFingerprint,
      isActive: true,
      expiresAt,
    });

    const accessToken = this.generateAccessToken(user, hashedSessionToken);
    const refreshToken = await this.generateRefreshToken(user);

    // Audit log successful authentication
    await AuditLog.create({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      targetModel: 'User',
      targetId: user._id.toString(),
      ipAddress,
      userAgent,
      sessionId: session._id.toString(),
    });

    return { user, accessToken, refreshToken, sessionId: session._id.toString() };
  }

  public static async rotateRefreshToken(
    tokenStr: string
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    if (!tokenStr || typeof tokenStr !== 'string') {
      throw new AuthenticationError('Refresh token is required.');
    }

    const cleanToken = tokenStr.trim();
    const newRefreshTokenCandidate = crypto.randomBytes(40).toString('hex');
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 1. Atomically claim and revoke the active refresh token
    const activeToken = await RefreshToken.findOneAndUpdate(
      {
        token: cleanToken,
        revokedAt: { $exists: false },
        expiresAt: { $gt: now },
      },
      {
        $set: {
          revokedAt: now,
          replacedByToken: newRefreshTokenCandidate,
        },
      },
      { new: false }
    );

    let targetUserId: any;
    let resolvedRefreshTokenStr: string;

    if (activeToken) {
      targetUserId = activeToken.userId;
      await RefreshToken.create({
        userId: targetUserId,
        token: newRefreshTokenCandidate,
        expiresAt,
      });

      resolvedRefreshTokenStr = newRefreshTokenCandidate;
    } else {
      // 2. Concurrency / Race-Condition Grace Period (30 seconds):
      // If multiple API requests receive 401 simultaneously upon access token expiration,
      // they may all present the initial refresh token within a few seconds of each other.
      const gracePeriodCutoff = new Date(Date.now() - 30 * 1000);
      const recentlyRotated = await RefreshToken.findOne({
        token: cleanToken,
        revokedAt: { $gte: gracePeriodCutoff },
        replacedByToken: { $exists: true },
      });

      if (recentlyRotated && recentlyRotated.replacedByToken) {
        // Token was rotated within the last 30s.
        const { logger } = await import('../logger.js');
        logger.info(
          `[AuthService.rotateRefreshToken] Concurrent refresh race detected. Returning replacement token within grace period for user ${recentlyRotated.userId}`
        );
        targetUserId = recentlyRotated.userId;
        resolvedRefreshTokenStr = recentlyRotated.replacedByToken;
      } else {
        // Token was revoked outside grace period — potential replay attempt
        const oldRevoked = await RefreshToken.findOne({ token: cleanToken });
        if (oldRevoked) {
          const { logger } = await import('../logger.js');
          logger.warn(
            `[AuthService.rotateRefreshToken] Refresh token reuse attempt detected for revoked token (revoked at: ${oldRevoked.revokedAt})`
          );
        }
        throw new AuthenticationError('Session expired or invalid. Please log in again.');
      }
    }

    const user = await User.findById(targetUserId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('Account is deactivated or not found.');
    }

    // Maintain active DB session if available
    let sessionTokenToEmbed: string | undefined;
    const activeSession = await Session.findOne({
      userId: user._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastSeenAt: -1 });

    if (activeSession) {
      activeSession.lastSeenAt = new Date();
      activeSession.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await activeSession.save();
      sessionTokenToEmbed = activeSession.sessionToken;
    }

    const newAccessToken = this.generateAccessToken(user, sessionTokenToEmbed);

    const { Role } = await import('../models/Role.js');
    const { getEffectivePermissions } = await import('../../shared/permissions.js');

    const role = await Role.findOne({ name: user.roleName }).select('permissions').lean();
    const effectivePermissions = getEffectivePermissions({
      roleName: user.roleName,
      isPlatformAdmin: user.isPlatformAdmin,
      permissions: role ? (role.permissions as string[]) : [],
    });

    const safeUser = {
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
    };

    return {
      accessToken: newAccessToken,
      refreshToken: resolvedRefreshTokenStr,
      user: safeUser,
    };
  }

  /**
   * logout: Revokes the active refresh token and marks the current session inactive.
   * Called when the user explicitly logs out from the client.
   */
  public static async logout(refreshTokenStr: string, sessionId?: string): Promise<void> {
    // 1. Revoke the refresh token
    if (refreshTokenStr) {
      await RefreshToken.updateOne(
        { token: refreshTokenStr, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
    }
    // 2. Inactivate the DB session
    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, { $set: { isActive: false } });
    }
  }

  public static async revokeToken(tokenStr: string): Promise<void> {
    const token = await RefreshToken.findOne({ token: tokenStr });
    if (token) {
      token.revokedAt = new Date();
      await token.save();
    }
  }

  /**
   * Hard-logout a user across all active sessions/devices.
   */
  public static async forceLogoutUser(userId: string, adminUserId: string): Promise<void> {
    // 1. Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );

    // 2. Inactivate all active Sessions
    const activeSessions = await Session.find({ userId, isActive: true });
    for (const session of activeSessions) {
      session.isActive = false;
      await session.save();

      // Log audit trail for each session force closed
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(adminUserId),
        action: 'FORCE_LOGOUT_SESSION',
        targetModel: 'Session',
        targetId: session._id.toString(),
        newValues: { userId },
      });
    }
  }
}
