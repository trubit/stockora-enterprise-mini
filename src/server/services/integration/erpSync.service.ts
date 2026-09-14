import { Transaction } from '../../models/Transaction.js';
import { logger } from '../../logger.js';

export interface ERPJournalEntry {
  date: string;
  reference: string;
  lines: Array<{
    accountCode: string;
    description: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
  }>;
}

export class ERPSyncService {
  /**
   * Translates a transaction list into standard bookkeeping double-entry lines
   */
  public static async buildJournalEntry(transactionId: string): Promise<ERPJournalEntry> {
    const tx = await Transaction.findById(transactionId);
    if (!tx) {
      throw new Error(`Transaction [${transactionId}] not found.`);
    }

    const dateStr = tx.createdAt
      ? new Date(tx.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const entry: ERPJournalEntry = {
      date: dateStr,
      reference: tx.transactionNumber,
      lines: [],
    };

    // Double-entry bookkeeping:
    // Debit: Cash or Bank account (asset increases)
    entry.lines.push({
      accountCode: tx.paymentMethod === 'CARD' ? '1200-BANK' : '1000-CASH',
      description: `Sales Inflow ref: ${tx.transactionNumber}`,
      amount: tx.total,
      type: 'DEBIT',
    });

    // Credit: Sales Revenue account (equity increases)
    entry.lines.push({
      accountCode: '4000-REVENUE',
      description: `Revenue ref: ${tx.transactionNumber}`,
      amount: tx.subtotal - tx.discount,
      type: 'CREDIT',
    });

    // Credit: Sales Tax liability account (liability increases)
    if (tx.tax > 0) {
      entry.lines.push({
        accountCode: '2200-TAX-LIABILITY',
        description: `Collected Sales Tax ref: ${tx.transactionNumber}`,
        amount: tx.tax,
        type: 'CREDIT',
      });
    }

    return entry;
  }

  public static async pushToQuickBooks(entry: ERPJournalEntry): Promise<boolean> {
    logger.info(`[QuickBooks integration] Journal entry dispatch ref: ${entry.reference}`);
    return true;
  }

  public static async pushToXero(entry: ERPJournalEntry): Promise<boolean> {
    logger.info(`[Xero integration] Journal entry dispatch ref: ${entry.reference}`);
    return true;
  }
}
