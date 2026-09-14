import mongoose from 'mongoose';
import { Expense, type IExpense, type ExpenseStatus } from '../models/Expense.js';
import { ExpenseCategory } from '../models/ExpenseCategory.js';
import { FinanceService } from './finance.service.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface CreateExpensePayload {
  categoryId: string;
  categoryName?: string;
  vendorName?: string;
  amount: number;
  taxAmount?: number;
  currency?: string;
  expenseDate?: Date;
  paymentMethod?: string;
  bankAccountId?: string;
  notes?: string;
  receiptAttachmentUrl?: string;
  departmentId?: string;
  departmentName?: string;
  branchId?: string;
  tenantId?: string;
  userId?: string;
}

export interface ApproveExpensePayload {
  expenseId: string;
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
  tenantId?: string;
  userId?: string;
}

export class ExpenseManagementService {
  /**
   * 1. Submit Expense (Draft or Pending Approval)
   */
  public static async createExpense(payload: CreateExpensePayload): Promise<IExpense> {
    return await ResilientExecutor.execute(
      { name: `Expense-Create-${Date.now()}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const expenseNumber = `EXP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        let categoryName = payload.categoryName;
        if (!categoryName && mongoose.isValidObjectId(payload.categoryId)) {
          const cat = await ExpenseCategory.findById(payload.categoryId);
          categoryName = cat?.name || 'General Expense';
        }

        const amount = Number(payload.amount) || 0;
        const taxAmount = Number(payload.taxAmount) || 0;
        const totalAmount = amount + taxAmount;

        // Auto-approve if amount <= $100, otherwise route to PENDING_APPROVAL
        const status: ExpenseStatus = amount <= 100 ? 'APPROVED' : 'PENDING_APPROVAL';

        const expense = await Expense.create({
          tenantId,
          expenseNumber,
          categoryId: new mongoose.Types.ObjectId(payload.categoryId),
          categoryName: categoryName || 'General Operating Expense',
          vendorName: payload.vendorName,
          amount,
          taxAmount,
          totalAmount,
          currency: payload.currency || 'USD',
          expenseDate: payload.expenseDate || new Date(),
          paymentMethod: payload.paymentMethod || 'CASH',
          bankAccountId:
            payload.bankAccountId && mongoose.isValidObjectId(payload.bankAccountId)
              ? new mongoose.Types.ObjectId(payload.bankAccountId)
              : undefined,
          notes: payload.notes,
          receiptAttachmentUrl: payload.receiptAttachmentUrl,
          departmentId:
            payload.departmentId && mongoose.isValidObjectId(payload.departmentId)
              ? new mongoose.Types.ObjectId(payload.departmentId)
              : undefined,
          departmentName: payload.departmentName,
          branchId:
            payload.branchId && mongoose.isValidObjectId(payload.branchId)
              ? new mongoose.Types.ObjectId(payload.branchId)
              : undefined,
          status,
          createdBy:
            payload.userId && mongoose.isValidObjectId(payload.userId)
              ? new mongoose.Types.ObjectId(payload.userId)
              : undefined,
        });

        // If auto-approved, immediately post to General Ledger
        if (status === 'APPROVED') {
          await this.postExpenseJournal(expense, payload.userId);
        }

        logger.info(
          `[Expense] Created Expense ${expense.expenseNumber} ($${expense.totalAmount}) [Status: ${expense.status}]`
        );
        return expense;
      }
    );
  }

