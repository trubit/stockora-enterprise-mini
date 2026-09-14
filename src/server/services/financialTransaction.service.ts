import mongoose from 'mongoose';
import { FinanceService } from './finance.service.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { FinancialTransaction } from '../models/FinancialTransaction.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface SaleRecordedEventPayload {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  cogsAmount?: number;
  paymentMethod: 'CASH' | 'CARD' | 'PAYSTACK' | 'CUSTOMER_CREDIT' | 'SPLIT' | 'OTHER';
  channel?: 'POS' | 'ONLINE' | 'B2B' | 'WHOLESALE';
  branchId?: string;
  customerId?: string;
  tenantId?: string;
  userId?: string;
}

export interface RefundRecordedEventPayload {
  refundId: string;
  orderNumber: string;
  refundAmount: number;
  taxRefundAmount?: number;
  restockCogsAmount?: number;
  paymentMethod: string;
  reason: string;
  branchId?: string;
  tenantId?: string;
  userId?: string;
}

export interface PurchaseRecordedEventPayload {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  landedCostAmount?: number;
  taxAmount?: number;
  branchId?: string;
  tenantId?: string;
  userId?: string;
}

export interface InventoryAdjustmentEventPayload {
  adjustmentId: string;
  reason: 'DAMAGE' | 'SPOILAGE' | 'CYCLE_COUNT_GAIN' | 'CYCLE_COUNT_LOSS' | 'THEFT' | 'OTHER';
  costValuation: number;
  type: 'INCREASE' | 'DECREASE';
  branchId?: string;
  tenantId?: string;
  userId?: string;
}

