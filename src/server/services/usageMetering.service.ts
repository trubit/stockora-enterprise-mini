import { redis } from '../database/redis.js';
import { logger } from '../logger.js';
import { TenantUsage, type ITenantUsageMetrics } from '../models/TenantUsage.js';
import { Subscription } from '../models/Subscription.js';
import { Plan } from '../models/Plan.js';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { POSTerminal } from '../models/POSTerminal.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { WorkflowInstance } from '../models/WorkflowInstance.js';
import { BillingAuditLog } from '../models/BillingAuditLog.js';

export interface UsageLimitStatus {
  used: number;
  limit: number;
  unlimited: boolean;
  remaining: number;
  percentage: number;
  warningLevel: 'NONE' | 'WARNING_75' | 'CRITICAL_90' | 'EXCEEDED_100';
  isExceeded: boolean;
}

export type TenantResourceKey =
  | 'users'
  | 'branches'
  | 'warehouses'
  | 'posTerminals'
  | 'products'
  | 'customers'
  | 'orders'
  | 'storageMb'
  | 'apiRequestsMonthly'
  | 'aiRequestsMonthly'
  | 'automations';

export class UsageMeteringService {
  /**
   * Helper to format current billing period string, e.g. '2026-08'
   */
  public static getCurrentPeriodString(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get or initialize the usage document for a tenant's billing period.
   */
  public static async getOrCreateUsageRecord(
    tenantId: string,
    period: string = this.getCurrentPeriodString()
  ): Promise<InstanceType<typeof TenantUsage>> {
    const start = new Date(
      Date.UTC(Number(period.split('-')[0]), Number(period.split('-')[1]) - 1, 1)
    );
    const end = new Date(
      Date.UTC(Number(period.split('-')[0]), Number(period.split('-')[1]), 0, 23, 59, 59)
    );

    let record = await TenantUsage.findOne({ tenantId, billingPeriod: period });
    if (!record) {
      record = await TenantUsage.create({
        tenantId,
        billingPeriod: period,
        periodStart: start,
        periodEnd: end,
        metrics: {
          users: 0,
          branches: 0,
          warehouses: 0,
          posTerminals: 0,
          products: 0,
          customers: 0,
          orders: 0,
          storageMb: 10,
          apiRequestsMonthly: 0,
          aiRequestsMonthly: 0,
          automations: 0,
        },
        lastReconciledAt: new Date(),
      });
    }
    return record;
  }

  /**
   * Authoritatively reconcile tenant resource counts from database collections.
   */
  public static async reconcileTenantUsage(tenantId: string): Promise<ITenantUsageMetrics> {
    logger.info(`[UsageMeteringService] Reconciling authoritative usage for tenant ${tenantId}`);

    const [
      usersCount,
      branchesCount,
      warehousesCount,
      terminalsCount,
      productsCount,
      customersCount,
      ordersCount,
      automationsCount,
    ] = await Promise.all([
      User.countDocuments({
        $or: [{ tenantId }, { 'tenants.tenantId': tenantId }],
        isActive: true,
      }),
      Branch.countDocuments({ tenantId, isActive: { $ne: false } }),
      Warehouse.countDocuments({ tenantId, isActive: { $ne: false } }),
      POSTerminal.countDocuments({ tenantId, status: { $ne: 'DECOMMISSIONED' } }),
      Product.countDocuments({ tenantId }),
      Customer.countDocuments({ tenantId }),
      SalesOrder.countDocuments({ tenantId }),
      WorkflowInstance.countDocuments({ tenantId }),
    ]);

    const period = this.getCurrentPeriodString();
    const usageDoc = await this.getOrCreateUsageRecord(tenantId, period);

    // Keep non-countable ephemeral metrics from current document
    const updatedMetrics: ITenantUsageMetrics = {
      users: usersCount,
      branches: branchesCount,
      warehouses: warehousesCount,
      posTerminals: terminalsCount,
      products: productsCount,
      customers: customersCount,
      orders: ordersCount,
      storageMb: Math.max(10, Math.round(productsCount * 0.05 + 10)), // Approximate storage
      apiRequestsMonthly: usageDoc.metrics.apiRequestsMonthly || 0,
      aiRequestsMonthly: usageDoc.metrics.aiRequestsMonthly || 0,
      automations: automationsCount,
    };

    usageDoc.metrics = updatedMetrics;
    usageDoc.lastReconciledAt = new Date();
    await usageDoc.save();

    // Invalidate Redis cache
    const cacheKey = `usage:${tenantId}:${period}`;
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(updatedMetrics));
    } catch (e) {
      logger.warn(`[UsageMeteringService] Failed to cache usage in Redis: ${e}`);
    }

