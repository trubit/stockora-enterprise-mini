import mongoose from 'mongoose';
import { BankAccount } from '../models/BankAccount.js';
import { PaymentReconciliation, type PaymentMatchStatus } from '../models/PaymentReconciliation.js';
import { RegisterSession } from '../models/RegisterSession.js';
import { FinanceService } from './finance.service.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface PaystackReconciliationPayload {
  gatewayProvider: 'PAYSTACK' | 'STRIPE' | 'FLUTTERWAVE';
  transactions: Array<{
    providerTransactionRef: string;
    orderNumber?: string;
    grossAmount: number;
    providerFee: number;
    netSettlementAmount: number;
    transactionDate: Date;
  }>;
  tenantId?: string;
  userId?: string;
}

export interface ReconcilePOSShiftPayload {
  sessionId: string;
  actualCashCounted: number;
  tenantId?: string;
  userId?: string;
}

export class CashManagementService {
  /**
   * 1. Get Enterprise Cash Position (Vault Cash, Operating Bank, POS Drawers, Gateway Clearing)
   */
  public static async getCashPosition(tenantId = 'default') {
    await FinanceService.initializeChartOfAccounts(tenantId);

    const [bankAccounts, registerSessions] = await Promise.all([
      BankAccount.find({ tenantId, isActive: true }).lean(),
      RegisterSession.find({ tenantId, status: 'OPEN' }).lean(),
    ]);

    const tb = await FinanceService.getTrialBalance(tenantId);
    const cashAndBankLines = tb.lines.filter((l) =>
      ['1000', '1010', '1020', '1030'].includes(l.accountCode)
    );

    const vaultCash = cashAndBankLines.find((l) => l.accountCode === '1000')?.balance || 0;
    const operatingBank = cashAndBankLines.find((l) => l.accountCode === '1010')?.balance || 0;
    const posDrawerCash = cashAndBankLines.find((l) => l.accountCode === '1020')?.balance || 0;
    const gatewayClearing = cashAndBankLines.find((l) => l.accountCode === '1030')?.balance || 0;

    const totalLiquidCash = vaultCash + operatingBank + posDrawerCash + gatewayClearing;

    return {
      tenantId,
      totalLiquidCash: parseFloat(totalLiquidCash.toFixed(2)),
      breakdown: {
        vaultCash: parseFloat(vaultCash.toFixed(2)),
        operatingBank: parseFloat(operatingBank.toFixed(2)),
        posDrawerCash: parseFloat(posDrawerCash.toFixed(2)),
        gatewayClearing: parseFloat(gatewayClearing.toFixed(2)),
      },
      bankAccounts,
      activePosDrawersCount: registerSessions.length,
      ledgerSummary: cashAndBankLines,
    };
  }

