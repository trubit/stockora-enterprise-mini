/**
 * jobs.worker.ts
 * Background job processors for the Stockora automation engine.
 *
 * Registered jobs:
 *  1. CHECK_LOW_STOCK          — Alert when products dip below threshold
 *  2. DB_CLEANUP               — Rotate old audit logs (>90 days)
 *  3. EXPIRE_PROMOTIONS        — Deactivate expired promo codes
 *  4. EXPIRE_GIFT_CARDS        — Deactivate expired gift cards
 *  5. REORDER_SUGGESTIONS      — Notify manager of items needing PO
 *  6. LOYALTY_TIER_RECALC      — Recalculate all customer loyalty tiers
 *  7. FLUSH_SCHEDULED_NOTIFS   — Deliver any due scheduled notifications
 *  8. SYNC_OFFLINE_STATS       — Aggregate offline sync metrics to DB
 *  9. GENERATE_DAILY_REPORT    — Compute daily sales summary
 * 10. WARRANTY_EXPIRY_ALERT    — Alert for warranties expiring in 30 days
 *
 * Scheduling strategy:
 *  - Redis ≥ 5: Uses BullMQ queues + cron repeat jobs (full feature set).
 *  - Redis < 5: All BullMQ is skipped. Falls back to Node.js setInterval timers.
 */

import type { Job } from 'bullmq';
import { QueueManager } from './bullmq.js';
import { Product } from '../models/Product.js';
import { AuditLog } from '../models/AuditLog.js';
import { Promotion } from '../models/Promotion.js';
import { GiftCard } from '../models/GiftCard.js';
import { Customer } from '../models/Customer.js';
import { NotificationService } from '../services/notification.service.js';
import { logger } from '../logger.js';

const QUEUE = 'system-automation';

// ---------------------------------------------------------------------------
// Job type registry
// ---------------------------------------------------------------------------

export type TaskType =
  | 'CHECK_LOW_STOCK'
  | 'DB_CLEANUP'
  | 'EXPIRE_PROMOTIONS'
  | 'EXPIRE_GIFT_CARDS'
  | 'REORDER_SUGGESTIONS'
  | 'LOYALTY_TIER_RECALC'
  | 'FLUSH_SCHEDULED_NOTIFS'
  | 'SYNC_OFFLINE_STATS'
  | 'GENERATE_DAILY_REPORT'
  | 'WARRANTY_EXPIRY_ALERT'
  | 'PROCESS_SCHEDULED_REPORTS'
  | 'INVENTORY_INTELLIGENCE_SCAN'
  | 'CRM_SEGMENTATION_EVAL'
  | 'CRM_CHURN_SCAN'
  | 'EXPIRE_INVENTORY_RESERVATION'
  | 'BUSINESS_INTELLIGENCE_SCAN'
  | 'GENERATE_DAILY_BRIEFING'
  | 'FINANCIAL_RECONCILIATION_SCAN'
  | 'BUDGET_OVERRUN_CHECK'
  | 'LOYALTY_POINT_EXPIRATION_SCAN'
  | 'BILLING_USAGE_RECONCILIATION'
  | 'SUBSCRIPTION_EXPIRATION_SCAN'
  | 'BILLING_PAST_DUE_GRACE_CHECK';

// ---------------------------------------------------------------------------
// Job processors
// ---------------------------------------------------------------------------

async function processReservationExpiration(): Promise<void> {
  const { ReservationService } = await import('../services/reservation.service.js');
  const count = await ReservationService.expireStaleReservations();
  if (count > 0) {
    logger.info(`[Job] EXPIRE_INVENTORY_RESERVATION: Released ${count} stale stock reservations.`);
  }
}

async function processCrmScan(): Promise<void> {
  const { CRMService } = await import('../services/crm.service.js');
  await CRMService.evaluateSegments();
  logger.info('[Job] CRM_SEGMENTATION_EVAL: Customer segments refreshed.');
}

async function processInventoryIntelligenceScan(): Promise<void> {
  const { InventoryOptimizationService } =
    await import('../services/inventory-optimization.service.js');
  const { SupplierIntelligenceService } =
    await import('../services/supplier-intelligence.service.js');

  await InventoryOptimizationService.scanStockoutRisks();
  await SupplierIntelligenceService.evaluateAllSuppliers();
  logger.info('[Job] INVENTORY_INTELLIGENCE_SCAN: Stockout risks and supplier scores refreshed.');
}

