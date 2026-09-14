import mongoose from 'mongoose';
import { logger } from '../logger.js';
import { Plan, type IPlan, type BillingInterval } from '../models/Plan.js';
import { Subscription, type ISubscription, type IPlanSnapshot } from '../models/Subscription.js';
import { BillingAuditLog } from '../models/BillingAuditLog.js';
import { UsageMeteringService } from './usageMetering.service.js';
import { Tenant } from '../models/Tenant.js';
import { ConflictError, NotFoundError } from '../errors/AppError.js';

export interface CreateSubscriptionInput {
  tenantId: string;
  planId: string;
  billingInterval: BillingInterval;
  isTrial?: boolean;
  actorId?: string;
  actorEmail?: string;
}

export interface ChangePlanInput {
  tenantId: string;
  newPlanId: string;
  billingInterval?: BillingInterval;
  force?: boolean;
  actorId?: string;
  actorEmail?: string;
}

export class SubscriptionService {
  /**
   * Helper to build an immutable PlanSnapshot from a Plan document.
   */
  public static createPlanSnapshot(plan: IPlan, billingInterval: BillingInterval): IPlanSnapshot {
    let effectivePrice = plan.price;
    if (billingInterval === 'YEARLY') {
      const discount = (plan.yearlyDiscountPercent || 0) / 100;
      effectivePrice = Math.round(plan.price * 12 * (1 - discount));
    }

    return {
      name: plan.name,
      slug: plan.slug,
      tier: plan.tier,
      price: effectivePrice,
      currency: plan.currency || 'NGN',
      billingInterval,
      features: (plan.features as any)?.toObject
        ? (plan.features as any).toObject()
        : plan.features,
      limits: (plan.limits as any)?.toObject ? (plan.limits as any).toObject() : plan.limits,
      version: plan.version || 1,
    };
  }

  /**
   * Get active or trialing subscription for a tenant.
   */
  public static async getTenantSubscription(tenantId: string): Promise<ISubscription | null> {
    const sub = await Subscription.findOne({
      tenantId,
      status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED'] },
    }).populate('planId');

    if (!sub) return null;

    // Check expiration: if currentPeriodEnd is in the past and status is ACTIVE/TRIALING
    const now = new Date();
    if (
      sub.currentPeriodEnd &&
      new Date(sub.currentPeriodEnd) < now &&
      (sub.status === 'ACTIVE' || sub.status === 'TRIALING')
    ) {
      sub.status = 'EXPIRED';
      await sub.save();
      return null;
    }

    // Check past-due grace period expiration (fail-closed after 7 days)
    if (sub.status === 'PAST_DUE') {
      const graceEnd =
        sub.gracePeriodEndDate ||
        new Date(
          new Date(sub.updatedAt || sub.currentPeriodEnd).getTime() + 7 * 24 * 60 * 60 * 1000
        );
      if (now > graceEnd) {
        sub.status = 'EXPIRED';
        await sub.save();
        return null;
      }
    }

    return sub;
  }