export class FinancialTransactionService {
  /**
   * 1. Handle Sale Event (POS / E-Commerce / B2B)
   * Debit: Cash (1000) / Bank (1010) / Gateway (1030) / AR (1200)
   * Credit: Revenue (4000/4100/4200) + Tax Payable (2100)
   * If COGS exists:
   * Debit: COGS (5000)
   * Credit: Inventory (1300)
   */
  public static async recordSaleTransaction(payload: SaleRecordedEventPayload) {
    return await ResilientExecutor.execute(
      { name: `Financial-Sale-${payload.orderId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';

        // Check idempotency: avoid duplicate journal postings for the same order
        const existing = await JournalEntry.findOne({
          tenantId,
          source: 'SALE',
          referenceId: payload.orderId,
          status: { $ne: 'REVERSED' },
        });

        if (existing) {
          logger.info(
            `[FinancialTransaction] Sale ${payload.orderNumber} already posted in JE ${existing.entryNumber}`
          );
          return existing;
        }

        const lines: any[] = [];
        const paymentAccountCode =
          payload.paymentMethod === 'CASH'
            ? '1020' // POS Cash Drawer Float
            : payload.paymentMethod === 'CUSTOMER_CREDIT'
              ? '1200' // Accounts Receivable
              : payload.paymentMethod === 'PAYSTACK'
                ? '1030' // Gateway Settlement
                : '1010'; // Operating Bank Account

        // 1. Debit Cash/Bank/AR for total collected
        lines.push({
          accountCode: paymentAccountCode,
          debit: payload.totalAmount,
          credit: 0,
          memo: `Payment collected for Order ${payload.orderNumber}`,
          branchId: payload.branchId,
        });

        // 2. Contra-revenue for Discounts if any
        if (payload.discountAmount && payload.discountAmount > 0) {
          lines.push({
            accountCode: '4900', // Sales Discounts
            debit: payload.discountAmount,
            credit: 0,
            memo: `Promotional discount for Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
        }

        // 3. Credit Revenue
        const revenueAccountCode =
          payload.channel === 'ONLINE'
            ? '4100'
            : payload.channel === 'B2B' || payload.channel === 'WHOLESALE'
              ? '4200'
              : '4000'; // POS Retail

        const grossRevenueCredit =
          (payload.subtotal || payload.totalAmount) + (payload.discountAmount || 0);

        lines.push({
          accountCode: revenueAccountCode,
          debit: 0,
          credit: grossRevenueCredit,
          memo: `Gross revenue for Order ${payload.orderNumber}`,
          branchId: payload.branchId,
        });

        // 4. Credit Tax Payable if tax exists
        if (payload.taxAmount && payload.taxAmount > 0) {
          lines.push({
            accountCode: '2100', // Tax Payable
            debit: 0,
            credit: payload.taxAmount,
            memo: `Sales tax collected for Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
        }

        // 5. COGS & Inventory Asset movement
        if (payload.cogsAmount && payload.cogsAmount > 0) {
          lines.push({
            accountCode: '5000', // Cost of Goods Sold
            debit: payload.cogsAmount,
            credit: 0,
            memo: `COGS for Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
          lines.push({
            accountCode: '1300', // Inventory Asset
            debit: 0,
            credit: payload.cogsAmount,
            memo: `Inventory reduction for Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
        }

        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Sale Order ${payload.orderNumber} (${payload.channel || 'POS'})`,
          source: 'SALE',
          referenceId: payload.orderId,
          branchId: payload.branchId,
          userId: payload.userId,
          lines,
        });

        // Record FinancialTransaction audit log
        await FinancialTransaction.create({
          tenantId,
          transactionNumber: `FTX-SALE-${Date.now()}`,
          type: 'INCOME',
          category: 'SALES_REVENUE',
          amount: payload.totalAmount,
          currency: 'USD',
          source: 'SALE',
          referenceId: payload.orderId,
          paymentMethod: payload.paymentMethod,
          status: 'COMPLETED',
          journalEntryId: journal._id,
        });

        return journal;
      }
    );
  }

  /**
   * 2. Handle Refund Event
   * Debit: Sales Returns (4950) + Tax Payable (2100)
   * Credit: Cash (1020) / Bank (1010) / Gateway (1030)
   * If inventory restocked:
   * Debit: Inventory (1300)
   * Credit: COGS (5000)
   */
  public static async recordRefundTransaction(payload: RefundRecordedEventPayload) {
    return await ResilientExecutor.execute(
      { name: `Financial-Refund-${payload.refundId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';

        const existing = await JournalEntry.findOne({
          tenantId,
          source: 'REFUND',
          referenceId: payload.refundId,
          status: { $ne: 'REVERSED' },
        });

        if (existing) return existing;

        const lines: any[] = [];
        const netRefundExclTax = payload.refundAmount - (payload.taxRefundAmount || 0);

        // 1. Debit Sales Returns (Contra-Revenue)
        lines.push({
          accountCode: '4950',
          debit: Math.max(0, netRefundExclTax),
          credit: 0,
          memo: `Refund item return for Order ${payload.orderNumber}: ${payload.reason}`,
          branchId: payload.branchId,
        });

        // 2. Debit Tax Payable reduction
        if (payload.taxRefundAmount && payload.taxRefundAmount > 0) {
          lines.push({
            accountCode: '2100',
            debit: payload.taxRefundAmount,
            credit: 0,
            memo: `Tax reduction for refunded Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
        }

        // 3. Credit Cash/Bank/Gateway
        const paymentAccountCode =
          payload.paymentMethod === 'CASH'
            ? '1020'
            : payload.paymentMethod === 'PAYSTACK'
              ? '1030'
              : '1010';

        lines.push({
          accountCode: paymentAccountCode,
          debit: 0,
          credit: payload.refundAmount,
          memo: `Refund disbursement for Order ${payload.orderNumber}`,
          branchId: payload.branchId,
        });

        // 4. Inventory restock movement
        if (payload.restockCogsAmount && payload.restockCogsAmount > 0) {
          lines.push({
            accountCode: '1300', // Inventory Asset
            debit: payload.restockCogsAmount,
            credit: 0,
            memo: `Restocked returned inventory for Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
          lines.push({
            accountCode: '5000', // COGS reduction
            debit: 0,
            credit: payload.restockCogsAmount,
            memo: `COGS credit for returned goods from Order ${payload.orderNumber}`,
            branchId: payload.branchId,
          });
        }

        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Customer Refund for Order ${payload.orderNumber}`,
          source: 'REFUND',
          referenceId: payload.refundId,
          branchId: payload.branchId,
          userId: payload.userId,
          lines,
        });

        await FinancialTransaction.create({
          tenantId,
          transactionNumber: `FTX-REFUND-${Date.now()}`,
          type: 'EXPENSE',
          category: 'REFUND',
          amount: payload.refundAmount,
          currency: 'USD',
          source: 'REFUND',
          referenceId: payload.refundId,
          paymentMethod: payload.paymentMethod,
          status: 'COMPLETED',
          journalEntryId: journal._id,
        });

        return journal;
      }
    );
  }

  /**
   * 3. Handle Procurement Purchase (Receipt & 3-Way Match)
   * Debit: Inventory Asset (1300)
   * Credit: Accounts Payable (2000)
   */
  public static async recordPurchaseTransaction(payload: PurchaseRecordedEventPayload) {
    return await ResilientExecutor.execute(
      { name: `Financial-Purchase-${payload.purchaseOrderId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';

        const existing = await JournalEntry.findOne({
          tenantId,
          source: 'PURCHASE',
          referenceId: payload.purchaseOrderId,
          status: { $ne: 'REVERSED' },
        });

        if (existing) return existing;

        const lines: any[] = [];

        // 1. Debit Inventory Asset
        lines.push({
          accountCode: '1300',
          debit: payload.totalAmount,
          credit: 0,
          memo: `Inventory received PO ${payload.poNumber} from ${payload.supplierName}`,
          branchId: payload.branchId,
        });

        // 2. Credit Accounts Payable
        lines.push({
          accountCode: '2000',
          debit: 0,
          credit: payload.totalAmount,
          memo: `Obligation to supplier ${payload.supplierName} (PO ${payload.poNumber})`,
          branchId: payload.branchId,
        });

        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Procurement Goods Receipt PO ${payload.poNumber} (${payload.supplierName})`,
          source: 'PURCHASE',
          referenceId: payload.purchaseOrderId,
          branchId: payload.branchId,
          userId: payload.userId,
          lines,
        });

        return journal;
      }
    );
  }

