import mongoose from 'mongoose';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { TenantInvitation } from '../models/TenantInvitation.js';
import { TenantService } from '../services/tenant.service.js';
import { ValidationError, AuthorizationError } from '../errors/AppError.js';
import { config } from '../../config/environment.js';

export class TenantController {
  /**
   * Onboard a new company/tenant
   */
  public static async onboard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      name,
      legalName,
      businessType,
      industry,
      email,
      phone,
      address,
      currency,
      currencySymbol,
      timezone,
      branchName,
      branchCode,
    } = req.body;

    const primaryEmail = email || req.user?.email;

    if (!name || !primaryEmail) {
      return next(new ValidationError('Company name is required for onboarding.'));
    }

    try {
      const result = await TenantService.onboardTenant({
        name,
        legalName,
        businessType,
        industry,
        email: primaryEmail,
        phone,
        address,
        currency,
        currencySymbol,
        timezone,
        branchName,
        branchCode,
        userId: req.user?.id || '',
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Get currently active tenant profile
   */
  public static async getCurrentTenant(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const tenant = await TenantService.getTenantProfile(req.tenantId);
      res.json(tenant);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Update tenant company profile
   */
  public static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const updated = await TenantService.updateTenantProfile(req.tenantId, req.body, req.user?.id);
      res.json(updated);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Update tenant company branding
   */
  public static async updateBranding(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const updated = await TenantService.updateBranding(req.tenantId, req.body, req.user?.id);
      res.json(updated);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Update tenant feature flags
   */
  public static async updateFeatures(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const updated = await TenantService.updateFeatures(
        req.tenantId,
        req.body.features || req.body,
        req.user?.id
      );
      res.json(updated);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Update tenant resource limits
   */
  public static async updateLimits(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const updated = await TenantService.updateLimits(
        req.tenantId,
        req.body.limits || req.body,
        req.user?.id
      );
      res.json(updated);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Switch active company/tenant
   */
  public static async switchTenant(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { tenantId, tenantSlug } = req.body;
    const target = tenantId || tenantSlug;

    if (!target) {
      return next(
        new ValidationError('Target tenantId or tenantSlug is required to switch tenant.')
      );
    }

    try {
      const result = await TenantService.switchTenantContext(req.user?.id || '', target);
      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Get all companies the authenticated user belongs to
   */
  public static async getUserTenants(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.json([]);
        return;
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        res.json([]);
        return;
      }

      const explicitTenantIds: mongoose.Types.ObjectId[] = [];
      if (user.tenantId) {
        explicitTenantIds.push(new mongoose.Types.ObjectId(user.tenantId.toString()));
      }
      if (user.tenants && user.tenants.length > 0) {
        user.tenants.forEach((m: any) => {
          if (m.tenantId && mongoose.Types.ObjectId.isValid(m.tenantId)) {
            explicitTenantIds.push(new mongoose.Types.ObjectId(m.tenantId.toString()));
          }
        });
      }

      if (user.email) {
        const linkedCompanies = await Company.find({
          email: user.email.toLowerCase().trim(),
        })
          .select('tenantId')
          .lean();
        linkedCompanies.forEach((c) => {
          if (c.tenantId && mongoose.Types.ObjectId.isValid(c.tenantId)) {
            explicitTenantIds.push(new mongoose.Types.ObjectId(c.tenantId.toString()));
          }
        });

        const linkedInvitations = await TenantInvitation.find({
          email: user.email.toLowerCase().trim(),
          status: 'ACCEPTED',
        })
          .select('tenantId')
          .lean();
        linkedInvitations.forEach((inv) => {
          if (inv.tenantId && mongoose.Types.ObjectId.isValid(inv.tenantId)) {
            explicitTenantIds.push(new mongoose.Types.ObjectId(inv.tenantId.toString()));
          }
        });
      }

      const isPlatformAdmin = Boolean(
        user.isPlatformAdmin ||
        user.roleName === 'Super Administrator' ||
        (config.platformAdminEmail &&
          user.email &&
          user.email.toLowerCase().trim() === config.platformAdminEmail.toLowerCase().trim())
      );

      let userAccessibleTenants: any[] = [];

      if (isPlatformAdmin) {
        // Platform Administrator has global visibility across all legitimate registered companies
        userAccessibleTenants = await Tenant.find({
          status: { $ne: 'DELETED' },
        })
          .sort({ createdAt: -1 })
          .lean();
      } else {
        // Normal users & Company Owners strictly scoped to authorized memberships
        userAccessibleTenants = await Tenant.find({
          $or: [
            { _id: { $in: explicitTenantIds } },
            { ownerUserId: user._id },
            ...(user.email ? [{ 'contact.email': user.email.toLowerCase().trim() }] : []),
          ],
          status: { $ne: 'DELETED' },
        })
          .sort({ createdAt: -1 })
          .lean();
      }

      // Deduplicate and format tenant membership items
      const resultMap = new Map<string, any>();

      for (const t of userAccessibleTenants) {
        const tIdStr = t._id.toString();
        const existingMembership = user.tenants?.find(
          (m: any) => m.tenantId && m.tenantId.toString() === tIdStr
        );

        let roleName = user.roleName || 'Employee';
        if (isPlatformAdmin) {
          roleName = 'Super Administrator';
        } else if (existingMembership?.roleName) {
          roleName = existingMembership.roleName;
        } else if (
          (t.ownerUserId && t.ownerUserId.toString() === user._id.toString()) ||
          (t.contact?.email &&
            user.email &&
            t.contact.email.toLowerCase().trim() === user.email.toLowerCase().trim())
        ) {
          roleName = 'Company Owner';
        }

        resultMap.set(tIdStr, {
          tenantId: tIdStr,
          tenantSlug: t.slug,
          tenantName: t.name,
          roleName,
          status: t.status,
          isDefault: user.tenantId?.toString() === tIdStr,
          joinedAt: existingMembership?.joinedAt || t.createdAt,
        });
      }

      res.json(Array.from(resultMap.values()));
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Create employee invitation
   */
  public static async createInvitation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const rawEmail = req.body?.email;
    const rawRoleName = req.body?.roleName;
    const branchId = req.body?.branchId;

    const email = (rawEmail || '').toString().trim().toLowerCase();
    const roleName = (rawRoleName || 'Employee').toString().trim();

    if (!email) {
      return next(new ValidationError('Employee email address is required.'));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new ValidationError('Please provide a valid email address.'));
    }

    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }

      const userId = req.user?.id || (req.user as any)?._id || (req.user as any)?.userId || '';
      const requestOrigin =
        (req.get('origin') as string) ||
        (req.headers.origin as string) ||
        (req.headers.referer as string);

      const result = await TenantService.createInvitation(
        req.tenantId,
        userId,
        email,
        roleName,
        branchId,
        requestOrigin
      );

      res.status(201).json({
        success: true,
        message: `Invitation successfully sent to ${email}.`,
        invitation: result.invitation,
        token: result.token,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Validate an invitation token (Public)
   */
  public static async validateInvitation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    try {
      const result = await TenantService.validateInvitationToken(token);
      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Accept invitation and register new employee account in one step (Public)
   */
  public static async acceptAndRegister(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { token, username, password, fullName, phone } = req.body;
    try {
      const result = await TenantService.acceptInvitationAndRegister(token, {
        username,
        password,
        fullName,
        phone,
      });
      res.status(201).json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Accept an invitation (Authenticated user)
   */
  public static async acceptInvitation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { token } = req.body;
    if (!token) {
      return next(new ValidationError('Invitation token is required.'));
    }

    try {
      const result = await TenantService.acceptInvitation(token, req.user?.id || '');
      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * List invitations for current tenant
   */
  public static async listInvitations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const list = await TenantService.listInvitations(req.tenantId);
      res.json(list);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Resend an invitation
   */
  public static async resendInvitation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      const requestOrigin =
        (req.get('origin') as string) ||
        (req.headers.origin as string) ||
        (req.headers.referer as string);

      const result = await TenantService.resendInvitation(
        id,
        req.tenantId,
        req.user?.id || '',
        requestOrigin
      );
      res.json({ message: 'Invitation resent successfully.', invitation: result.invitation });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Revoke an invitation
   */
  public static async revokeInvitation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      if (!req.tenantId) {
        return next(new AuthorizationError('No active tenant context resolved.'));
      }
      await TenantService.revokeInvitation(id, req.tenantId);
      res.json({ message: 'Invitation successfully revoked.' });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Platform Admin: List all tenants
   */
  public static async adminListAllTenants(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const isPlatformAdmin = Boolean(
        req.user?.isPlatformAdmin ||
        req.user?.roleName === 'Super Administrator' ||
        (config.platformAdminEmail &&
          req.user?.email &&
          req.user.email.toLowerCase().trim() === config.platformAdminEmail.toLowerCase().trim())
      );

      if (!isPlatformAdmin) {
        return next(new AuthorizationError('Platform administrator access required.'));
      }

      const { page, limit, search, status } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        status?: string;
      };

      const result = await TenantService.listAllTenantsAdmin({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        status: status ? String(status) : undefined,
      });

      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Platform Admin: Update tenant status
   */
  public static async adminUpdateTenantStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status } = req.body;
    try {
      if (!req.user?.isPlatformAdmin && req.user?.roleName !== 'Super Administrator') {
        return next(new AuthorizationError('Platform administrator access required.'));
      }
      const updated = await TenantService.updateTenantStatusAdmin(id, status, req.user?.id || '');
      res.json(updated);
    } catch (err: unknown) {
      next(err);
    }
  }
}