  /**
   * 2. Approve or Reject Expense
   */
  public static async processApproval(payload: ApproveExpensePayload) {
    return await ResilientExecutor.execute(
      { name: `Expense-Approval-${payload.expenseId}`, isIdempotent: true },
      async () => {
        const expense = await Expense.findById(payload.expenseId);
        if (!expense) {
          throw new Error(`Expense ${payload.expenseId} not found.`);
        }

        if (expense.status !== 'PENDING_APPROVAL' && expense.status !== 'DRAFT') {
          throw new Error(
            `Expense ${expense.expenseNumber} cannot be modified from current status: ${expense.status}`
          );
        }

        if (payload.action === 'REJECT') {
          expense.status = 'REJECTED';
          expense.rejectedBy =
            payload.userId && mongoose.isValidObjectId(payload.userId)
              ? new mongoose.Types.ObjectId(payload.userId)
              : undefined;
          expense.rejectedAt = new Date();
          expense.rejectionReason = payload.rejectionReason || 'Rejected by finance manager';
          await expense.save();
          logger.info(
            `[Expense] Rejected expense ${expense.expenseNumber}: ${expense.rejectionReason}`
          );
          return { expense };
        }

        expense.status = 'APPROVED';
        expense.approvedBy =
          payload.userId && mongoose.isValidObjectId(payload.userId)
            ? new mongoose.Types.ObjectId(payload.userId)
            : undefined;
        expense.approvedAt = new Date();

        const journal = await this.postExpenseJournal(expense, payload.userId);
        expense.journalEntryId = journal._id as any;
        await expense.save();

        logger.info(
          `[Expense] Approved and posted journal for ${expense.expenseNumber} ($${expense.totalAmount})`
        );
        return { expense, journal };
      }
    );
  }

  /**
   * Helper: Post Double-Entry Journal for Approved Expense
   * Debit: Expense Account (6000/6100/6200/6300/6400/6500) + Tax Expense/Asset (2100)
   * Credit: Bank Account (1010) / Cash (1000)
   */
  private static async postExpenseJournal(expense: IExpense, userId?: string) {
    const expenseAccountCode = this.mapCategoryToAccountCode(expense.categoryName);
    const paymentAccountCode = expense.paymentMethod === 'CASH' ? '1000' : '1010';

    const lines: any[] = [];

    // 1. Debit Expense
    lines.push({
      accountCode: expenseAccountCode,
      debit: expense.amount,
      credit: 0,
      memo: `${expense.categoryName} expense: ${expense.notes || expense.vendorName || 'Operational'}`,
      branchId: expense.branchId?.toString(),
      departmentId: expense.departmentId?.toString(),
    });

    // 2. Debit Tax if any
    if (expense.taxAmount && expense.taxAmount > 0) {
      lines.push({
        accountCode: '2100', // Input Tax / Tax reduction
        debit: expense.taxAmount,
        credit: 0,
        memo: `Tax paid on expense ${expense.expenseNumber}`,
        branchId: expense.branchId?.toString(),
      });
    }

    // 3. Credit Cash / Bank
    lines.push({
      accountCode: paymentAccountCode,
      debit: 0,
      credit: expense.totalAmount,
      memo: `Disbursement for ${expense.expenseNumber} (${expense.paymentMethod})`,
      branchId: expense.branchId?.toString(),
    });

    const journal = await FinanceService.postJournalEntry({
      tenantId: expense.tenantId,
      description: `Approved Expense ${expense.expenseNumber} - ${expense.categoryName} (${expense.vendorName || 'Vendor'})`,
      source: 'EXPENSE',
      referenceId: expense._id.toString(),
      userId,
      branchId: expense.branchId?.toString(),
      lines,
    });

    return journal;
  }

  private static mapCategoryToAccountCode(categoryName: string): string {
    const norm = categoryName.toUpperCase();
    if (norm.includes('RENT') || norm.includes('LEASE')) return '6000';
    if (norm.includes('UTILIT') || norm.includes('POWER') || norm.includes('WATER')) return '6100';
    if (norm.includes('SALAR') || norm.includes('PAYROLL') || norm.includes('WAGE')) return '6200';
    if (norm.includes('MARKET') || norm.includes('ADVERT') || norm.includes('PROMO')) return '6300';
    if (norm.includes('PAYMENT') || norm.includes('GATEWAY') || norm.includes('FEE')) return '6400';
    if (norm.includes('SOFT') || norm.includes('CLOUD') || norm.includes('SUBSCRIPTION'))
      return '6500';
    if (norm.includes('LOGISTIC') || norm.includes('SHIPP') || norm.includes('COURIER'))
      return '6600';
    return '6000'; // Default operating expense
  }
}
