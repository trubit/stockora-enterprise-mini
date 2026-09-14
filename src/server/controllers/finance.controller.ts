import type { Response, NextFunction } from 'express';
import { FinanceService } from '../services/finance.service.js';
import { AccountsReceivableService } from '../services/accountsReceivable.service.js';
import { AccountsPayableService } from '../services/accountsPayable.service.js';
import { CashManagementService } from '../services/cashManagement.service.js';
import { ExpenseManagementService } from '../services/expenseManagement.service.js';
import { CashflowService } from '../services/cashflow.service.js';
import { FinancialAIService } from '../services/ai/financialAI.service.js';
import { TaxReconciliationService } from '../services/tax-reconciliation.service.js';
import { Account } from '../models/Account.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { FiscalPeriod } from '../models/FiscalPeriod.js';
import { Expense } from '../models/Expense.js';
import { FinancialBudget } from '../models/FinancialBudget.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';

export class FinanceController {
  /**
   * 1. Overview Financial Report / Dashboard KPIs
   */
  public static async getFinancialReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      await FinanceService.initializeChartOfAccounts(tenantId);

      const [
        pnl,
        balanceSheet,
        trialBalance,
        cashflow,
        taxSummary,
        cashPosition,
        arAging,
        apAging,
      ] = await Promise.all([
        FinanceService.getProfitAndLoss(tenantId),
        FinanceService.getBalanceSheet(tenantId),
        FinanceService.getTrialBalance(tenantId),
        CashflowService.getCashflowStatement(tenantId),
        TaxReconciliationService.getTaxSummary(tenantId),
        CashManagementService.getCashPosition(tenantId),
        AccountsReceivableService.getAgingReport(tenantId),
        AccountsPayableService.getAgingReport(tenantId),
      ]);

