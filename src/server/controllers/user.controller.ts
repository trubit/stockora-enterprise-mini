import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { UploadService } from '../services/upload.service.js';
import { getEffectivePermissions } from '../../shared/permissions.js';

export class UserController {
  public static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        return next(new NotFoundError('User not found.'));
      }
      const role = await Role.findOne({ name: user.roleName }).select('permissions').lean();
      const userObj = user.toObject() as unknown as Record<string, unknown>;
      userObj.permissions = getEffectivePermissions({
        roleName: user.roleName,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions: role ? (role.permissions as string[]) : [],
      });
      res.json(userObj);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { themePreference, preferredLanguage, timeZone } = req.body;
    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        return next(new NotFoundError('User not found.'));
      }

      if (themePreference) user.themePreference = themePreference;
      if (preferredLanguage) user.preferredLanguage = preferredLanguage;
      if (timeZone) user.timeZone = timeZone;

      await user.save();
      res.json(user);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async uploadAvatar(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (!req.file) {
      return next(new ValidationError('Please upload an image file.'));
    }

    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        return next(new NotFoundError('User not found.'));
      }

      const tenantId = req.tenantId || (user.tenantId ? user.tenantId.toString() : undefined);
      const avatarUrl = await UploadService.processAndSaveImage(req.file, tenantId);
      user.avatarUrl = avatarUrl;
      await user.save();

      res.json({ message: 'Avatar uploaded successfully.', avatarUrl });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async listUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query: Record<string, unknown> = {};
      if (!req.user?.isPlatformAdmin && req.tenantId) {
        query.tenantId = req.tenantId;
      }
      const users = await User.find(query).select('-password');
      res.json(users);
    } catch (err: unknown) {
      next(err);
    }
  }
}
