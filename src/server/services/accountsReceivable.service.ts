import mongoose from 'mongoose';
import {
  AccountsReceivable,
  type AgingBucket,
  type IAccountsReceivable,
} from '../models/AccountsReceivable.js';
import { Customer } from '../models/Customer.js';
import { FinanceService } from './finance.service.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface CreateReceivablePayload {
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: Date;
  currency?: string;
  tenantId?: string;
  branchId?: string;
}

export interface RecordCustomerPaymentPayload {
  receivableId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  tenantId?: string;
  userId?: string;
}

export class AccountsReceivableService {
  /**
   * 1. Create or Record an Account Receivable (Customer Credit Sale)
   */
  public static async createReceivable(
    payload: CreateReceivablePayload
  ): Promise<IAccountsReceivable> {
    return await ResilientExecutor.execute(
      { name: `AR-Create-${payload.invoiceNumber}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';

        // Check Customer Credit Limit
        const customer = await Customer.findById(payload.customerId);
        if (customer && (customer as any).creditLimit) {
          const outstandingTotal = await this.getCustomerOutstandingBalance(
            payload.customerId,
            tenantId
          );
          const newExposure = outstandingTotal + payload.totalAmount;
          if (newExposure > (customer as any).creditLimit) {
            logger.warn(
              `[AR] Customer ${payload.customerName} credit limit (${(customer as any).creditLimit}) exceeded by exposure (${newExposure})`
            );
          }
        }

        const aging = this.computeAgingBucket(new Date(), payload.dueDate);

        const ar = await AccountsReceivable.create({
          tenantId,
          customerId: new mongoose.Types.ObjectId(payload.customerId),
          customerName: payload.customerName,
          invoiceId:
            payload.invoiceId && mongoose.isValidObjectId(payload.invoiceId)
              ? new mongoose.Types.ObjectId(payload.invoiceId)
              : undefined,
          invoiceNumber: payload.invoiceNumber,
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
          `[AR] Created Receivable ${ar.invoiceNumber} for customer ${ar.customerName} ($${ar.totalAmount})`
        );
        return ar;
      }
    );
  }

  /**
   * 2. Record Customer Payment & Post Double-Entry Journal
   * Debit: Cash (1000) / Bank (1010)
   * Credit: Accounts Receivable (1200)
   */
  public static async recordCustomerPayment(payload: RecordCustomerPaymentPayload) {
    return await ResilientExecutor.execute(
      { name: `AR-Payment-${payload.receivableId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const ar = await AccountsReceivable.findById(payload.receivableId);

        if (!ar) {
          throw new Error(`Accounts Receivable ${payload.receivableId} not found.`);
        }

        if (payload.amount <= 0) {
          throw new Error('Payment amount must be greater than zero.');
        }

        if (payload.amount > ar.balanceDue) {
          throw new Error(
            `Payment amount ($${payload.amount}) exceeds outstanding balance ($${ar.balanceDue}).`
          );
        }

        const newPaidAmount = ar.paidAmount + payload.amount;
        const newBalanceDue = ar.balanceDue - payload.amount;
        const newStatus = newBalanceDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        // Post Journal Entry
        const paymentAccountCode = payload.paymentMethod === 'CASH' ? '1000' : '1010';
        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `Customer Debt Payment - Invoice ${ar.invoiceNumber} (${ar.customerName})`,
          source: 'CUSTOMER_PAYMENT',
          referenceId: ar._id.toString(),
          userId: payload.userId,
          lines: [
            {
              accountCode: paymentAccountCode,
              debit: payload.amount,
              credit: 0,
              memo: `Payment from ${ar.customerName} (${payload.reference || 'Direct'})`,
            },
            {
              accountCode: '1200', // Accounts Receivable
              debit: 0,
              credit: payload.amount,
              memo: `AR reduction for invoice ${ar.invoiceNumber}`,
            },
          ],
        });

        ar.paidAmount = parseFloat(newPaidAmount.toFixed(2));
        ar.balanceDue = parseFloat(Math.max(0, newBalanceDue).toFixed(2));
        ar.status = newStatus;
        ar.payments.push({
          paymentId: `PAY-AR-${Date.now()}`,
          amount: payload.amount,
          paymentDate: new Date(),
          paymentMethod: payload.paymentMethod,
          reference: payload.reference,
          notes: payload.notes,
          journalEntryId: journal._id as any,
        });

        await ar.save();

        logger.info(
          `[AR] Recorded payment of $${payload.amount} on invoice ${ar.invoiceNumber}. Remaining: $${ar.balanceDue}`
        );
        return { ar, journal };
      }
    );
  }

  /**
   * 3. Compute Accounts Receivable Aging Breakdown
   */
  public static async getAgingReport(tenantId = 'default') {
    const receivables = await AccountsReceivable.find({
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

    const categorizedList = receivables.map((r) => {
      const bucket = this.computeAgingBucket(now, r.dueDate);
      const balance = r.balanceDue || 0;

      if (bucket === 'CURRENT') summary.current += balance;
      else if (bucket === '1-30_DAYS') summary.days1_30 += balance;
      else if (bucket === '31-60_DAYS') summary.days31_60 += balance;
      else if (bucket === '61-90_DAYS') summary.days61_90 += balance;
      else summary.days90Plus += balance;

      summary.totalOutstanding += balance;

      return {
        ...r,
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
      receivables: categorizedList,
    };
  }

  /**
   * Helper: Calculate total outstanding balance for customer
   */
  public static async getCustomerOutstandingBalance(
    customerId: string,
    tenantId = 'default'
  ): Promise<number> {
    const records = await AccountsReceivable.find({
      tenantId,
      customerId: new mongoose.Types.ObjectId(customerId),
      status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    }).lean();

    return records.reduce((sum, r) => sum + (r.balanceDue || 0), 0);
  }

  /**
   * Helper: Compute Aging Bucket from due date
   */
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