async function processLowStockCheck(): Promise<void> {
  // Query products that are at or below their own configured lowStockAlert threshold
  const products = await Product.find(
    { $expr: { $lte: ['$quantity', '$lowStockAlert'] }, isActive: true },
    { name: 1, quantity: 1, lowStockAlert: 1 }
  )
    .limit(50)
    .lean();
  if (products.length === 0) return;
  await NotificationService.send({
    type: 'WARNING',
    title: `⚠️ Low Stock Alert — ${products.length} item(s)`,
    body: `Items critically low: ${products
      .slice(0, 3)
      .map((p) => p.name)
      .join(', ')}${products.length > 3 ? '…' : ''}`,
    channels: ['IN_APP'],
    targetRole: 'admin',
  });
  logger.info(`[Job] CHECK_LOW_STOCK: ${products.length} items below their stock alert threshold.`);
}

async function processLogRotation(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 86400000);
  const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
  logger.info(
    `[Job] DB_CLEANUP: Deleted ${result.deletedCount} audit log entries older than 90 days.`
  );
}

async function processExpirePromotions(): Promise<void> {
  const now = new Date();
  const result = await Promotion.updateMany(
    { isActive: true, endDate: { $lt: now } },
    { $set: { isActive: false } }
  );
  logger.info(`[Job] EXPIRE_PROMOTIONS: Deactivated ${result.modifiedCount} expired promotions.`);
}

async function processExpireGiftCards(): Promise<void> {
  const now = new Date();
  const result = await GiftCard.updateMany(
    { status: 'ACTIVE', expiresAt: { $lt: now } },
    { $set: { status: 'EXPIRED' } }
  );
  logger.info(`[Job] EXPIRE_GIFT_CARDS: Expired ${result.modifiedCount} gift cards.`);
}

async function processReorderSuggestions(): Promise<void> {
  const items = await Product.find({
    isActive: true,
    $expr: { $lte: ['$quantity', '$reorderPoint'] },
  }).limit(10);
  if (items.length === 0) return;
  await NotificationService.send({
    type: 'INFO',
    title: `📦 Reorder Suggestions — ${items.length} item(s)`,
    body: `Consider restocking: ${items
      .slice(0, 3)
      .map((p) => p.name)
      .join(', ')}${items.length > 3 ? '…' : ''}`,
    channels: ['IN_APP'],
    targetRole: 'admin',
  });
  logger.info(`[Job] REORDER_SUGGESTIONS: ${items.length} items at or below reorder point.`);
}

