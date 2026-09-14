import crypto from 'crypto';
import os from 'os';
import mongoose from 'mongoose';
import { Tenant, type ITenant, type TenantStatus, type ITenantLimits } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { Branch } from '../models/Branch.js';
import { MasterData } from '../models/MasterData.js';
import { User } from '../models/User.js';
import { TenantInvitation } from '../models/TenantInvitation.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { POSTerminal } from '../models/POSTerminal.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
} from '../errors/AppError.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { PasswordService } from './password.service.js';
import { VerificationService } from './verification.service.js';
import { memoryCache } from '../utils/cache.js';
import { Plan } from '../models/Plan.js';
import { BillingService } from './billing.service.js';
import { SubscriptionService } from './subscription.service.js';
import { config } from '../../config/environment.js';
import { logger } from '../logger.js';

export interface OnboardTenantInput {
  name: string;
  legalName?: string;
  businessType?: string;
  industry?: string;
  email: string;
  phone?: string;
  address?: string;
  currency?: string;
  currencySymbol?: string;
  timezone?: string;
  branchName?: string;
  branchCode?: string;
  userId: string;
}

export class TenantService {
  /**
   * Generates a unique, URL-safe slug for a company
   */
  public static async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!baseSlug || baseSlug.length < 2) {
      baseSlug = 'company';
    }

    let slug = baseSlug;
    let counter = 1;
    while (await Tenant.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Onboards a brand new tenant with company, first branch, and default configuration
   */
  public static async onboardTenant(
    input: OnboardTenantInput
  ): Promise<{ tenant: ITenant; token: string }> {
    const {
      name,
      legalName,
      businessType = 'Retail',
      industry,
      email,
      phone,
      address,
      currency = 'USD',
      currencySymbol = '$',
      timezone = 'UTC',
      branchName = 'Main Branch',
      branchCode = 'MAIN',
      userId,
    } = input;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    const existingTenant = user.tenantId ? await Tenant.findById(user.tenantId) : null;
    let tenant: ITenant;

    if (existingTenant && !existingTenant.onboardingCompleted) {
      existingTenant.name = name;
      existingTenant.legalName = legalName || name;
      existingTenant.slug = await this.generateUniqueSlug(name);
      existingTenant.status = 'ACTIVE';
      existingTenant.businessType = businessType;
      existingTenant.industry = industry;
      existingTenant.contact = {
        email: email || user.email,
        phone,
        addressLine1: address,
      };
      existingTenant.fiscalConfig = {
        currency: currency.toUpperCase(),
        currencySymbol,
        timezone,
        locale: 'en-US',
      };
      existingTenant.onboardingCompleted = true;
      existingTenant.onboardingStep = 8;
      existingTenant.ownerUserId = user._id;
      tenant = await existingTenant.save();
    } else {
      const slug = await this.generateUniqueSlug(name);

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

      tenant = await Tenant.create({
        name,
        legalName: legalName || name,
        slug,
        status: 'ACTIVE',
        businessType,
        industry,
        contact: {
          email: email || user.email,
          phone,
          addressLine1: address,
        },
        fiscalConfig: {
          currency: currency.toUpperCase(),
          currencySymbol,
          timezone,
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
        onboardingCompleted: true,
        onboardingStep: 8,
        ownerUserId: user._id,
      });

      if (freePlan) {
        try {
          const initialSub = await SubscriptionService.createSubscription({
            tenantId: tenant._id.toString(),
            planId: freePlan._id.toString(),
            billingInterval: 'MONTHLY',
            isTrial: false,
          });
          tenant.subscriptionReference = initialSub._id.toString();
          await tenant.save();
        } catch {
          // Non-fatal
        }
      }
    }

    const slug = tenant.slug;
    const tenantIdStr = tenant._id.toString();

    // 2. Create Company entity linked to tenant
    const company = await Company.create({
      tenantId: tenant._id,
      name,
      legalName: legalName || name,
      slug,
      email: email || user.email,
      phone,
      address,
      currency: currency.toUpperCase(),
      timeZone: timezone,
      businessType,
      industry,
    });

    // 3. Create First Branch
    const branch = await Branch.create({
      tenantId: tenant._id,
      companyId: company._id,
      name: branchName,
      code: branchCode.toUpperCase(),
      phone,
      address,
      timezone,
      managerId: user._id,
      isActive: true,
    });

    // 4. Create Initial Warehouse for Branch
    await Warehouse.create({
      tenantId: tenantIdStr,
      companyId: company._id,
      branchId: branch._id,
      name: `${branchName} Warehouse`,
      code: `${branchCode.toUpperCase()}-WH`,
      warehouseType: 'MAIN',
      timezone,
      isActive: true,
    });

    // 5. Seed default MasterData for tenant safely
    const defaultMasterCategories = [
      'General',
      'Electronics',
      'Apparel',
      'Food & Beverage',
      'Services',
    ];
    for (const cat of defaultMasterCategories) {
      const catCode = cat.toUpperCase().replace(/\s+/g, '_');
      await MasterData.findOneAndUpdate(
        { type: 'CATEGORY', code: catCode },
        { type: 'CATEGORY', name: cat, code: catCode, value: cat },
        { upsert: true }
      );
    }

    // 6. Update user's tenant memberships
    const userRole = user.isPlatformAdmin ? user.roleName : 'Company Owner';
    user.tenantId = tenant._id;
    user.branchId = branch._id.toString();
    user.roleName = userRole;

    if (!user.tenants) {
      user.tenants = [];
    }

    // Add or update tenant in user's tenant array
    const existingMembershipIndex = user.tenants.findIndex(
      (t: any) => t.tenantId && t.tenantId.toString() === tenantIdStr
    );

    if (existingMembershipIndex >= 0) {
      user.tenants[existingMembershipIndex].isDefault = true;
      user.tenants[existingMembershipIndex].roleName = userRole;
      user.tenants[existingMembershipIndex].tenantSlug = slug;
      user.tenants[existingMembershipIndex].tenantName = name;
    } else {
      user.tenants.push({
        tenantId: tenant._id,
        tenantSlug: slug,
        tenantName: name,
        roleName: userRole,
        branchId: branch._id.toString(),
        allowedBranches: [branch._id.toString()],
        isDefault: true,
        joinedAt: new Date(),
      });
    }

    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'TENANT_ONBOARDED',
      targetModel: 'Tenant',
      targetId: tenantIdStr,
      newValues: { tenantName: name, slug, branchName },
    });

    const refreshedToken = AuthService.generateAccessToken(user);

    return { tenant, token: refreshedToken };
  }

  /**
   * Retrieves active tenant profile
   */
  public static async getTenantProfile(tenantId: string): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Company profile not found.');
    }
    return tenant;
  }

  /**
   * Updates company profile & contact info
   */
  public static async updateTenantProfile(
    tenantId: string,
    updates: Partial<ITenant>,
    userId?: string
  ): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    const prevObj = tenant.toObject();

    if (updates.name) tenant.name = updates.name.trim();
    if (updates.legalName !== undefined) tenant.legalName = updates.legalName;
    if (updates.businessType) tenant.businessType = updates.businessType;
    if (updates.industry !== undefined) tenant.industry = updates.industry;
    if (updates.logoUrl !== undefined) tenant.logoUrl = updates.logoUrl;

    if (updates.contact) {
      tenant.contact = { ...tenant.contact, ...updates.contact };
    }

    if (updates.fiscalConfig) {
      tenant.fiscalConfig = { ...tenant.fiscalConfig, ...updates.fiscalConfig };
    }

    if (updates.taxConfig) {
      tenant.taxConfig = { ...tenant.taxConfig, ...updates.taxConfig };
    }

    await tenant.save();

    // Also synchronize Company model
    await Company.findOneAndUpdate(
      { tenantId: tenant._id },
      {
        name: tenant.name,
        legalName: tenant.legalName,
        email: tenant.contact?.email,
        phone: tenant.contact?.phone,
        currency: tenant.fiscalConfig?.currency,
        timeZone: tenant.fiscalConfig?.timezone,
        logoUrl: tenant.logoUrl,
        businessType: tenant.businessType,
        industry: tenant.industry,
      },
      { upsert: true }
    );

    await AuditLog.create({
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      action: 'UPDATE_TENANT_PROFILE',
      targetModel: 'Tenant',
      targetId: tenantId,
      previousValues: prevObj,
      newValues: tenant.toObject(),
    });

    return tenant;
  }

  /**
   * Updates branding details (colors, logos, receipt/invoice layouts)
   */
  public static async updateBranding(
    tenantId: string,
    branding: Partial<ITenant['branding']>,
    userId?: string
  ): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    tenant.branding = {
      ...tenant.branding,
      ...branding,
    };

    if (branding.logoUrl) {
      tenant.logoUrl = branding.logoUrl;
    }

    await tenant.save();

    try {
      await AuditLog.create({
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        action: 'UPDATE_TENANT_BRANDING',
        targetModel: 'Tenant',
        targetId: tenantId,
        newValues: new Map(Object.entries(JSON.parse(JSON.stringify(tenant.branding || {})))),
      });
    } catch {
      // Non-fatal
    }

    return tenant;
  }

  /**
   * Updates tenant feature flags
   */
  public static async updateFeatures(
    tenantId: string,
    features: Record<string, boolean>,
    userId?: string
  ): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    const currentMap = tenant.features instanceof Map ? tenant.features : new Map();
    for (const [key, val] of Object.entries(features)) {
      currentMap.set(key, Boolean(val));
    }
    tenant.features = currentMap;

    await tenant.save();

    try {
      await AuditLog.create({
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        action: 'UPDATE_TENANT_FEATURES',
        targetModel: 'Tenant',
        targetId: tenantId,
      });
    } catch {
      // Non-fatal
    }

    return tenant;
  }

  /**
   * Updates tenant resource limits
   */
  public static async updateLimits(
    tenantId: string,
    limits: Partial<ITenantLimits>,
    userId?: string
  ): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    tenant.limits = {
      ...tenant.limits,
      ...limits,
    };

    await tenant.save();

    try {
      await AuditLog.create({
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        action: 'UPDATE_TENANT_LIMITS',
        targetModel: 'Tenant',
        targetId: tenantId,
        newValues: new Map(Object.entries(JSON.parse(JSON.stringify(tenant.limits || {})))),
      });
    } catch {
      // Non-fatal
    }

    return tenant;
  }

  /**
   * Switches user's active tenant context and returns a refreshed token
   */
  public static async switchTenantContext(
    userId: string,
    targetTenantIdOrSlug: string
  ): Promise<{ token: string; user: InstanceType<typeof User>; activeTenant: ITenant }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    let targetTenant: ITenant | null = null;
    if (mongoose.Types.ObjectId.isValid(targetTenantIdOrSlug)) {
      targetTenant = await Tenant.findById(targetTenantIdOrSlug);
    }
    if (!targetTenant) {
      targetTenant = await Tenant.findOne({ slug: targetTenantIdOrSlug.toLowerCase().trim() });
    }

    if (!targetTenant) {
      throw new NotFoundError('Requested company was not found.');
    }

    const targetTenantIdStr = targetTenant._id.toString();

    // Verify authorized membership unless platform admin or Super Administrator
    const isSuperAdmin = Boolean(
      user.isPlatformAdmin ||
      user.roleName === 'Super Administrator' ||
      (config.platformAdminEmail &&
        user.email &&
        user.email.toLowerCase().trim() === config.platformAdminEmail.toLowerCase().trim())
    );

    let isAuthorized = isSuperAdmin;
    let isOwner = false;

    if (!isAuthorized) {
      // 1. Direct owner check via ownerUserId
      if (targetTenant.ownerUserId && targetTenant.ownerUserId.toString() === user._id.toString()) {
        isAuthorized = true;
        isOwner = true;
      }

      // 2. Primary tenant check
      if (!isAuthorized && user.tenantId && user.tenantId.toString() === targetTenantIdStr) {
        isAuthorized = true;
      }

      // 3. Explicit membership array check (by ID or Slug)
      if (!isAuthorized && user.tenants && user.tenants.length > 0) {
        const memberMatch = user.tenants.some(
          (t: any) =>
            (t.tenantId && t.tenantId.toString() === targetTenantIdStr) ||
            (t.tenantSlug &&
              t.tenantSlug.toLowerCase().trim() === targetTenant.slug.toLowerCase().trim())
        );
        if (memberMatch) {
          isAuthorized = true;
        }
      }

      // 4. Contact email match for company owner
      if (!isAuthorized && targetTenant.contact?.email && user.email) {
        if (targetTenant.contact.email.toLowerCase().trim() === user.email.toLowerCase().trim()) {
          isAuthorized = true;
          isOwner = true;
        }
      }

      // 5. Company entity owner/email association
      if (!isAuthorized && user.email) {
        const linkedCompany = await Company.findOne({
          tenantId: targetTenant._id,
          email: user.email.toLowerCase().trim(),
        });
        if (linkedCompany) {
          isAuthorized = true;
          isOwner = true;
        }
      }

      // 6. Accepted invitation check
      if (!isAuthorized && user.email) {
        const linkedInv = await TenantInvitation.findOne({
          tenantId: targetTenant._id,
          email: user.email.toLowerCase().trim(),
          status: 'ACCEPTED',
        });
        if (linkedInv) {
          isAuthorized = true;
        }
      }

      // 7. Initial tenant association fallback for unassigned user
      if (!isAuthorized && !user.tenantId && (!user.tenants || user.tenants.length === 0)) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new AuthorizationError('You do not have authorization to access this company.');
      }
    }

    if (
      !isSuperAdmin &&
      (targetTenant.status === 'SUSPENDED' || targetTenant.status === 'CANCELLED')
    ) {
      throw new AuthorizationError('This company account is inactive or suspended.');
    }

    // Update user's active tenantId
    user.tenantId = targetTenant._id;

    if (!user.tenants) {
      user.tenants = [];
    }

    // Determine role in target tenant and update membership
    let targetRole = user.roleName || 'Employee';
    let targetBranchId = user.branchId;

    if (isSuperAdmin) {
      targetRole = 'Super Administrator';
      user.isPlatformAdmin = true;
    } else {
      const existingMembership = user.tenants.find(
        (t: any) =>
          (t.tenantId && t.tenantId.toString() === targetTenantIdStr) ||
          (t.tenantSlug &&
            t.tenantSlug.toLowerCase().trim() === targetTenant.slug.toLowerCase().trim())
      );

      if (existingMembership?.roleName) {
        targetRole = existingMembership.roleName;
        targetBranchId = existingMembership.branchId || targetBranchId;
      } else if (isOwner) {
        targetRole = 'Company Owner';
      }
    }

    user.roleName = targetRole;
    if (targetBranchId) {
      user.branchId = targetBranchId;
    }

    // Ensure membership exists and is up-to-date in user.tenants
    const membershipIndex = user.tenants.findIndex(
      (t: any) =>
        (t.tenantId && t.tenantId.toString() === targetTenantIdStr) ||
        (t.tenantSlug &&
          t.tenantSlug.toLowerCase().trim() === targetTenant.slug.toLowerCase().trim())
    );

    if (membershipIndex >= 0) {
      user.tenants[membershipIndex].tenantId = targetTenant._id;
      user.tenants[membershipIndex].tenantSlug = targetTenant.slug;
      user.tenants[membershipIndex].tenantName = targetTenant.name;
      user.tenants[membershipIndex].roleName = targetRole;
      user.tenants[membershipIndex].isDefault = true;
    } else {
      user.tenants.push({
        tenantId: targetTenant._id,
        tenantSlug: targetTenant.slug,
        tenantName: targetTenant.name,
        roleName: targetRole,
        isDefault: true,
        joinedAt: new Date(),
      });
    }

    // Mark non-target memberships as not default
    user.tenants.forEach((t: any) => {
      if (t.tenantId && t.tenantId.toString() !== targetTenantIdStr) {
        t.isDefault = false;
      }
    });

    // If tenant didn't have ownerUserId recorded and this user is owner, record it
    if (!targetTenant.ownerUserId && isOwner) {
      targetTenant.ownerUserId = user._id;
      await targetTenant.save();
    }

    await user.save();

    // Invalidate cached tenant context in memoryCache
    memoryCache.delete(`tenant_ctx:${userId}:${targetTenantIdStr}`);
    memoryCache.delete(`tenant_ctx:${userId}:${targetTenant.slug}`);
    memoryCache.delete(`tenant_ctx:${userId}:default`);

    const token = AuthService.generateAccessToken(user);

    return { token, user, activeTenant: targetTenant };
  }

  /**
   * Hashes an invitation bearer token with HMAC-SHA256
   */
  public static hashInvitationToken(token: string): string {
    return crypto
      .createHmac('sha256', config.jwtSecret || 'stockora-invitation-salt')
      .update(`INVITATION:${token.trim()}`)
      .digest('hex');
  }

  /**
   * Helper to retrieve the active local LAN IPv4 address (e.g. 192.168.x.x, 10.x.x.x)
   */
  public static getLocalLanIp(): string | null {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal && iface.address) {
            return iface.address;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Centralized environment-aware invitation URL generator.
   */
  public static constructInvitationUrl(rawToken: string, origin?: string): string {
    let baseUrl = '';

    if (config.isProduction) {
      baseUrl = (config.publicFrontendUrl || config.frontendUrl || config.appUrl || '').trim();
      if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        logger.error('[Invitation] Missing or invalid production PUBLIC_FRONTEND_URL config.');
      }
    } else {
      // 1. Explicitly configured PUBLIC_FRONTEND_URL / FRONTEND_URL takes top priority
      const configuredPublicUrl = (config.publicFrontendUrl || config.frontendUrl || '').trim();
      if (
        configuredPublicUrl &&
        !configuredPublicUrl.includes('localhost') &&
        !configuredPublicUrl.includes('127.0.0.1')
      ) {
        baseUrl = configuredPublicUrl;
      } else if (
        origin &&
        typeof origin === 'string' &&
        (origin.startsWith('http://') || origin.startsWith('https://')) &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1')
      ) {
        // 2. Client is already accessing via a LAN IP or domain (e.g. http://192.168.1.x:3000)
        try {
          const parsed = new URL(origin);
          baseUrl = `${parsed.protocol}//${parsed.host}`;
        } catch {
          baseUrl = origin;
        }
      } else {
        // 3. Fallback for laptop admin accessing from localhost/127.0.0.1:
        // Automatically determine local LAN IP so mobile phones on the Wi-Fi can open the invitation!
        const lanIp = this.getLocalLanIp();
        let port = '3050';
        if (origin) {
          try {
            const parsed = new URL(origin);
            if (parsed.port) port = parsed.port;
          } catch {
            // ignore
          }
        }
        if (lanIp) {
          baseUrl = `http://${lanIp}:${port}`;
        } else {
          baseUrl = (
            config.publicFrontendUrl ||
            config.frontendUrl ||
            config.appUrl ||
            'http://localhost:3050'
          ).trim();
        }
      }
    }

    const cleanBase = (baseUrl || 'http://localhost:3050').replace(/\/+$/, '');
    return `${cleanBase}/invitations/accept/${rawToken}`;
  }

  /**
   * Invites an employee to join a tenant via a secure clickable link
   */
  public static async createInvitation(
    tenantId: string,
    invitedByUserId: string,
    email: string,
    roleName: string,
    branchId?: string,
    origin?: string
  ): Promise<{ invitation: InstanceType<typeof TenantInvitation>; token: string }> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    const normalizedEmail = (email || '').toString().toLowerCase().trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ValidationError('A valid employee email address is required.');
    }

    // Invalidate previous pending invitations for this email & tenant
    await TenantInvitation.updateMany(
      {
        tenantId: tenant._id,
        email: normalizedEmail,
        status: 'PENDING',
      },
      { $set: { status: 'REVOKED' } }
    );

    let inviter: any = null;
    if (invitedByUserId && mongoose.Types.ObjectId.isValid(invitedByUserId)) {
      inviter = await User.findById(invitedByUserId).select('username email');
    }
    const inviterName = inviter?.username || 'Your Workspace Admin';
    const safeInvitedBy =
      inviter?._id ||
      (tenant.ownerUserId
        ? new mongoose.Types.ObjectId(tenant.ownerUserId.toString())
        : new mongoose.Types.ObjectId());

    // 1. Generate 256-bit cryptographically secure random token (64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashInvitationToken(rawToken);

    // 2. Set expiration (72 hours / 3 days)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const safeBranchId =
      branchId && mongoose.Types.ObjectId.isValid(branchId)
        ? new mongoose.Types.ObjectId(branchId)
        : undefined;

    // 3. Persist invitation record with tokenHash only (never store raw token in DB)
    const invitation = await TenantInvitation.create({
      tenantId: tenant._id,
      email: normalizedEmail,
      roleName: roleName || 'Employee',
      branchId: safeBranchId,
      tokenHash,
      status: 'PENDING',
      expiresAt,
      invitedBy: safeInvitedBy,
    });

    // 4. Construct secure frontend invitation link
    const inviteUrl = this.constructInvitationUrl(rawToken, origin);

    // 5. Dispatch real professional email through Brevo
    EmailService.sendEmployeeInvitationLink(
      normalizedEmail,
      inviterName,
      tenant.name,
      roleName || 'Employee',
      inviteUrl,
      72
    ).catch((err) => {
      console.warn('[TenantService] Failed to dispatch invitation email via Brevo:', err);
    });

    return { invitation, token: rawToken };
  }

  /**
   * Validates an invitation link token and returns safe public metadata
   */
  public static async validateInvitationToken(rawToken: string): Promise<{
    status: 'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'REVOKED' | 'INVALID';
    message: string;
    invitation?: {
      email: string;
      roleName: string;
      companyName: string;
      companySlug: string;
      branchName?: string;
      expiresAt: Date;
    };
  }> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 8) {
      return { status: 'INVALID', message: 'This invitation link is invalid.' };
    }

    const tokenHash = this.hashInvitationToken(rawToken);
    const invitation = await TenantInvitation.findOne({
      $or: [{ tokenHash }, { token: rawToken.trim() }],
    });

    if (!invitation) {
      return { status: 'INVALID', message: 'This invitation link is invalid.' };
    }

    if (invitation.status === 'REVOKED') {
      return { status: 'REVOKED', message: 'This invitation is no longer available.' };
    }

    if (invitation.status === 'ACCEPTED') {
      return { status: 'ALREADY_USED', message: 'This invitation has already been used.' };
    }

    if (invitation.expiresAt < new Date()) {
      if (invitation.status === 'PENDING') {
        invitation.status = 'EXPIRED';
        await invitation.save().catch(() => {});
      }
      return { status: 'EXPIRED', message: 'This invitation has expired.' };
    }

    if (invitation.status !== 'PENDING') {
      return { status: 'INVALID', message: 'This invitation link is invalid.' };
    }

    const tenant = await Tenant.findById(invitation.tenantId).select('name slug');
    let branchName = 'Main Branch';
    if (invitation.branchId) {
      const branch = await Branch.findById(invitation.branchId).select('name');
      if (branch) branchName = branch.name;
    }

    return {
      status: 'VALID',
      message: "Invitation valid. Let's get your account set up.",
      invitation: {
        email: invitation.email,
        roleName: invitation.roleName,
        companyName: tenant?.name || 'Stockora Enterprise Workspace',
        companySlug: tenant?.slug || '',
        branchName,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  /**
   * Accepts an invitation and adds tenant membership to authenticated user
   */
  public static async acceptInvitation(
    rawToken: string,
    userId: string
  ): Promise<{ tenant: ITenant; token: string; user?: any }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ValidationError('Invitation token is required.');
    }

    const tokenHash = this.hashInvitationToken(rawToken);
    const invitation = await TenantInvitation.findOne({
      $or: [{ tokenHash }, { token: rawToken.trim() }],
    });

    if (!invitation) {
      throw new NotFoundError('Invalid invitation link.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ValidationError('This invitation has already been used.');
    }

    if (invitation.status === 'REVOKED') {
      throw new ValidationError('This invitation is no longer available.');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'EXPIRED';
      await invitation.save();
      throw new ValidationError('This invitation has expired.');
    }

    if (invitation.status !== 'PENDING') {
      throw new ValidationError('This invitation is no longer valid.');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    // Wrong Email Protection
    if (user.email && user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
      throw new AuthorizationError(
        `This invitation was issued to ${invitation.email}. You are currently signed in as ${user.email}.`
      );
    }

    const tenant = await Tenant.findById(invitation.tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant company no longer exists.');
    }

    // Atomic update on invitation to prevent race conditions & double acceptance
    const updatedInv = await TenantInvitation.findOneAndUpdate(
      {
        _id: invitation._id,
        status: 'PENDING',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedInv) {
      throw new ValidationError('This invitation has already been used or expired.');
    }

    // Add or update tenant membership on user with strictly assigned server role
    const tenantIdStr = tenant._id.toString();
    if (!user.tenants) {
      user.tenants = [];
    }

    const existingIndex = user.tenants.findIndex(
      (t: any) => t.tenantId && t.tenantId.toString() === tenantIdStr
    );

    if (existingIndex >= 0) {
      user.tenants[existingIndex].roleName = invitation.roleName;
      if (invitation.branchId) {
        user.tenants[existingIndex].branchId = invitation.branchId.toString();
      }
    } else {
      user.tenants.push({
        tenantId: tenant._id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        roleName: invitation.roleName,
        branchId: invitation.branchId ? invitation.branchId.toString() : undefined,
        allowedBranches: invitation.branchId ? [invitation.branchId.toString()] : [],
        isDefault: false,
        joinedAt: new Date(),
      });
    }

    if (!user.tenantId) {
      user.tenantId = tenant._id;
      user.roleName = invitation.roleName;
      if (invitation.branchId) user.branchId = invitation.branchId.toString();
    }

    user.isVerified = true;
    await user.save();

    const refreshedToken = AuthService.generateAccessToken(user);
    const safeUser = await User.findById(user._id).lean();
    return { tenant, token: refreshedToken, user: (safeUser || user) as any };
  }

  /**
   * Accepts invitation and registers a new employee account directly from the link
   */
  public static async acceptInvitationAndRegister(
    rawToken: string,
    input: { username: string; password: string; fullName?: string; phone?: string }
  ): Promise<{ tenant: ITenant; token: string; user: InstanceType<typeof User> }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ValidationError('Invitation token is required.');
    }
    if (!input.username || !input.password) {
      throw new ValidationError('Username and password are required.');
    }
    if (input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long.');
    }

    const tokenHash = this.hashInvitationToken(rawToken);
    const invitation = await TenantInvitation.findOne({
      $or: [{ tokenHash }, { token: rawToken.trim() }],
    });

    if (!invitation) {
      throw new NotFoundError('Invalid invitation link.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ValidationError('This invitation has already been used.');
    }

    if (invitation.status === 'REVOKED') {
      throw new ValidationError('This invitation is no longer available.');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'EXPIRED';
      await invitation.save();
      throw new ValidationError('This invitation has expired.');
    }

    if (invitation.status !== 'PENDING') {
      throw new ValidationError('This invitation is no longer valid.');
    }

    const normalizedEmail = invitation.email.toLowerCase().trim();

    // Check if account already exists for this email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictError(
        'An account with this email already exists. Please sign in to accept your invitation.'
      );
    }

    const normalizedUsername = input.username.toLowerCase().trim();
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      throw new ConflictError('Username is already taken. Please choose another username.');
    }

    const tenant = await Tenant.findById(invitation.tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant company no longer exists.');
    }

    // Create new user assigned to tenant with strictly server-controlled role
    const newUser = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: input.password,
      fullName: input.fullName?.trim() || input.username.trim(),
      phone: input.phone?.trim(),
      roleName: invitation.roleName,
      tenantId: tenant._id,
      branchId: invitation.branchId ? invitation.branchId.toString() : undefined,
      allowedBranches: invitation.branchId ? [invitation.branchId.toString()] : [],
      isVerified: true, // Proved ownership via clicked email invitation link
      isActive: true,
      tenants: [
        {
          tenantId: tenant._id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          roleName: invitation.roleName,
          branchId: invitation.branchId ? invitation.branchId.toString() : undefined,
          allowedBranches: invitation.branchId ? [invitation.branchId.toString()] : [],
          isDefault: true,
          joinedAt: new Date(),
        },
      ],
    });

    // Mark invitation accepted
    invitation.status = 'ACCEPTED';
    invitation.acceptedAt = new Date();
    await invitation.save();

    const token = AuthService.generateAccessToken(newUser);
    return { tenant, token, user: newUser };
  }

  /**
   * Lists invitations for a tenant
   */
  public static async listInvitations(
    tenantId: string
  ): Promise<InstanceType<typeof TenantInvitation>[]> {
    return TenantInvitation.find({ tenantId })
      .populate('invitedBy', 'username email')
      .sort({ createdAt: -1 });
  }

  /**
   * Resends an invitation with a fresh secure token and expiration
   */
  public static async resendInvitation(
    invitationId: string,
    tenantId: string,
    invitedByUserId: string,
    origin?: string
  ): Promise<{ invitation: InstanceType<typeof TenantInvitation>; token: string }> {
    const inv = await TenantInvitation.findOne({ _id: invitationId, tenantId });
    if (!inv) {
      throw new NotFoundError('Invitation not found.');
    }

    if (inv.status === 'ACCEPTED') {
      throw new ValidationError('This invitation has already been accepted.');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    const inviter = await User.findById(invitedByUserId).select('username email');
    const inviterName = inviter?.username || 'Your Workspace Admin';

    // Generate new random token & hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    inv.tokenHash = tokenHash;
    inv.status = 'PENDING';
    inv.expiresAt = expiresAt;
    inv.acceptedAt = undefined;
    await inv.save();

    const inviteUrl = this.constructInvitationUrl(rawToken, origin);

    EmailService.sendEmployeeInvitationLink(
      inv.email,
      inviterName,
      tenant.name,
      inv.roleName,
      inviteUrl,
      72
    ).catch((err) => {
      console.warn('[TenantService] Failed to dispatch resent invitation email via Brevo:', err);
    });

    return { invitation: inv, token: rawToken };
  }

  /**
   * Revokes an invitation immediately invalidating the link
   */
  public static async revokeInvitation(invitationId: string, tenantId: string): Promise<void> {
    const inv = await TenantInvitation.findOne({ _id: invitationId, tenantId });
    if (!inv) {
      throw new NotFoundError('Invitation not found.');
    }
    inv.status = 'REVOKED';
    await inv.save();
  }

  /**
   * Platform Admin: List all tenants with summary statistics, search, filtering, and pagination
   */
  public static async listAllTenantsAdmin(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    } = {}
  ): Promise<any> {
    const query: Record<string, any> = { status: { $ne: 'DELETED' } };

    if (options.status && options.status !== 'ALL') {
      query.status = options.status.toUpperCase();
    }

    if (options.search && options.search.trim()) {
      const term = options.search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { legalName: { $regex: term, $options: 'i' } },
        { slug: { $regex: term, $options: 'i' } },
        { 'contact.email': { $regex: term, $options: 'i' } },
      ];
    }

    const hasPaginationParams = Boolean(
      options.page || options.limit || options.search || options.status
    );
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number(options.limit) || (hasPaginationParams ? 20 : 1000))
    );
    const skip = (page - 1) * limit;

    const [total, rawTenants] = await Promise.all([
      Tenant.countDocuments(query),
      Tenant.find(query)
        .sort({ createdAt: -1 })
        .skip(hasPaginationParams ? skip : 0)
        .limit(limit)
        .lean(),
    ]);

    const results = await Promise.all(
      rawTenants.map(async (t) => {
        const tenantIdStr = (t as any)._id.toString();
        const [userCount, branchCount, productCount, posCount] = await Promise.all([
          User.countDocuments({
            $or: [
              { tenantId: (t as any)._id },
              { 'tenants.tenantId': (t as any)._id },
              { ownerUserId: (t as any).ownerUserId },
            ],
          }),
          Branch.countDocuments({ tenantId: (t as any)._id }),
          Product.countDocuments({ tenantId: tenantIdStr }),
          POSTerminal.countDocuments({ tenantId: tenantIdStr }),
        ]);

        return {
          ...t,
          stats: {
            users: userCount,
            branches: branchCount,
            products: productCount,
            posTerminals: posCount,
          },
        };
      })
    );

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    if (hasPaginationParams) {
      return {
        tenants: results,
        pagination,
      };
    }

    // Direct array backward compatibility for tests, with pagination metadata attached
    (results as any).pagination = pagination;
    return results;
  }

  /**
   * Platform Admin: Update tenant status (ACTIVE, SUSPENDED, TRIAL, CANCELLED)
   */
  public static async updateTenantStatusAdmin(
    tenantId: string,
    status: TenantStatus,
    adminUserId: string
  ): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    const prevStatus = tenant.status;
    tenant.status = status;
    await tenant.save();

    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      action: 'PLATFORM_ADMIN_UPDATE_TENANT_STATUS',
      targetModel: 'Tenant',
      targetId: tenantId,
      previousValues: { status: prevStatus },
      newValues: { status },
    });

    return tenant;
  }
}
