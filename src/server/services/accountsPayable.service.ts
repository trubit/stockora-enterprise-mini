import mongoose from 'mongoose';
import { AccountsPayable, type IAccountsPayable } from '../models/AccountsPayable.js';
import type { AgingBucket } from '../models/AccountsReceivable.js';
import { FinanceService } from './finance.service.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface CreatePayablePayload {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  supplierInvoiceId?: string;
  purchaseOrderId?: string;
  totalAmount: number;
  dueDate: Date;
  currency?: string;
  tenantId?: string;
  branchId?: string;
}

export interface RecordSupplierDisbursementPayload {
  payableId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  tenantId?: string;
  userId?: string;
}

export class AccountsPayableService {
  /**
   * 1. Create Account Payable (Supplier Obligation)
   */
  public static async createPayable(payload: CreatePayablePayload): Promise<IAccountsPayable> {
    return await ResilientExecutor.execute(
      { name: `AP-Create-${payload.invoiceNumber}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const aging = this.computeAgingBucket(new Date(), payload.dueDate);

        const ap = await AccountsPayable.create({
          tenantId,
          supplierId: new mongoose.Types.ObjectId(payload.supplierId),
          supplierName: payload.supplierName,
          invoiceNumber: payload.invoiceNumber,
          supplierInvoiceId:
            payload.supplierInvoiceId && mongoose.isValidObjectId(payload.supplierInvoiceId)
              ? new mongoose.Types.ObjectId(payload.supplierInvoiceId)
              : undefined,
          purchaseOrderId:
            payload.purchaseOrderId && mongoose.isValidObjectId(payload.purchaseOrderId)
              ? new mongoose.Types.ObjectId(payload.purchaseOrderId)
              : undefined,
          totalAmount: payload.totalAmount,
          paidAmount: 0,
          balanceDue: payload.totalAmount,
          currency: payload.currency || 'USD',
          issueDate: new Date(),
          dueDate: payload.dueDate,
          agingBucket: aging,
          status: 'UNPAID',
        });

        logger.info(
          `[AP] Created Payable ${ap.invoiceNumber} for supplier ${ap.supplierName} ($${ap.totalAmount})`
        );
        return ap;
      }
    );
  }

  /**
   * 2. Record Supplier Payment Disbursement & Post Double-Entry Journal
   * Debit: Accounts Payable (2000)
   * Credit: Bank Account (1010) / Cash (1000)
   */
  public static async recordSupplierDisbursement(payload: RecordSupplierDisbursementPayload) {
    return await ResilientExecutor.execute(
      { name: `AP-Disbursement-${payload.payableId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const ap = await AccountsPayable.findById(payload.payableId);

        if (!ap) {
          throw new Error(`Accounts Payable ${payload.payableId} not found.`);
        }

        if (payload.amount <= 0) {
          throw new Error('Disbursement amount must be greater than zero.');
        }

        if (payload.amount > ap.balanceDue) {
          throw new Error(
            `Disbursement amount ($${payload.amount}) exceeds outstanding supplier balance ($${ap.balanceDue}).`
          );
        }

        const newPaidAmount = ap.paidAmount + payload.amount;
        const newBalanceDue = ap.balanceDue - payload.amount;
        const newStatus = newBalanceDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        const paymentAccountCode = payload.paymentMethod === 'CASH' ? '1000' : '1010';
        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Supplier Invoice Settlement - ${ap.invoiceNumber} (${ap.supplierName})`,
          source: 'SUPPLIER_PAYMENT',
          referenceId: ap._id.toString(),
          userId: payload.userId,
          lines: [
            {
              accountCode: '2000', // Accounts Payable
              debit: payload.amount,
              credit: 0,
              memo: `Settlement for invoice ${ap.invoiceNumber}`,
            },
            {
              accountCode: paymentAccountCode,
              debit: 0,
              credit: payload.amount,
              memo: `Disbursement to ${ap.supplierName} (${payload.reference || 'Bank Transfer'})`,
            },
          ],
        });

        ap.paidAmount = parseFloat(newPaidAmount.toFixed(2));
        ap.balanceDue = parseFloat(Math.max(0, newBalanceDue).toFixed(2));
        ap.status = newStatus;
        ap.payments.push({
          paymentId: `DISB-AP-${Date.now()}`,
          amount: payload.amount,
          paymentDate: new Date(),
          paymentMethod: payload.paymentMethod,
          reference: payload.reference,
          notes: payload.notes,
          journalEntryId: journal._id as any,
        });

        await ap.save();

        logger.info(
          `[AP] Settled $${payload.amount} on supplier invoice ${ap.invoiceNumber}. Remaining: $${ap.balanceDue}`
        );
        return { ap, journal };
      }
    );
  }

  /**
   * 3. Compute Accounts Payable Aging Breakdown
   */
  public static async getAgingReport(tenantId = 'default') {
    const payables = await AccountsPayable.find({
      tenantId,
      status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    }).lean();

    const now = new Date();
    const summary = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      totalOutstanding: 0,
    };

    const categorizedList = payables.map((p) => {
      const bucket = this.computeAgingBucket(now, p.dueDate);
      const balance = p.balanceDue || 0;

      if (bucket === 'CURRENT') summary.current += balance;
      else if (bucket === '1-30_DAYS') summary.days1_30 += balance;
      else if (bucket === '31-60_DAYS') summary.days31_60 += balance;
      else if (bucket === '61-90_DAYS') summary.days61_90 += balance;
      else summary.days90Plus += balance;

      summary.totalOutstanding += balance;

      return {
        ...p,
        currentBucket: bucket,
      };
    });

    return {
      tenantId,
      summary: {
        current: parseFloat(summary.current.toFixed(2)),
        days1_30: parseFloat(summary.days1_30.toFixed(2)),
        days31_60: parseFloat(summary.days31_60.toFixed(2)),
        days61_90: parseFloat(summary.days61_90.toFixed(2)),
        days90Plus: parseFloat(summary.days90Plus.toFixed(2)),
        totalOutstanding: parseFloat(summary.totalOutstanding.toFixed(2)),
      },
      payables: categorizedList,
    };
  }

  private static computeAgingBucket(now: Date, dueDate: Date): AgingBucket {
    const diffMs = now.getTime() - new Date(dueDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'CURRENT';
    if (diffDays <= 30) return '1-30_DAYS';
    if (diffDays <= 60) return '31-60_DAYS';
    if (diffDays <= 90) return '61-90_DAYS';
    return '90+_DAYS';
  }
}
