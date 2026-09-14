import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Transaction } from '../models/Transaction.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { Receipt } from '../models/Receipt.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { logger } from '../logger.js';

// In-memory store for sync job status (for demo/SRE dashboards).
// In production, persist to Redis or a dedicated SyncJob model.
interface SyncJobRecord {
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  synced: number;
  conflicts: number;
  failures: number;
  logs: string[];
}

const syncHistory: SyncJobRecord[] = [];
const MAX_HISTORY = 50;

export class BranchSyncController {
  // -------------------------------------------------------------------------
  // POST /branch-sync/sync
  // -------------------------------------------------------------------------
  public static async syncTransactions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions)) {
      return next(new ValidationError('An array of transactions is required.'));
    }

    const jobId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job: SyncJobRecord = {
      jobId,
      startedAt: new Date(),
      status: 'RUNNING',
      synced: 0,
      conflicts: 0,
      failures: 0,
      logs: [],
    };
    syncHistory.unshift(job);
    if (syncHistory.length > MAX_HISTORY) syncHistory.pop();

    try {
      for (const tx of transactions) {
        // 1. Conflict detection
        const existingTx = await Transaction.findOne({ transactionNumber: tx.transactionNumber });
        if (existingTx) {
          job.conflicts++;
          job.logs.push(`Conflict: Transaction [${tx.transactionNumber}] already exists. Skipped.`);
          continue;
        }

        // 2. Validate stock availability
        let stockAvailable = true;
        for (const item of tx.items ?? []) {
          const product = await Product.findById(item.productId);
          if (!product || product.quantity < item.quantity) {
            stockAvailable = false;
            job.logs.push(
              `Failure: Insufficient stock for product [${item.productId}] in [${tx.transactionNumber}].`
            );
            break;
          }
        }

        if (!stockAvailable) {
          job.failures++;
          continue;
        }

        // 3. Deduct inventory
        for (const item of tx.items ?? []) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity = Math.max(0, product.quantity - item.quantity);
            await product.save();
          }
        }

        // 4. Persist transaction
        const syncedTx = await Transaction.create({
          transactionNumber: tx.transactionNumber,
          type: tx.type || 'SALE',
          status: 'COMPLETED',
          items: tx.items,
          subtotal: tx.subtotal,
          tax: tx.tax || 0,
          discount: tx.discount || 0,
          total: tx.total,
          paymentMethod: tx.paymentMethod || 'CASH',
          cashierId: tx.cashierId || req.user?.id,
          cashierName: tx.cashierName || 'Offline Cashier',
          branchId: tx.branchId,
          branchName: tx.branchName || 'Offline Branch',
          customerEmail: tx.customerEmail,
        });

        await Receipt.create({
          transactionId: syncedTx._id,
          transactionNumber: syncedTx.transactionNumber,
          customerEmail: syncedTx.customerEmail,
          branchId: syncedTx.branchId,
          cashierId: syncedTx.cashierId,
          data: {
            transactionNumber: syncedTx.transactionNumber,
            items: syncedTx.items,
            subtotal: syncedTx.subtotal,
            tax: syncedTx.tax,
            discount: syncedTx.discount,
            total: syncedTx.total,
            paymentMethod: syncedTx.paymentMethod,
            cashierName: syncedTx.cashierName,
            branchName: syncedTx.branchName,
            customerEmail: syncedTx.customerEmail,
            createdAt: syncedTx.createdAt,
          },
        });

        await AuditLog.create({
          userId: req.user?.id,
          action: 'CREATE',
          targetModel: 'Transaction',
          targetId: syncedTx._id.toString(),
          newValues: syncedTx.toObject(),
        });

        job.synced++;
        job.logs.push(`Synced: Transaction [${tx.transactionNumber}] committed.`);
      }

      job.status = 'COMPLETED';
      job.completedAt = new Date();
      logger.info(
        `[BranchSync] Job ${jobId}: synced=${job.synced}, conflicts=${job.conflicts}, failures=${job.failures}`
      );

      res.json({
        jobId,
        synced: job.synced,
        conflicts: job.conflicts,
        failures: job.failures,
        logs: job.logs,
      });
    } catch (err: unknown) {
      job.status = 'FAILED';
      job.completedAt = new Date();
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /branch-sync/status
  // -------------------------------------------------------------------------
  public static async getSyncStatus(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const totalSynced = await Transaction.countDocuments({ status: 'COMPLETED' });
      const recentJobs = syncHistory.slice(0, 10);

      const summary = recentJobs.reduce(
        (acc, job) => {
          acc.totalSynced += job.synced;
          acc.totalConflicts += job.conflicts;
          acc.totalFailures += job.failures;
          return acc;
        },
        { totalSynced: 0, totalConflicts: 0, totalFailures: 0 }
      );

      res.json({
        dbTransactionCount: totalSynced,
        recentJobs,
        ...summary,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // POST /branch-sync/retry/:jobId
  // Marks a FAILED job for retry (triggers re-sync from the client).
  // -------------------------------------------------------------------------
  public static async retryFailedSync(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { jobId } = req.params;
    try {
      const job = syncHistory.find((j) => j.jobId === jobId);
      if (!job) return next(new NotFoundError(`Sync job [${jobId}] not found in history.`));
      if (job.status !== 'FAILED') {
        return next(
          new ValidationError(`Job [${jobId}] is not in FAILED state (current: ${job.status}).`)
        );
      }

      // Reset for retry (client must re-submit transactions)
      job.status = 'RUNNING';
      job.logs.push(
        `[${new Date().toISOString()}] Retry requested by ${req.user?.username || req.user?.id}`
      );

      res.json({
        success: true,
        jobId,
        message: 'Job flagged for retry. Client should re-submit transactions.',
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /branch-sync/lookup?sku=<sku>
  // -------------------------------------------------------------------------
  public static async crossBranchLookup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { sku } = req.query;
    if (!sku) return next(new ValidationError('Product SKU is required for lookups.'));

    try {
      const product = await Product.findOne({ sku: String(sku).toUpperCase() });
      if (!product) return next(new NotFoundError('Product not found in system catalog.'));

      const { InventoryLocation } = await import('../models/InventoryLocation.js');
      const warehouses = await Warehouse.find().populate('branchId', 'name code');

      // Aggregate real on-hand stock per warehouse from InventoryLocation ledger
      const locationStocks = await InventoryLocation.find({ productId: product._id });
      const warehouseStockMap = new Map<string, number>();
      for (const loc of locationStocks) {
        if (loc.warehouseId) {
          const wId = loc.warehouseId.toString();
          warehouseStockMap.set(
            wId,
            (warehouseStockMap.get(wId) || 0) + (loc.availableQuantity ?? loc.quantity ?? 0)
          );
        }
      }

      const stockLocations = warehouses.map((w) => {
        const allocatedStock = warehouseStockMap.get(w._id.toString());
        return {
          warehouseId: w._id,
          warehouseName: w.name,
          warehouseCode: w.code,
          branchName: (w.branchId as unknown as { name: string })?.name || 'HQ Branch',
          availableStock:
            allocatedStock !== undefined
              ? allocatedStock
              : warehouses.length === 1
                ? product.quantity
                : 0,
        };
      });

      res.json({
        sku: product.sku,
        name: product.name,
        totalAvailable: product.quantity,
        locations: stockLocations,
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