async function processLoyaltyTierRecalc(): Promise<void> {
  // Use cursor-based streaming + batched bulkWrite to avoid loading all customers into memory (OOM prevention)
  const BATCH_SIZE = 200;
  const cursor = Customer.find({ isActive: true })
    .select('_id loyaltyPoints loyaltyTier')
    .lean()
    .cursor();

  let batch: Parameters<typeof Customer.bulkWrite>[0] = [];
  let updated = 0;

  for await (const customer of cursor) {
    const pts = (customer as any).loyaltyPoints ?? 0;
    const tier = pts >= 5000 ? 'PLATINUM' : pts >= 2000 ? 'GOLD' : pts >= 500 ? 'SILVER' : 'BRONZE';

    if ((customer as any).loyaltyTier !== tier) {
      batch.push({
        updateOne: {
          filter: { _id: (customer as any)._id },
          update: { $set: { loyaltyTier: tier } },
        },
      });
      updated++;
    }

    // Flush batch when it reaches BATCH_SIZE to keep memory usage bounded
    if (batch.length >= BATCH_SIZE) {
      await Customer.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }

  // Flush remaining operations
  if (batch.length > 0) {
    await Customer.bulkWrite(batch, { ordered: false });
  }

  logger.info(
    `[Job] LOYALTY_TIER_RECALC: ${updated} customer tier(s) updated (cursor streaming + bulkWrite).`
  );
}

async function processFlushScheduledNotifs(): Promise<void> {
  const { Notification } = await import('../models/Notification.js');
  const now = new Date();
  const due = await Notification.find({ scheduledAt: { $lte: now }, status: 'UNREAD' }).limit(50);
  for (const notif of due) {
    notif.status = 'READ';
    await notif.save();
  }
  if (due.length > 0)
    logger.info(`[Job] FLUSH_SCHEDULED_NOTIFS: Dispatched ${due.length} scheduled notifications.`);
}

async function processSyncOfflineStats(): Promise<void> {
  logger.info('[Job] SYNC_OFFLINE_STATS: Offline stats sync triggered (no-op in dev).');
}

async function processGenerateDailyReport(): Promise<void> {
  const { Transaction } = await import('../models/Transaction.js');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const txCount = await Transaction.countDocuments({ createdAt: { $gte: start, $lte: end } });
  const revenue = await Transaction.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const totalRevenue = revenue[0]?.total ?? 0;
  await NotificationService.send({
    type: 'INFO',
    title: `📊 Daily Report — ${new Date().toLocaleDateString()}`,
    body: `Transactions: ${txCount} | Revenue: $${totalRevenue.toFixed(2)}`,
    channels: ['IN_APP'],
    targetRole: 'admin',
  });
  logger.info(`[Job] GENERATE_DAILY_REPORT: ${txCount} txns, $${totalRevenue.toFixed(2)} revenue.`);
}

async function processWarrantyExpiryAlert(): Promise<void> {
  const { Warranty } = await import('../models/Warranty.js');
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const expiring = await Warranty.find({ expiresAt: { $lte: in30Days, $gte: new Date() } }).limit(
    50
  );
  if (expiring.length === 0) return;
  await NotificationService.send({
    type: 'WARNING',
    title: `🛡️ ${expiring.length} warranty(ies) expiring within 30 days`,
    body: `Earliest: ${expiring[0].productName} — expires ${new Date(expiring[0].expiresAt).toLocaleDateString()}.`,
    channels: ['IN_APP'],
    targetRole: 'admin',
  });
  logger.info(
    `[Job] WARRANTY_EXPIRY_ALERT: ${expiring.length} warranties expiring within 30 days.`
  );
}

async function processScheduledReports(): Promise<void> {
  const { ScheduledReport } = await import('../models/ScheduledReport.js');
  const activeSchedules = await ScheduledReport.find({ isActive: true });
  if (activeSchedules.length === 0) return;

  for (const schedule of activeSchedules) {
    logger.info(
      `[Job] PROCESS_SCHEDULED_REPORTS: Dispatching report [${schedule.name}] to: ${schedule.recipients.join(', ')}`
    );
    schedule.lastRunAt = new Date();
    await schedule.save();
  }
}

async function processBusinessIntelligenceScan(): Promise<void> {
  const { BusinessAlertService } = await import('../services/businessAlert.service.js');
  await BusinessAlertService.scanAndGenerateAlerts();
  logger.info('[Job] BUSINESS_INTELLIGENCE_SCAN: Completed enterprise anomaly scan.');
}

async function processDailyBriefingGeneration(): Promise<void> {
  const { DecisionIntelligenceService } =
    await import('../services/ai/decisionIntelligence.service.js');
  await DecisionIntelligenceService.generateDailyBriefing();
  logger.info('[Job] GENERATE_DAILY_BRIEFING: Daily morning executive briefing refreshed.');
}

async function processFinancialReconciliationScan(): Promise<void> {
  const { AccountsReceivableService } = await import('../services/accountsReceivable.service.js');
  const { AccountsPayableService } = await import('../services/accountsPayable.service.js');
  await AccountsReceivableService.getAgingReport();
  await AccountsPayableService.getAgingReport();
  logger.info('[Job] FINANCIAL_RECONCILIATION_SCAN: Refreshed AR/AP aging indices.');
}

async function processBudgetOverrunCheck(): Promise<void> {
  const { FinancialBudget } = await import('../models/FinancialBudget.js');
  const budgets = await FinancialBudget.find({ status: 'ACTIVE' });
  for (const b of budgets) {
    if (b.allocatedAmount > 0) {
      const pct = (b.spentAmount / b.allocatedAmount) * 100;
      if (pct >= b.thresholdAlertPct && !b.isAlertTriggered) {
        b.isAlertTriggered = true;
        if (pct > 100) b.status = 'EXCEEDED';
        await b.save();
        logger.warn(
          `[Budget Alert] Budget '${b.name}' has reached ${pct.toFixed(1)}% of allocation.`
        );
      }
    }
  }
}

async function processLoyaltyPointExpirationScan(): Promise<void> {
  const { LoyaltyAdvancedService } = await import('../services/loyaltyAdvanced.service.js');
  const count = await LoyaltyAdvancedService.scanAndExpirePoints();
  logger.info(
    `[Job] LOYALTY_POINT_EXPIRATION_SCAN: Expired points for ${count} inactive customer(s).`
  );
}

async function processBillingUsageReconciliation(): Promise<void> {
  const { Tenant } = await import('../models/Tenant.js');
  const { UsageMeteringService } = await import('../services/usageMetering.service.js');
  const tenants = await Tenant.find({ status: 'ACTIVE' }).select('_id').lean();
  for (const t of tenants) {
    const tenantId = (t as any)._id?.toString();
    if (!tenantId) continue;
    try {
      await UsageMeteringService.reconcileTenantUsage(tenantId);
    } catch (err) {
      logger.error(`[Job] Failed reconciling usage for tenant ${tenantId}:`, err);
    }
  }

  logger.info(
    `[Job] BILLING_USAGE_RECONCILIATION: Reconciled usage for ${tenants.length} tenants.`
  );
}

async function processSubscriptionExpirationScan(): Promise<void> {
  const { Subscription } = await import('../models/Subscription.js');
  const now = new Date();
  // Check trials that expired
  const expiredTrials = await Subscription.find({
    status: 'TRIALING',
    trialEndDate: { $lt: now },
  });

  for (const sub of expiredTrials) {
    sub.status = 'EXPIRED';
    await sub.save();
    logger.info(`[Job] Subscription ${sub._id} for tenant ${sub.tenantId} expired after trial.`);
  }

  // Check renewals past due
  const pastDueSubs = await Subscription.find({
    status: 'ACTIVE',
    currentPeriodEnd: { $lt: now },
  });

  for (const sub of pastDueSubs) {
    if (sub.cancelAtPeriodEnd) {
      sub.status = 'CANCELLED';
      sub.endedAt = now;
    } else {
      sub.status = 'PAST_DUE';
    }
    await sub.save();
    logger.info(`[Job] Subscription ${sub._id} updated to ${sub.status}.`);
  }
}

// ---------------------------------------------------------------------------
// Direct dispatcher (used by both BullMQ wrapper and fallback scheduler)
// ---------------------------------------------------------------------------

export async function directDispatch(task: TaskType): Promise<void> {
  switch (task) {
    case 'BILLING_USAGE_RECONCILIATION':
      return processBillingUsageReconciliation();
    case 'SUBSCRIPTION_EXPIRATION_SCAN':
    case 'BILLING_PAST_DUE_GRACE_CHECK':
      return processSubscriptionExpirationScan();
    case 'LOYALTY_POINT_EXPIRATION_SCAN':
      return processLoyaltyPointExpirationScan();

    case 'FINANCIAL_RECONCILIATION_SCAN':
      return processFinancialReconciliationScan();
    case 'BUDGET_OVERRUN_CHECK':
      return processBudgetOverrunCheck();
    case 'BUSINESS_INTELLIGENCE_SCAN':
      return processBusinessIntelligenceScan();
    case 'GENERATE_DAILY_BRIEFING':
      return processDailyBriefingGeneration();
    case 'CRM_SEGMENTATION_EVAL':
    case 'CRM_CHURN_SCAN':
      return processCrmScan();
    case 'INVENTORY_INTELLIGENCE_SCAN':
      return processInventoryIntelligenceScan();
    case 'CHECK_LOW_STOCK':
      return processLowStockCheck();
    case 'DB_CLEANUP':
      return processLogRotation();
    case 'EXPIRE_PROMOTIONS':
      return processExpirePromotions();
    case 'EXPIRE_GIFT_CARDS':
      return processExpireGiftCards();
    case 'REORDER_SUGGESTIONS':
      return processReorderSuggestions();
    case 'LOYALTY_TIER_RECALC':
      return processLoyaltyTierRecalc();
    case 'FLUSH_SCHEDULED_NOTIFS':
      return processFlushScheduledNotifs();
    case 'SYNC_OFFLINE_STATS':
      return processSyncOfflineStats();
    case 'GENERATE_DAILY_REPORT':
      return processGenerateDailyReport();
    case 'WARRANTY_EXPIRY_ALERT':
      return processWarrantyExpiryAlert();
    case 'PROCESS_SCHEDULED_REPORTS':
      return processScheduledReports();
    case 'EXPIRE_INVENTORY_RESERVATION':
      return processReservationExpiration();
    default:
      logger.warn(`[Scheduler] Unknown task: ${task}`);
  }
}

// ---------------------------------------------------------------------------
// BullMQ job wrapper (only used when Redis ≥ 5)
// ---------------------------------------------------------------------------

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function dispatchTask(job: Job<any>): Promise<void> {
  const task: TaskType = job.data?.task ?? job.name;
  try {
    return await directDispatch(task);
  } catch (err) {
    // Re-throw so BullMQ can record the failure and apply retry policy
    logger.error(`[BullMQ] Job [${task}] threw an unhandled error:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Node.js setInterval fallback (used when Redis < 5)
// ---------------------------------------------------------------------------

const MS = {
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
};

function scheduleInterval(name: TaskType, intervalMs: number): void {
  const fn = async () => {
    try {
      logger.info(`[Scheduler] Running fallback interval job: ${name}`);
      await directDispatch(name);
    } catch (err) {
      logger.error(`[Scheduler] Fallback job [${name}] failed:`, err);
    }
  };
  setInterval(fn, intervalMs);
  logger.info(
    `[Scheduler] Fallback setInterval registered: [${name}] every ${Math.round(intervalMs / 1000)}s`
  );
}

function startFallbackScheduler(): void {
  logger.info(
    '[Scheduler] Redis < 5 detected — BullMQ disabled. Starting Node.js setInterval fallback.'
  );
  scheduleInterval('CHECK_LOW_STOCK', MS.HOUR);
  scheduleInterval('DB_CLEANUP', MS.DAY);
  scheduleInterval('EXPIRE_PROMOTIONS', MS.DAY);
  scheduleInterval('EXPIRE_GIFT_CARDS', MS.DAY);
  scheduleInterval('REORDER_SUGGESTIONS', 8 * MS.HOUR);
  scheduleInterval('LOYALTY_TIER_RECALC', 7 * MS.DAY);
  scheduleInterval('FLUSH_SCHEDULED_NOTIFS', 5 * MS.MINUTE);
  scheduleInterval('GENERATE_DAILY_REPORT', MS.DAY);
  scheduleInterval('WARRANTY_EXPIRY_ALERT', MS.DAY);
  scheduleInterval('PROCESS_SCHEDULED_REPORTS', MS.HOUR);
  scheduleInterval('EXPIRE_INVENTORY_RESERVATION', 5 * MS.MINUTE);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function initializeBackgroundWorkers(): Promise<void> {
  // Step 1: Probe Redis version — this must run before ANY BullMQ instantiation
  const compatible = await QueueManager.checkRedisCompatibility();

  if (!compatible) {
    // Redis < 5: skip BullMQ entirely, use setInterval fallback
    startFallbackScheduler();
    return;
  }

  // Step 2: Redis ≥ 5 path — register BullMQ queue + worker + cron jobs
  const manager = QueueManager.getInstance();
  manager.registerQueue(QUEUE);
  manager.registerWorker(QUEUE, dispatchTask);

  await Promise.all([
    manager.registerCronJob({ queueName: QUEUE, jobName: 'CHECK_LOW_STOCK', cron: '0 * * * *' }),
    manager.registerCronJob({ queueName: QUEUE, jobName: 'DB_CLEANUP', cron: '0 2 * * *' }),
    manager.registerCronJob({ queueName: QUEUE, jobName: 'EXPIRE_PROMOTIONS', cron: '30 0 * * *' }),
    manager.registerCronJob({ queueName: QUEUE, jobName: 'EXPIRE_GIFT_CARDS', cron: '45 0 * * *' }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'REORDER_SUGGESTIONS',
      cron: '0 8 * * 1-5',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'LOYALTY_TIER_RECALC',
      cron: '0 3 * * 0',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'FLUSH_SCHEDULED_NOTIFS',
      cron: '*/5 * * * *',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'GENERATE_DAILY_REPORT',
      cron: '55 23 * * *',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'WARRANTY_EXPIRY_ALERT',
      cron: '0 9 * * *',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'PROCESS_SCHEDULED_REPORTS',
      cron: '0 * * * *',
    }),
    manager.registerCronJob({
      queueName: QUEUE,
      jobName: 'EXPIRE_INVENTORY_RESERVATION',
      cron: '*/5 * * * *',
    }),
  ]);

  logger.info('[BullMQ] All background workers and cron schedules registered (12 jobs total).');
}
