import { AccountsReceivable, type AgingBucket } from '../models/AccountsReceivable.js';
import { AccountsPayable } from '../models/AccountsPayable.js';
import { Invoice } from '../models/Invoice.js';
import { FinanceService } from './finance.service.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';

export class ARAPService {
  /**
   * Recalculates aging buckets for all active AR and AP records.
   */
  public static async recalculateAging(
    tenantId?: string
  ): Promise<{ arUpdated: number; apUpdated: number }> {
    const now = Date.now();

    const arRecords = await AccountsReceivable.find({
      status: { $ne: 'PAID' },
      tenantId: tenantId || null,
    });

    let arUpdated = 0;
    for (const ar of arRecords) {
      const daysOverdue = Math.floor(
        (now - new Date(ar.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      let bucket: AgingBucket = 'CURRENT';

      if (daysOverdue > 90) bucket = '90+_DAYS';
      else if (daysOverdue > 60) bucket = '61-90_DAYS';
      else if (daysOverdue > 30) bucket = '31-60_DAYS';
      else if (daysOverdue > 0) bucket = '1-30_DAYS';

      if (daysOverdue > 0 && ar.status !== 'OVERDUE') {
        ar.status = 'OVERDUE';
      }

      ar.agingBucket = bucket;
      await ar.save();
      arUpdated++;
    }

    const apRecords = await AccountsPayable.find({
      status: { $ne: 'PAID' },
      tenantId: tenantId || null,
    });

    let apUpdated = 0;
    for (const ap of apRecords) {
      const daysOverdue = Math.floor(
        (now - new Date(ap.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      let bucket: AgingBucket = 'CURRENT';

      if (daysOverdue > 90) bucket = '90+_DAYS';
      else if (daysOverdue > 60) bucket = '61-90_DAYS';
      else if (daysOverdue > 30) bucket = '31-60_DAYS';
      else if (daysOverdue > 0) bucket = '1-30_DAYS';

      if (daysOverdue > 0 && ap.status !== 'OVERDUE') {
        ap.status = 'OVERDUE';
      }

      ap.agingBucket = bucket;
      await ap.save();
      apUpdated++;
    }

    logger.info(
      `[AR/AP Service] Recalculated Aging. AR records updated: ${arUpdated}, AP records: ${apUpdated}`
    );
    return { arUpdated, apUpdated };
  }

  /**
   * Records payment against customer Invoice / Accounts Receivable.
   */
  public static async recordARPayment(payload: {
    invoiceId: string;
    amountPaid: number;
    paymentMethod?: string;
    tenantId?: string;
  }) {
    const ar = await AccountsReceivable.findOne({
      invoiceId: payload.invoiceId,
      tenantId: payload.tenantId || null,
    });
    if (!ar) throw new Error(`Accounts Receivable for invoice ${payload.invoiceId} not found.`);

    ar.paidAmount += payload.amountPaid;
    ar.balanceDue = Math.max(ar.totalAmount - ar.paidAmount, 0);

    if (ar.balanceDue === 0) {
      ar.status = 'PAID';
    } else {
      ar.status = 'PARTIALLY_PAID';
    }
    await ar.save();

    // Update Invoice entity
    const invoice = await Invoice.findById(payload.invoiceId);
    if (invoice) {
      invoice.paidAmount = ar.paidAmount;
      invoice.balanceDue = ar.balanceDue;
      invoice.status = ar.status as any;
      await invoice.save();
    }

    // Post to General Ledger: Debit Cash (1000), Credit Accounts Receivable (1200)
    await FinanceService.postJournalEntry({
      description: `Customer Invoice Payment: ${ar.invoiceNumber}`,
      source: 'AR_PAYMENT',
      referenceId: ar.invoiceNumber,
      currency: ar.currency,
      lines: [
        { accountCode: '1000', debit: payload.amountPaid, credit: 0, memo: payload.paymentMethod },
        { accountCode: '1200', debit: 0, credit: payload.amountPaid, memo: ar.customerName },
      ],
      tenantId: payload.tenantId,
    });

    eventBus.emit('finance.payment.received', {
      invoiceNumber: ar.invoiceNumber,
      amount: payload.amountPaid,
      balanceRemaining: ar.balanceDue,
    });

    return ar;
  }
}