      res.json({
        success: true,
        data: {
          revenue: pnl.netRevenue,
          grossRevenue: pnl.grossRevenue,
          cogs: pnl.cogs,
          grossProfit: pnl.grossProfit,
          grossMarginPercentage: pnl.grossMarginPercentage,
          operatingExpenses: pnl.totalOperatingExpenses,
          operatingProfit: pnl.operatingProfit,
          netIncome: pnl.netIncome,
          profitAndLoss: pnl,
          balanceSheet,
          trialBalance,
          cashflow,
          taxSummary,
          liquidCash: cashPosition.totalLiquidCash,
          cashBreakdown: cashPosition.breakdown,
          accountsReceivable: arAging.summary,
          accountsPayable: apAging.summary,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. Chart of Accounts
   */
  public static async getChartOfAccounts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      await FinanceService.initializeChartOfAccounts(tenantId);
      const accounts = await Account.find({ tenantId, isActive: true }).sort({ code: 1 });
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  }

  public static async createAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const { code, name, type, category, parentAccountId, description, openingBalance, currency } =
        req.body;

      const account = await Account.create({
        tenantId,
        code,
        name,
        type,
        category,
        parentAccountId,
        description,
        openingBalance: Number(openingBalance) || 0,
        currentBalance: Number(openingBalance) || 0,
        currency: currency || 'USD',
        isActive: true,
      });

      res.status(201).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. Journal Entries & General Ledger
   */
  public static async getJournalEntries(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await FinanceService.getGeneralLedger({
        tenantId,
        page,
        limit,
        accountCode: req.query.accountCode as string,
        source: req.query.source as string,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async postJournalEntry(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id || (req.user as any)?._id;

      const journal = await FinanceService.postJournalEntry({
        ...req.body,
        tenantId,
        userId,
      });

      res.status(201).json({ success: true, data: journal });
    } catch (err) {
      next(err);
    }
  }

  public static async reverseJournalEntry(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id || (req.user as any)?._id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { reason } = req.body;

      const result = await FinanceService.reverseJournalEntry({
        journalEntryId: id as string,
        reason: reason || 'Authorized manual reversal',
        tenantId,
        userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. Financial Statements (P&L, Balance Sheet, Cashflow, Trial Balance)
   */
  public static async getProfitAndLossStatement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const pnl = await FinanceService.getProfitAndLoss(tenantId);
      res.json({ success: true, data: pnl });
    } catch (err) {
      next(err);
    }
  }

  public static async getBalanceSheetStatement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const bs = await FinanceService.getBalanceSheet(tenantId);
      res.json({ success: true, data: bs });
    } catch (err) {
      next(err);
    }
  }

  public static async getCashflowStatement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const cashflow = await CashflowService.getCashflowStatement(tenantId);
      res.json({ success: true, data: cashflow });
    } catch (err) {
      next(err);
    }
  }

  public static async getTrialBalanceReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const tb = await FinanceService.getTrialBalance(tenantId);
      res.json({ success: true, data: tb });
    } catch (err) {
      next(err);
    }
  }

  public static async getCashflowForecast(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const forecast = await CashflowService.getCashflowForecast(tenantId);
      res.json({ success: true, data: forecast });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. Accounts Receivable (AR) & Payables (AP)
   */
  public static async getReceivables(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const result = await AccountsReceivableService.getAgingReport(tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async recordCustomerPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;
      const { receivableId, amount, paymentMethod, reference, notes } = req.body;

      const result = await AccountsReceivableService.recordCustomerPayment({
        receivableId,
        amount: Number(amount),
        paymentMethod,
        reference,
        notes,
        tenantId,
        userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async getPayables(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const result = await AccountsPayableService.getAgingReport(tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async recordSupplierDisbursement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;
      const { payableId, amount, paymentMethod, reference, notes } = req.body;

      const result = await AccountsPayableService.recordSupplierDisbursement({
        payableId,
        amount: Number(amount),
        paymentMethod,
        reference,
        notes,
        tenantId,
        userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. Expense Management
   */
  public static async getExpenses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const expenses = await Expense.find({ tenantId }).sort({ expenseDate: -1 }).limit(100);
      res.json({ success: true, data: expenses });
    } catch (err) {
      next(err);
    }
  }

  public static async createExpense(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;

      const expense = await ExpenseManagementService.createExpense({
        ...req.body,
        tenantId,
        userId,
      });

      res.status(201).json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  public static async approveExpense(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { action, rejectionReason } = req.body;

      const result = await ExpenseManagementService.processApproval({
        expenseId: id as string,
        action: action || 'APPROVE',
        rejectionReason,
        tenantId,
        userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. Cash Position & Payment Reconciliations
   */
  public static async getCashPosition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const cash = await CashManagementService.getCashPosition(tenantId);
      res.json({ success: true, data: cash });
    } catch (err) {
      next(err);
    }
  }

  public static async reconcileGatewayBatch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;

      const result = await CashManagementService.reconcileGatewaySettlement({
        ...req.body,
        tenantId,
        userId,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async reconcilePOSShift(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;

      const result = await CashManagementService.reconcilePOSShift({
        ...req.body,
        tenantId,
        userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. Fiscal Periods
   */
  public static async getFiscalPeriods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const periods = await FiscalPeriod.find({ tenantId }).sort({ year: -1, month: -1 });
      res.json({ success: true, data: periods });
    } catch (err) {
      next(err);
    }
  }

  public static async closeFiscalPeriod(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;
      const { id } = req.params;

      const period = await FiscalPeriod.findOneAndUpdate(
        { _id: id, tenantId },
        {
          status: 'CLOSED',
          closedBy: userId,
          closedAt: new Date(),
        },
        { new: true }
      );

      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 9. Financial AI Assistant & What-If Simulations
   */
  public static async askFinancialAssistant(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const prompt =
        req.body?.prompt ||
        req.body?.query ||
        req.body?.message ||
        'What is our current financial position?';

      const answer = await FinancialAIService.queryFinancialAssistant(prompt, tenantId);
      res.json({ success: true, data: { answer, prompt } });
    } catch (err) {
      next(err);
    }
  }

  public static async simulateWhatIfScenario(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const result = await FinancialAIService.simulateWhatIfScenario({
        ...req.body,
        tenantId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 10. Budgets
   */
  public static async getBudgets(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const budgets = await FinancialBudget.find({ tenantId }).sort({ year: -1 });
      res.json({ success: true, data: budgets });
    } catch (err) {
      next(err);
    }
  }

  public static async createBudget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req.user as any)?.tenantId || 'default';
      const userId = (req.user as any)?.id;

      const budget = await FinancialBudget.create({
        ...req.body,
        tenantId,
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: budget });
    } catch (err) {
      next(err);
    }
  }
}
