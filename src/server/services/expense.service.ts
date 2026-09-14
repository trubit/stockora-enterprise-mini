import { Expense, type IExpense } from '../models/Expense.js';
import { ExpenseCategory } from '../models/ExpenseCategory.js';
import { FinanceService } from './finance.service.js';
import { WorkflowService } from './workflow.service.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';
import mongoose from 'mongoose';

export class ExpenseService {
  /**
   * Submits a new expense and triggers Phase 26 workflow if required.
   */
  public static async submitExpense(payload: {
    categoryCode: string;
    vendorName?: string;
    amount: number;
    taxAmount?: number;
    expenseDate?: Date;
    paymentMethod?: string;
    notes?: string;
    receiptAttachmentUrl?: string;
    tenantId?: string;
    userId?: string;
  }): Promise<IExpense> {
    let category = await ExpenseCategory.findOne({ code: payload.categoryCode });
    if (!category) {
      const defaultNames: Record<string, string> = {
        '6000': 'Operating & Administrative',
        '6100': 'Rent & Lease',
        '6200': 'Utilities & Power',
        '6300': 'Salaries & Payroll',
      };
      try {
        category = await ExpenseCategory.create({
          tenantId: payload.tenantId,
          code: payload.categoryCode,
          name: defaultNames[payload.categoryCode] || `Expense (${payload.categoryCode})`,
          isActive: true,
        });
      } catch {
        category = await ExpenseCategory.findOne({ code: payload.categoryCode });
      }
    }

    const categoryName = category ? category.name : payload.categoryCode;
    const expenseNumber = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const taxAmount = payload.taxAmount || 0;
    const totalAmount = (payload.amount || 0) + taxAmount;

    const requiresApproval = totalAmount > 1000;
    const initialStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    const expense = new Expense({
      tenantId: payload.tenantId,
      expenseNumber,
      categoryId: category ? category._id : new mongoose.Types.ObjectId(),
      categoryName,
      vendorName: payload.vendorName,
      amount: payload.amount || 0,
      taxAmount,
      totalAmount,
      currency: 'USD',
      expenseDate: payload.expenseDate || new Date(),
      paymentMethod: payload.paymentMethod || 'CASH',
      notes: payload.notes,
      receiptAttachmentUrl: payload.receiptAttachmentUrl,
      status: initialStatus,
      createdBy: payload.userId as any,
    });

    await expense.save();

    if (requiresApproval) {
      try {
        await WorkflowService.startWorkflow(
          payload.tenantId || new mongoose.Types.ObjectId().toString(),
          'EXPENSE_SUBMITTED',
          { expenseId: expense._id, totalAmount, expenseNumber }
        );
      } catch {
        logger.warn(`[Expense] Workflow definition 'Expense Approval Flow' not configured.`);
      }
    } else {
      await this.postExpenseToJournal(expense);
    }

    eventBus.emit('finance.expense.created', {
      expenseNumber: expense.expenseNumber,
      amount: expense.totalAmount,
      status: expense.status,
    });

    return expense;
  }

  /**
   * Approves a pending expense and posts it to the general ledger.
   */
  public static async approveExpense(expenseId: string, userId?: string): Promise<IExpense> {
    const expense = await Expense.findById(expenseId);
    if (!expense) throw new Error(`Expense '${expenseId}' not found.`);
    if (expense.status === 'POSTED') throw new Error(`Expense already posted.`);

    expense.status = 'APPROVED';
    expense.approvedBy = userId as any;
    await expense.save();

    await this.postExpenseToJournal(expense);

    eventBus.emit('finance.expense.approved', {
      expenseNumber: expense.expenseNumber,
      amount: expense.totalAmount,
    });

    return expense;
  }

  /**
   * Posts approved expense to accounting journal: Debit Operating Expense, Credit Cash/Bank.
   */
  private static async postExpenseToJournal(expense: IExpense): Promise<void> {
    try {
      const journal = await FinanceService.postJournalEntry({
        description: `Expense Payment: ${expense.categoryName} - ${expense.expenseNumber}`,
        source: 'EXPENSE',
        referenceId: expense.expenseNumber,
        currency: expense.currency,
        lines: [
          { accountCode: '6000', debit: expense.amount, credit: 0, memo: expense.notes },
          ...(expense.taxAmount > 0
            ? [{ accountCode: '2100', debit: expense.taxAmount, credit: 0, memo: 'Tax Paid' }]
            : []),
          {
            accountCode: '1000',
            debit: 0,
            credit: expense.totalAmount,
            memo: expense.paymentMethod,
          },
        ],
        tenantId: expense.tenantId,
      });

      expense.journalEntryId = journal._id;
      expense.status = 'POSTED';
      await expense.save();
    } catch (err: any) {
      logger.error(`[Expense] Failed to post expense ${expense.expenseNumber} to journal:`, err);
    }
  }
}
