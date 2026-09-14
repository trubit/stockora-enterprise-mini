import mongoose from 'mongoose';
import { RegisterSession, type IRegisterSession } from '../models/RegisterSession.js';
import { Transaction } from '../models/Transaction.js';
import { logger } from '../logger.js';

export class RegisterSessionService {
  /**
   * Open a new register shift session
   */
  public static async openRegister(
    registerId: string,
    registerName: string,
    branchId: string,
    cashierId: string,
    cashierName: string,
    openingFloat: number,
    tenantId?: string
  ): Promise<IRegisterSession> {
    const existing = await RegisterSession.findOne({
      ...(tenantId ? { tenantId } : {}),
      registerId,
      status: 'OPEN',
    });
    if (existing) {
      throw new Error(`Register ${registerName} (${registerId}) is already open.`);
    }

    const session = await RegisterSession.create({
      tenantId,
      registerId,
      registerName,
      branchId: new mongoose.Types.ObjectId(branchId),
      cashierId,
      cashierName,
      openingFloat,
      expectedCash: openingFloat,
      status: 'OPEN',
      openedAt: new Date(),
    });

    logger.info(
      `[Register Service] Opened Register '${registerName}' with float $${openingFloat} by ${cashierName}`
    );
    return session;
  }

  /**
   * Record Cash-In or Cash-Out adjustment
   */
  public static async recordCashMovement(
    registerId: string,
    type: 'CASH_IN' | 'CASH_OUT',
    amount: number,
    reason: string,
    performedBy: string
  ): Promise<IRegisterSession> {
    const session = await RegisterSession.findOne({ registerId, status: 'OPEN' });
    if (!session) {
      throw new Error(`No open register session found for ID ${registerId}`);
    }

    session.cashMovements.push({
      type,
      amount,
      reason,
      performedBy,
      createdAt: new Date(),
    });

    await session.save();
    logger.info(`[Register Service] ${type} of $${amount} recorded for Register ${registerId}`);
    return session;
  }

  /**
   * Close Register & Calculate Shift Reconciliation & Variance
   */
  public static async closeRegister(
    registerId: string,
    closingCash: number,
    managerNotes?: string
  ): Promise<IRegisterSession> {
    const session = await RegisterSession.findOne({ registerId, status: 'OPEN' });
    if (!session) {
      throw new Error(`No open register session found for ID ${registerId}`);
    }

    // Query transactions executed during this register session shift window
    const txQuery: Record<string, unknown> = {
      cashierId: session.cashierId,
      createdAt: { $gte: session.openedAt },
      status: 'COMPLETED',
    };
    if (session.tenantId) {
      txQuery.tenantId = session.tenantId;
    }
    const transactions = await Transaction.find(txQuery);

    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalTransferSales = 0;
    let totalRefunds = 0;

    for (const tx of transactions) {
      if (tx.type === 'SALE') {
        if (tx.paymentMethod === 'CASH') totalCashSales += tx.total;
        else if (tx.paymentMethod === 'CARD') totalCardSales += tx.total;
        else totalTransferSales += tx.total;
      } else if (tx.type === 'RETURN') {
        totalRefunds += tx.total;
      }
    }

    const cashInTotal = session.cashMovements
      .filter((m) => m.type === 'CASH_IN')
      .reduce((sum, m) => sum + m.amount, 0);
    const cashOutTotal = session.cashMovements
      .filter((m) => m.type === 'CASH_OUT')
      .reduce((sum, m) => sum + m.amount, 0);

    const expectedCash = Number(
      (session.openingFloat + totalCashSales + cashInTotal - cashOutTotal - totalRefunds).toFixed(2)
    );
    const variance = Number((closingCash - expectedCash).toFixed(2));

    session.closingCash = closingCash;
    session.expectedCash = expectedCash;
    session.totalCashSales = totalCashSales;
    session.totalCardSales = totalCardSales;
    session.totalTransferSales = totalTransferSales;
    session.totalRefunds = totalRefunds;
    session.variance = variance;
    session.status = 'CLOSED';
    session.closedAt = new Date();
    if (managerNotes) session.managerNotes = managerNotes;

    await session.save();

    logger.info(
      `[Register Service] Closed Register ${session.registerName}. Expected: $${expectedCash}, Actual: $${closingCash}, Variance: $${variance}`
    );
    return session;
  }

  /**
   * Get Active Session
   */
  public static async getActiveSession(registerId: string): Promise<IRegisterSession | null> {
    return RegisterSession.findOne({ registerId, status: 'OPEN' });
  }
}