  /**
   * 2. Reconcile Paystack / Payment Gateway Batch Settlement
   * Reconciles Gross Payment, Gateway Fee (6400 Expense), and Net Settlement into Operating Bank (1010).
   * Debit: Bank Account (1010) [Net] + Merchant Processing Fee (6400) [Fee]
   * Credit: Gateway Clearing Asset (1030) [Gross]
   */
  public static async reconcileGatewaySettlement(payload: PaystackReconciliationPayload) {
    return await ResilientExecutor.execute(
      { name: `Reconcile-Gateway-${payload.gatewayProvider}-${Date.now()}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const reconciliationNumber = `REC-${payload.gatewayProvider}-${Date.now()}`;

        let totalGross = 0;
        let totalFee = 0;
        let totalNet = 0;
        let matchedCount = 0;
        let discrepancyCount = 0;

        const reconciliationLines: any[] = [];

        for (const tx of payload.transactions) {
          totalGross += tx.grossAmount;
          totalFee += tx.providerFee;
          totalNet += tx.netSettlementAmount;

          const calculatedNet = tx.grossAmount - tx.providerFee;
          const variance = Math.abs(calculatedNet - tx.netSettlementAmount);
          const isMatched = variance < 0.01;

          if (isMatched) matchedCount++;
          else discrepancyCount++;

          reconciliationLines.push({
            provider: payload.gatewayProvider,
            providerTransactionRef: tx.providerTransactionRef,
            orderNumber: tx.orderNumber,
            grossAmount: tx.grossAmount,
            providerFee: tx.providerFee,
            netSettlementAmount: tx.netSettlementAmount,
            systemAmount: calculatedNet,
            variance,
            status: isMatched ? 'MATCHED' : 'MISMATCHED',
            matchedAt: isMatched ? new Date() : undefined,
            mismatchReason: isMatched
              ? undefined
              : `Variance of $${variance} between gross minus fee and net settlement`,
          });
        }

        // Post Double-Entry Journal for Gateway Settlement
        const journal = await FinanceService.postJournalEntry({
          tenantId,
          description: `${payload.gatewayProvider} Batch Settlement Reconciliation (${payload.transactions.length} items)`,
          source: 'PAYMENT_RECONCILIATION',
          referenceId: reconciliationNumber,
          userId: payload.userId,
          lines: [
            {
              accountCode: '1010', // Operating Bank Account (Net received)
              debit: parseFloat(totalNet.toFixed(2)),
              credit: 0,
              memo: `Net payout deposit from ${payload.gatewayProvider}`,
            },
            {
              accountCode: '6400', // Payment Processing & Gateway Fees
              debit: parseFloat(totalFee.toFixed(2)),
              credit: 0,
              memo: `${payload.gatewayProvider} transaction commission fee`,
            },
            {
              accountCode: '1030', // Gateway Clearing Asset (Gross cleared)
              debit: 0,
              credit: parseFloat(totalGross.toFixed(2)),
              memo: `Gross clearing reduction for settlement ${reconciliationNumber}`,
            },
          ],
        });

        const overallStatus: PaymentMatchStatus =
          discrepancyCount === 0
            ? 'MATCHED'
            : matchedCount > 0
              ? 'PARTIALLY_MATCHED'
              : 'MISMATCHED';

        const record = await PaymentReconciliation.create({
          tenantId,
          reconciliationNumber,
          statementDate: new Date(),
          gatewayProvider: payload.gatewayProvider,
          totalTransactions: payload.transactions.length,
          totalGrossAmount: parseFloat(totalGross.toFixed(2)),
          totalFeeAmount: parseFloat(totalFee.toFixed(2)),
          totalNetSettlement: parseFloat(totalNet.toFixed(2)),
          matchedCount,
          unmatchedCount: 0,
          discrepancyCount,
          status: overallStatus,
          lines: reconciliationLines,
          reconciledBy:
            payload.userId && mongoose.isValidObjectId(payload.userId)
              ? new mongoose.Types.ObjectId(payload.userId)
              : undefined,
        });

        logger.info(
          `[CashManagement] Reconciled ${payload.gatewayProvider} settlement ${reconciliationNumber}: Net $${totalNet}, Fee $${totalFee}`
        );

        return { record, journal };
      }
    );
  }

  /**
   * 3. Reconcile POS Shift Close & Cash Drawer Float
   * If actual < expected: Debit Spoilage/Variance (5200), Credit POS Cash Drawer (1020)
   * If actual > expected: Debit POS Cash Drawer (1020), Credit Other Revenue (4900)
   */
  public static async reconcilePOSShift(payload: ReconcilePOSShiftPayload) {
    return await ResilientExecutor.execute(
      { name: `Reconcile-POS-Shift-${payload.sessionId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const session = await RegisterSession.findById(payload.sessionId);

        if (!session) {
          throw new Error(`Register Session ${payload.sessionId} not found.`);
        }

        const expectedCash = (session as any).expectedCash || (session as any).closingCash || 0;
        const variance = payload.actualCashCounted - expectedCash;

        if (Math.abs(variance) > 0.01) {
          if (variance < 0) {
            // Shortage
            const shortage = Math.abs(variance);
            await FinanceService.postJournalEntry({
              tenantId,
              description: `POS Register Shift Shortage (${session._id})`,
              source: 'POS_RECONCILIATION',
              referenceId: session._id.toString(),
              userId: payload.userId,
              lines: [
                {
                  accountCode: '5200', // Inventory & Cash Variance
                  debit: parseFloat(shortage.toFixed(2)),
                  credit: 0,
                  memo: `Cash drawer variance shortage for register ${session.registerId || 'POS'}`,
                },
                {
                  accountCode: '1020', // POS Cash Drawer Float
                  debit: 0,
                  credit: parseFloat(shortage.toFixed(2)),
                  memo: `Cash count deduction`,
                },
              ],
            });
          } else {
            // Overage
            await FinanceService.postJournalEntry({
              tenantId,
              description: `POS Register Shift Overage (${session._id})`,
              source: 'POS_RECONCILIATION',
              referenceId: session._id.toString(),
              userId: payload.userId,
              lines: [
                {
                  accountCode: '1020', // POS Cash Drawer Float
                  debit: parseFloat(variance.toFixed(2)),
                  credit: 0,
                  memo: `Cash drawer overage for register ${session.registerId || 'POS'}`,
                },
                {
                  accountCode: '4200', // Other Revenue
                  debit: 0,
                  credit: parseFloat(variance.toFixed(2)),
                  memo: `Cash count overage`,
                },
              ],
            });
          }
        }

        return {
          sessionId: payload.sessionId,
          expectedCash,
          actualCashCounted: payload.actualCashCounted,
          variance: parseFloat(variance.toFixed(2)),
          isBalanced: Math.abs(variance) < 0.01,
        };
      }
    );
  }
}