    return updatedMetrics;
  }

  /**
   * Increment an ephemeral/metered metric (e.g. AI requests, API calls) atomically in Redis and DB.
   */
  public static async incrementMetric(
    tenantId: string,
    metric: TenantResourceKey,
    by: number = 1
  ): Promise<number> {
    const period = this.getCurrentPeriodString();
    const redisKey = `usage:metric:${tenantId}:${period}:${metric}`;

    let currentVal = 0;
    try {
      currentVal = await redis.incrby(redisKey, by);
    } catch {
      // Fallback
    }

    // Update MongoDB
    const incField = `metrics.${metric}`;
    await TenantUsage.updateOne(
      { tenantId, billingPeriod: period },
      { $inc: { [incField]: by } },
      { upsert: true }
    );

    return currentVal;
  }

  /**
   * Get active subscription limits for a tenant.
   */
  public static async getTenantLimits(tenantId: string) {
    const subscription = await Subscription.findOne({
      tenantId,
      status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    }).populate('planId');

    const now = new Date();
    if (
      subscription &&
      (!subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd) >= now)
    ) {
      if (subscription.planSnapshot?.limits) {
        return subscription.planSnapshot.limits;
      }
    }

    // Fallback to authoritative FREE plan
    const freePlan = await Plan.findOne({ tier: 'FREE', status: 'ACTIVE' });
    if (freePlan && freePlan.limits) {
      return freePlan.limits;
    }

    // Absolute fallback for Free tier baseline
    return {
      users: { count: 1, unlimited: false },
      branches: { count: 1, unlimited: false },
      warehouses: { count: 1, unlimited: false },
      posTerminals: { count: 1, unlimited: false },
      products: { count: 50, unlimited: false },
      customers: { count: 50, unlimited: false },
      orders: { count: 100, unlimited: false },
      storageMb: { count: 512, unlimited: false },
      apiRequestsMonthly: { count: 0, unlimited: false },
      aiRequestsMonthly: { count: 0, unlimited: false },
      automations: { count: 0, unlimited: false },
    };
  }

  /**
   * Check if a tenant can create or consume additional units of a resource.
   */
  public static async checkLimit(
    tenantId: string,
    resource: TenantResourceKey,
    requestedAddition: number = 1
  ): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    unlimited: boolean;
    message?: string;
  }> {
    // 1. Get current usage
    const metrics = await this.reconcileTenantUsage(tenantId);
    const used = (metrics as any)[resource] ?? 0;

    // 2. Get plan limits
    const limits = await this.getTenantLimits(tenantId);
    const limitConfig = (limits as any)[resource];

    if (!limitConfig) {
      return { allowed: true, current: used, limit: Infinity, unlimited: true };
    }

    if (limitConfig.unlimited) {
      return { allowed: true, current: used, limit: 0, unlimited: true };
    }

    const maxAllowed = limitConfig.count;
    if (used + requestedAddition > maxAllowed) {
      // Log limit warning/exceeded event
      await BillingAuditLog.create({
        tenantId,
        action: 'LIMIT_EXCEEDED',
        details: {
          resource,
          used,
          attemptedAdd: requestedAddition,
          limit: maxAllowed,
        },
      });

      return {
        allowed: false,
        current: used,
        limit: maxAllowed,
        unlimited: false,
        message: `Plan limit exceeded: Your current plan allows up to ${maxAllowed} ${resource} (currently using ${used}). Upgrade your subscription to create more.`,
      };
    }

    return { allowed: true, current: used, limit: maxAllowed, unlimited: false };
  }

  /**
   * Return full detailed status of all metered resources for a tenant's dashboard.
   */
  public static async getTenantUsageSummary(
    tenantId: string
  ): Promise<Record<TenantResourceKey, UsageLimitStatus>> {
    const metrics = await this.reconcileTenantUsage(tenantId);
    const limits = await this.getTenantLimits(tenantId);

    const keys: TenantResourceKey[] = [
      'users',
      'branches',
      'warehouses',
      'posTerminals',
      'products',
      'customers',
      'orders',
      'storageMb',
      'apiRequestsMonthly',
      'aiRequestsMonthly',
      'automations',
    ];

    const result = {} as Record<TenantResourceKey, UsageLimitStatus>;

    for (const key of keys) {
      const used = (metrics as any)[key] ?? 0;
      const limitConfig = (limits as any)[key] || { count: 0, unlimited: false };
      const unlimited = Boolean(limitConfig.unlimited);
      const limitCount = limitConfig.count || 0;

      let remaining = 0;
      let percentage = 0;
      let isExceeded = false;
      let warningLevel: UsageLimitStatus['warningLevel'] = 'NONE';

      if (unlimited) {
        remaining = 999999;
        percentage = 0;
      } else {
        remaining = Math.max(0, limitCount - used);
        percentage = limitCount > 0 ? Math.min(100, Math.round((used / limitCount) * 100)) : 100;
        isExceeded = used >= limitCount;

        if (percentage >= 100) {
          warningLevel = 'EXCEEDED_100';
        } else if (percentage >= 90) {
          warningLevel = 'CRITICAL_90';
        } else if (percentage >= 75) {
          warningLevel = 'WARNING_75';
        }
      }

      result[key] = {
        used,
        limit: limitCount,
        unlimited,
        remaining,
        percentage,
        warningLevel,
        isExceeded,
      };
    }

    return result;
  }
}
