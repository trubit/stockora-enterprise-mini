import { TaxRate } from '../models/TaxRate.js';
import { TaxRecord } from '../models/TaxRecord.js';
import { BankTransaction } from '../models/BankTransaction.js';
import { FinancialTransaction } from '../models/FinancialTransaction.js';
import { PaymentReconciliation } from '../models/PaymentReconciliation.js';
import { logger } from '../logger.js';

export class TaxReconciliationService {
  /**
   * Calculates overall tax collected vs paid and tax liability balance.
   */
  public static async getTaxSummary(tenantId?: string) {
    const taxRecords = await TaxRecord.find({ tenantId: tenantId || null }).lean();

    let totalCollected = 0;
    let totalPaid = 0;
    let totalRefunded = 0;

    for (const r of taxRecords) {
      if (r.transactionType === 'COLLECTED') totalCollected += r.taxAmount || 0;
      else if (r.transactionType === 'PAID') totalPaid += r.taxAmount || 0;
      else if (r.transactionType === 'REFUNDED') totalRefunded += r.taxAmount || 0;
    }

    const netTaxLiability = totalCollected - totalPaid - totalRefunded;

    return {
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      netTaxLiability: Math.round(netTaxLiability * 100) / 100,
    };
  }

  /**
   * Automates bank statement reconciliation matching transactions against general ledger events.
   */
  public static async autoReconcileBank(bankAccountId: string, tenantId?: string) {
    const unmatchedBankTx = await BankTransaction.find({
      bankAccountId,
      status: 'UNMATCHED',
      tenantId: tenantId || null,
    });

    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const btx of unmatchedBankTx) {
      const match = await FinancialTransaction.findOne({
        amount: Math.abs(btx.amount),
        tenantId: tenantId || null,
        createdAt: {
          $gte: new Date(new Date(btx.transactionDate).getTime() - 86400000 * 2),
          $lte: new Date(new Date(btx.transactionDate).getTime() + 86400000 * 2),
        },
      });

      if (match) {
        btx.status = 'MATCHED';
        btx.matchedTransactionId = match._id as any;
        await btx.save();
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    const rec = await PaymentReconciliation.create({
      tenantId,
      reconciliationNumber: `REC-${Date.now()}`,
      statementDate: new Date(),
      bankAccountId,
      matchedCount,
      unmatchedCount,
      status: unmatchedCount === 0 ? 'MATCHED' : 'PARTIALLY_MATCHED',
    });

    logger.info(
      `[Reconciliation] Auto-reconciled bank account ${bankAccountId}: ${matchedCount} matched.`
    );
    return rec;
  }
}