  /**
   * Initialize a new subscription (trial or active) for a tenant.
   */
  public static async createSubscription(input: CreateSubscriptionInput): Promise<ISubscription> {
    const plan = await Plan.findById(input.planId);
    if (!plan) {
      throw new Error(`Plan with ID ${input.planId} not found.`);
    }

    // Cancel any existing active subscriptions to guarantee single active subscription rule
    await Subscription.updateMany(
      { tenantId: input.tenantId, status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      { $set: { status: 'CANCELLED', endedAt: new Date() } }
    );

    const now = new Date();
    const interval = input.billingInterval || 'MONTHLY';
    const isTrial =
      input.isTrial ?? (plan.tier !== 'FREE' && plan.trialConfiguration?.isTrialEnabled);
    const trialDays = plan.trialConfiguration?.trialDays || 14;

    const periodEnd = new Date(now);
    if (isTrial) {
      periodEnd.setDate(periodEnd.getDate() + trialDays);
    } else if (interval === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const snapshot = this.createPlanSnapshot(plan, interval);

    const subscription = await Subscription.create({
      tenantId: input.tenantId,
      planId: plan._id,
      planSlug: plan.slug,
      status: isTrial ? 'TRIALING' : 'ACTIVE',
      billingInterval: interval,
      currency: plan.currency || 'NGN',
      price: snapshot.price,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      trialStartDate: isTrial ? now : undefined,
      trialEndDate: isTrial ? periodEnd : undefined,
      cancelAtPeriodEnd: false,
      failedPaymentCount: 0,
      provider: 'PAYSTACK',
      planSnapshot: snapshot,
    });

    const planFeatures = plan.features
      ? (plan.features as any).toObject
        ? (plan.features as any).toObject()
        : plan.features
      : {};
    const planLimits = {
      maxUsers: plan.limits?.users?.count ?? 1,
      maxBranches: plan.limits?.branches?.count ?? 1,
      maxWarehouses: plan.limits?.warehouses?.count ?? 1,
      maxPOSTerminals: plan.limits?.posTerminals?.count ?? 1,
      maxProducts: plan.limits?.products?.count ?? 50,
      maxStorageMb: plan.limits?.storageMb?.count ?? 512,
    };

    // Update Tenant features & limits snapshot
    await Tenant.findByIdAndUpdate(input.tenantId, {
      $set: {
        subscriptionTier: plan.tier,
        subscriptionReference: subscription._id.toString(),
        features: new Map(Object.entries(planFeatures)),
        limits: planLimits,
      },
    });

    // Audit log
    await BillingAuditLog.create({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'SUBSCRIPTION_CREATED',
      details: {
        planId: plan._id,
        planSlug: plan.slug,
        status: subscription.status,
        interval,
        price: snapshot.price,
      },
    });

    return subscription;
  }

  /**
   * Check if a proposed downgrade has conflicts with existing tenant resource usage.
   */
  public static async evaluateDowngradeImpact(
    tenantId: string,
    newPlanId: string
  ): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{ resource: string; used: number; newLimit: number }>;
  }> {
    const newPlan = await Plan.findById(newPlanId);
    if (!newPlan) {
      throw new Error(`Target plan not found.`);
    }

    const currentUsage = await UsageMeteringService.reconcileTenantUsage(tenantId);
    const conflicts: Array<{ resource: string; used: number; newLimit: number }> = [];

    const resources = [
      'users',
      'branches',
      'warehouses',
      'posTerminals',
      'products',
      'customers',
      'orders',
      'automations',
    ] as const;

    for (const res of resources) {
      const used = (currentUsage as any)[res] || 0;
      const limitConfig = (newPlan.limits as any)[res];
      if (limitConfig && !limitConfig.unlimited && used > limitConfig.count) {
        conflicts.push({
          resource: res,
          used,
          newLimit: limitConfig.count,
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Upgrade or downgrade plan for a tenant.
   */
  public static async changePlan(input: ChangePlanInput): Promise<{
    subscription: ISubscription;
    changeType: 'UPGRADE' | 'DOWNGRADE';
    conflicts?: Array<{ resource: string; used: number; newLimit: number }>;
  }> {
    const currentSub = await this.getTenantSubscription(input.tenantId);
    if (!currentSub) {
      throw new Error(`No active subscription found for tenant ${input.tenantId}`);
    }

    const targetPlan = await Plan.findById(input.newPlanId);
    if (!targetPlan) {
      throw new Error(`Plan with ID ${input.newPlanId} not found.`);
    }

    const interval = input.billingInterval || currentSub.billingInterval;
    const oldPrice = currentSub.price;
    const newSnapshot = this.createPlanSnapshot(targetPlan, interval);
    const isUpgrade = newSnapshot.price >= oldPrice;
    const changeType = isUpgrade ? 'UPGRADE' : 'DOWNGRADE';

    const { conflicts } = await this.evaluateDowngradeImpact(input.tenantId, input.newPlanId);
    if (conflicts.length > 0 && !input.force) {
      throw new ConflictError(
        `Cannot downgrade to ${targetPlan.name}: Resource usage exceeds target plan limits (${conflicts.map((c) => `${c.resource}: ${c.used}/${c.newLimit}`).join(', ')}). Please remove or scale down resources first.`
      );
    }

    // Apply change
    currentSub.planId = targetPlan._id as mongoose.Types.ObjectId;
    currentSub.planSlug = targetPlan.slug;
    currentSub.billingInterval = interval;
    currentSub.price = newSnapshot.price;
    currentSub.currency = targetPlan.currency || 'NGN';
    currentSub.planSnapshot = newSnapshot;
    currentSub.status = 'ACTIVE';
    await currentSub.save();

    const targetFeatures = targetPlan.features
      ? (targetPlan.features as any).toObject
        ? (targetPlan.features as any).toObject()
        : targetPlan.features
      : {};
    const targetLimits = {
      maxUsers: targetPlan.limits?.users?.count ?? 1,
      maxBranches: targetPlan.limits?.branches?.count ?? 1,
      maxWarehouses: targetPlan.limits?.warehouses?.count ?? 1,
      maxPOSTerminals: targetPlan.limits?.posTerminals?.count ?? 1,
      maxProducts: targetPlan.limits?.products?.count ?? 50,
      maxStorageMb: targetPlan.limits?.storageMb?.count ?? 512,
    };

    // Update Tenant
    await Tenant.findByIdAndUpdate(input.tenantId, {
      $set: {
        subscriptionTier: targetPlan.tier,
        features: new Map(Object.entries(targetFeatures)),
        limits: targetLimits,
      },
    });

    // Audit log
    await BillingAuditLog.create({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: isUpgrade ? 'SUBSCRIPTION_UPGRADED' : 'SUBSCRIPTION_DOWNGRADED',
      details: {
        oldPlanSlug: currentSub.planSlug,
        newPlanSlug: targetPlan.slug,
        changeType,
        newPrice: newSnapshot.price,
        hasConflicts: conflicts.length > 0,
        conflicts,
      },
    });

    return {
      subscription: currentSub,
      changeType,
      conflicts,
    };
  }

  /**
   * Cancel subscription (immediately or at period end).
   */
  public static async cancelSubscription(
    tenantId: string,
    immediately: boolean = false,
    reason?: string,
    actorId?: string,
    actorEmail?: string
  ): Promise<ISubscription> {
    const sub = await this.getTenantSubscription(tenantId);
    if (!sub) {
      throw new Error(`No active subscription found for tenant ${tenantId}`);
    }

    const now = new Date();
    if (immediately) {
      sub.status = 'CANCELLED';
      sub.endedAt = now;
      sub.cancelledAt = now;
      sub.cancelAtPeriodEnd = false;
    } else {
      sub.cancelAtPeriodEnd = true;
      sub.cancelledAt = now;
    }

    sub.cancellationReason = reason || 'Cancelled by tenant admin';
    await sub.save();

    await BillingAuditLog.create({
      tenantId,
      actorId,
      actorEmail,
      action: 'SUBSCRIPTION_CANCELLED',
      details: {
        immediately,
        effectiveDate: immediately ? now : sub.currentPeriodEnd,
        reason: sub.cancellationReason,
      },
    });

    return sub;
  }

  /**
   * Reactivate a subscription scheduled for cancellation at period end.
   */
  public static async reactivateSubscription(
    tenantId: string,
    actorId?: string,
    actorEmail?: string
  ): Promise<ISubscription> {
    const sub = await Subscription.findOne({
      tenantId,
      cancelAtPeriodEnd: true,
      status: { $in: ['ACTIVE', 'TRIALING'] },
    });

    if (!sub) {
      throw new Error('No pending cancelled subscription available for reactivation.');
    }

    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = undefined;
    sub.cancellationReason = undefined;
    await sub.save();

    await BillingAuditLog.create({
      tenantId,
      actorId,
      actorEmail,
      action: 'SUBSCRIPTION_REACTIVATED',
      details: {
        planSlug: sub.planSlug,
        renewalDate: sub.renewalDate,
      },
    });

    return sub;
  }

  /**
   * Check if a feature is enabled in tenant's active plan subscription.
   * Strictly fail-closed: If no active subscription exists, evaluates against authoritative FREE plan.
   */
  public static async hasFeature(tenantId: string, featureKey: string): Promise<boolean> {
    const sub = await this.getTenantSubscription(tenantId);
    if (sub && sub.planSnapshot?.features) {
      return Boolean((sub.planSnapshot.features as any)[featureKey]);
    }

    // Authoritative check against FREE plan from database
    const freePlan = await Plan.findOne({ tier: 'FREE', status: 'ACTIVE' });
    if (freePlan && freePlan.features) {
      return Boolean((freePlan.features as any)[featureKey]);
    }

    // Strict baseline fallback for Free tier (only POS and basic inventory allowed)
    const baselineFreeFeatures: Record<string, boolean> = {
      pos: true,
      inventory: true,
      crm: false,
      loyalty: false,
      aiAssistant: false,
      advancedAnalytics: false,
      multiBranch: false,
      warehouseManagement: false,
      employeeManagement: false,
      reports: false,
      apiAccess: false,
      integrations: false,
      automation: false,
      customBranding: false,
      prioritySupport: false,
    };
    return Boolean(baselineFreeFeatures[featureKey]);
  }

  /**
   * Get full entitlement summary for a tenant.
   */
  public static async getTenantEntitlements(tenantId: string) {
    const sub = await this.getTenantSubscription(tenantId);
    if (sub && sub.planSnapshot) {
      return {
        planTier: sub.planSnapshot.tier,
        planSlug: sub.planSlug,
        status: sub.status,
        features: sub.planSnapshot.features,
        limits: sub.planSnapshot.limits,
      };
    }

    const freePlan = await Plan.findOne({ tier: 'FREE', status: 'ACTIVE' });
    if (freePlan) {
      return {
        planTier: 'FREE',
        planSlug: freePlan.slug,
        status: 'FREE',
        features: freePlan.features,
        limits: freePlan.limits,
      };
    }

    return {
      planTier: 'FREE',
      planSlug: 'free',
      status: 'FREE',
      features: { pos: true, inventory: true },
      limits: {
        users: { count: 1, unlimited: false },
        branches: { count: 1, unlimited: false },
        warehouses: { count: 1, unlimited: false },
        products: { count: 50, unlimited: false },
      },
    };
  }
}
