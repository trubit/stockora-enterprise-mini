import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { Session } from '../models/Session.js';
import { AuthenticationError } from '../errors/AppError.js';
import { logger } from '../logger.js';

/**
 * sessionGuard
 * Additional security validation middleware.
 * Verifies the current request session exists and is active.
 * IP/UA changes are logged as risk signals but do NOT terminate the session,
 * because legitimate network changes (WiFi handover, VPN, proxy, dev server)
 * would otherwise cause repeated login failures.
 */
export async function sessionGuard(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required.'));
  }

  if (!req.sessionId) {
    // No session token bound to this JWT — allow through (register/public tokens)
    return next();
  }

  try {
    const session = await Session.findById(req.sessionId);
    if (!session || !session.isActive) {
      return next(new AuthenticationError('Session is invalid or has been logged out.'));
    }

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await session.save();
      return next(new AuthenticationError('Session expired. Please log in again.'));
    }

    // Risk-flag IP or User Agent changes without destroying the session.
    // Legitimate reasons for changes: network switch, VPN, CDN proxy, dev reverse-proxy.
    const xForwardedFor = req.headers['x-forwarded-for'];
    const parsedForwardedIp =
      typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0].trim()
        : Array.isArray(xForwardedFor) && xForwardedFor.length > 0
          ? xForwardedFor[0].split(',')[0].trim()
          : '';
    const currentIp = req.ipAddress || parsedForwardedIp || req.socket.remoteAddress || '';
    const currentUserAgent = req.headers['user-agent'] || '';

    if (session.ipAddress !== currentIp) {
      logger.warn(
        `[SessionGuard] IP change detected for session ${session._id}: ${session.ipAddress} → ${currentIp}. Session maintained.`
      );
    }
    if (session.userAgent !== currentUserAgent) {
      logger.warn(
        `[SessionGuard] UserAgent change detected for session ${session._id}. Session maintained.`
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}