  /**
   * 4. Handle Inventory Adjustments (Spoilage / Count Variance)
   * Increase: Debit Inventory (1300), Credit Inventory Gain (5200)
   * Decrease: Debit Shrinkage Write-Off (5200), Credit Inventory (1300)
   */
  public static async recordInventoryAdjustmentTransaction(
    payload: InventoryAdjustmentEventPayload
  ) {
    return await ResilientExecutor.execute(
      { name: `Financial-InvAdj-${payload.adjustmentId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const lines: any[] = [];

        if (payload.type === 'DECREASE') {
          // Shrinkage Loss
          lines.push({
            accountCode: '5200', // Inventory Shrinkage Write-Off
            debit: payload.costValuation,
            credit: 0,
            memo: `Inventory adjustment write-off: ${payload.reason}`,
            branchId: payload.branchId,
          });
          lines.push({
            accountCode: '1300', // Inventory Asset
            debit: 0,
            credit: payload.costValuation,
            memo: `Inventory count deduction (${payload.reason})`,
            branchId: payload.branchId,
          });
        } else {
          // Gain
          lines.push({
            accountCode: '1300', // Inventory Asset
            debit: payload.costValuation,
            credit: 0,
            memo: `Inventory count gain (${payload.reason})`,
            branchId: payload.branchId,
          });
          lines.push({
            accountCode: '5200', // COGS Reduction / Gain
            debit: 0,
            credit: payload.costValuation,
            memo: `Inventory gain credit (${payload.reason})`,
            branchId: payload.branchId,
          });
        }

        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Inventory Count Adjustment (${payload.reason})`,
          source: 'INVENTORY_ADJUSTMENT',
          referenceId: payload.adjustmentId,
          branchId: payload.branchId,
          userId: payload.userId,
          lines,
        });

        return journal;
      }
    );
  }

  /**
   * 5. Register Global Event Handlers
   */
  public static registerEventHandlers() {
    eventBus.on('sale.recorded', async (payload: SaleRecordedEventPayload) => {
      try {
        await this.recordSaleTransaction(payload);
      } catch (err) {
        logger.error('[FinancialTransaction] Error recording sale event:', err);
      }
    });

    eventBus.on('refund.recorded', async (payload: RefundRecordedEventPayload) => {
      try {
        await this.recordRefundTransaction(payload);
      } catch (err) {
        logger.error('[FinancialTransaction] Error recording refund event:', err);
      }
    });

    eventBus.on('purchase.recorded', async (payload: PurchaseRecordedEventPayload) => {
      try {
        await this.recordPurchaseTransaction(payload);
      } catch (err) {
        logger.error('[FinancialTransaction] Error recording purchase event:', err);
      }
    });

    eventBus.on('inventory.adjusted', async (payload: InventoryAdjustmentEventPayload) => {
      try {
        await this.recordInventoryAdjustmentTransaction(payload);
      } catch (err) {
        logger.error('[FinancialTransaction] Error recording inventory adjustment event:', err);
      }
    });

    logger.info('[FinancialTransactionService] Registered financial event bus listeners.');
  }
}
