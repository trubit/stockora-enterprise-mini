import mongoose from 'mongoose';
import { Account, type AccountType, type AccountCategory } from '../models/Account.js';
import { JournalEntry, type IJournalLine, type JournalStatus } from '../models/JournalEntry.js';
import { FiscalPeriod } from '../models/FiscalPeriod.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface PostJournalPayload {
  description: string;
  source: string;
  referenceId?: string;
  currency?: string;
  branchId?: string;
  fiscalPeriodId?: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    memo?: string;
    taxCode?: string;
    branchId?: string;
    departmentId?: string;
  }>;
  tenantId?: string;
  userId?: string;
}

export interface GeneralLedgerQuery {
  accountCode?: string;
  startDate?: Date;
  endDate?: Date;
  source?: string;
  branchId?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
}

export interface ReversalPayload {
  journalEntryId: string;
  reason: string;
  tenantId?: string;
  userId?: string;
}

export class FinanceService {
  /**
   * 1. Initialize Standard Enterprise Chart of Accounts for Tenant
   */
  public static async initializeChartOfAccounts(tenantId = 'default'): Promise<void> {
    const defaultAccounts: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
      description: string;
    }> = [
      // Assets
      {
        code: '1000',
        name: 'Cash on Hand (Main Vault)',
        type: 'ASSET',
        category: 'CASH_AND_BANK',
        description: 'Physical cash in corporate vault',
      },
      {
        code: '1010',
        name: 'Operating Bank Account (Primary)',
        type: 'ASSET',
        category: 'CASH_AND_BANK',
        description: 'Primary commercial bank account',
      },
      {
        code: '1020',
        name: 'POS Cash Drawer Float',
        type: 'ASSET',
        category: 'CASH_AND_BANK',
        description: 'Front-desk POS register float',
      },
      {
        code: '1030',
        name: 'Payment Gateway Settlement (Paystack / Stripe)',
        type: 'ASSET',
        category: 'CASH_AND_BANK',
        description: 'Funds clearing in online gateways',
      },
      {
        code: '1200',
        name: 'Accounts Receivable (Trade Debtors)',
        type: 'ASSET',
        category: 'RECEIVABLE',
        description: 'Customer credit sales awaiting collection',
      },
      {
        code: '1300',
        name: 'Merchandise Inventory Asset',
        type: 'ASSET',
        category: 'INVENTORY',
        description: 'Finished goods and warehouse stock valuation',
      },
      {
        code: '1400',
        name: 'Prepaid Expenses & Deposits',
        type: 'ASSET',
        category: 'CURRENT_ASSET',
        description: 'Advance payments for rent, insurance, software',
      },
      {
        code: '1500',
        name: 'Property, Plant & Store Equipment',
        type: 'ASSET',
        category: 'NON_CURRENT_ASSET',
        description: 'Fixed enterprise physical assets',
      },

      // Liabilities
      {
        code: '2000',
        name: 'Accounts Payable (Trade Creditors)',
        type: 'LIABILITY',
        category: 'PAYABLE',
        description: 'Outstanding balances owed to suppliers',
      },
      {
        code: '2100',
        name: 'Sales Tax & VAT Payable',
        type: 'LIABILITY',
        category: 'CURRENT_LIABILITY',
        description: 'Output sales tax collected on taxable transactions',
      },
      {
        code: '2200',
        name: 'Accrued Payroll & Operating Expenses',
        type: 'LIABILITY',
        category: 'CURRENT_LIABILITY',
        description: 'Accumulated unpaid operational liabilities',
      },
      {
        code: '2500',
        name: 'Long-Term Debt & Bank Credit Facilities',
        type: 'LIABILITY',
        category: 'LONG_TERM_LIABILITY',
        description: 'Commercial loan obligations',
      },

      // Equity
      {
        code: '3000',
        name: 'Owner Capital & Shareholder Equity',
        type: 'EQUITY',
        category: 'OWNERS_EQUITY',
        description: 'Direct capital contributed by founders/investors',
      },
      {
        code: '3100',
        name: 'Retained Earnings',
        type: 'EQUITY',
        category: 'RETAINED_EARNINGS',
        description: 'Cumulative net profit retained in business',
      },

      // Revenue
      {
        code: '4000',
        name: 'POS & Retail Sales Revenue',
        type: 'REVENUE',
        category: 'OPERATING_REVENUE',
        description: 'Gross revenue from in-store POS checkouts',
      },
      {
        code: '4100',
        name: 'E-Commerce & Omnichannel Sales Revenue',
        type: 'REVENUE',
        category: 'OPERATING_REVENUE',
        description: 'Online website and mobile channel orders',
      },
      {
        code: '4200',
        name: 'B2B & Wholesale Sales Revenue',
        type: 'REVENUE',
        category: 'OPERATING_REVENUE',
        description: 'Direct corporate accounts and wholesale contracts',
      },
      {
        code: '4900',
        name: 'Sales Discounts & Promotional Rebates',
        type: 'REVENUE',
        category: 'OPERATING_REVENUE',
        description: 'Contra-revenue reductions from coupons and discounts',
      },
      {
        code: '4950',
        name: 'Sales Returns & Customer Refunds',
        type: 'REVENUE',
        category: 'OPERATING_REVENUE',
        description: 'Contra-revenue reversals for returned items',
      },

      // Cost of Goods Sold
      {
        code: '5000',
        name: 'Cost of Goods Sold (COGS - Retail)',
        type: 'COGS',
        category: 'COST_OF_GOODS_SOLD',
        description: 'Direct inventory cost of goods sold',
      },
      {
        code: '5100',
        name: 'Inbound Freight & Landed Cost Adjustments',
        type: 'COGS',
        category: 'COST_OF_GOODS_SOLD',
        description: 'Freight, tariffs, and customs landing fees',
      },
      {
        code: '5200',
        name: 'Inventory Shrinkage & Spoilage Write-Off',
        type: 'COGS',
        category: 'COST_OF_GOODS_SOLD',
        description: 'Losses from stock adjustment counts',
      },

      // Operating Expenses
      {
        code: '6000',
        name: 'Store & Warehouse Rent Expense',
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        description: 'Premises lease and rental costs',
      },
      {
        code: '6100',
        name: 'Utilities, Power & Water',
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        description: 'Electric, cooling, water utility bills',
      },
      {
        code: '6200',
        name: 'Salaries, Wages & Employee Benefits',
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        description: 'Staff compensation and payroll',
      },
      {
        code: '6300',
        name: 'Marketing, Advertising & Campaigns',
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        description: 'Digital ads, promos, campaign budgets',
      },
      {
        code: '6400',
        name: 'Payment Processing & Gateway Fees',
        type: 'EXPENSE',
        category: 'ADMINISTRATIVE_EXPENSE',
        description: 'Paystack, Stripe, and POS merchant fees',
      },
      {
        code: '6500',
        name: 'Software Subscriptions & Cloud Hosting',
        type: 'EXPENSE',
        category: 'ADMINISTRATIVE_EXPENSE',
        description: 'SaaS, server infrastructure, telecom',
      },
      {
        code: '6600',
        name: 'Logistics, Courier & Shipping Expense',
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        description: 'Outbound dispatch and delivery costs',
      },
    ];

    for (const acc of defaultAccounts) {
      const exists = await Account.findOne({ code: acc.code, tenantId });
      if (!exists) {
        await Account.create({
          tenantId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          category: acc.category,
          description: acc.description,
          openingBalance: 0,
          currentBalance: 0,
          currency: 'USD',
          isActive: true,
          isSystem: true,
        });
      }
    }
  }

  /**
   * 2. Post Double-Entry Journal Entry with Period Locking Enforcement
   */
  public static async postJournalEntry(payload: PostJournalPayload): Promise<any> {
    return await ResilientExecutor.execute(
      { name: 'Finance-PostJournal', isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const now = new Date();

        // 1. Period Locking check
        const closedPeriod = await FiscalPeriod.findOne({
          tenantId,
          status: { $in: ['CLOSED', 'LOCKED', 'AUDITED'] },
          startDate: { $lte: now },
          endDate: { $gte: now },
        });

        if (closedPeriod) {
          throw new Error(
            `Posting Rejected: Fiscal period ${closedPeriod.periodCode} is ${closedPeriod.status}. Direct posting prohibited. Use an adjustment journal.`
          );
        }

        // 2. Resolve Account codes
        const resolvedLines: IJournalLine[] = [];
        for (const line of payload.lines) {
          let account = await Account.findOne({
            code: line.accountCode,
            tenantId,
          });

          if (!account) {
            // Auto-provision standard account if missing
            await this.initializeChartOfAccounts(tenantId);
            account = await Account.findOne({ code: line.accountCode, tenantId });
            if (!account) {
              throw new Error(`Account code '${line.accountCode}' not found in Chart of Accounts.`);
            }
          }

          resolvedLines.push({
            accountId: account._id as any,
            accountCode: account.code,
            accountName: account.name,
            debit: Math.max(Number(line.debit) || 0, 0),
            credit: Math.max(Number(line.credit) || 0, 0),
            memo: line.memo,
            taxCode: line.taxCode,
            branchId:
              line.branchId && mongoose.isValidObjectId(line.branchId)
                ? new mongoose.Types.ObjectId(line.branchId)
                : undefined,
          });
        }

        const entryNumber = `JE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        // 3. Create and Save Journal (Pre-save hook validates totalDebit === totalCredit)
        const journal = new JournalEntry({
          tenantId,
          companyId: undefined,
          branchId:
            payload.branchId && mongoose.isValidObjectId(payload.branchId)
              ? new mongoose.Types.ObjectId(payload.branchId)
              : undefined,
          fiscalPeriodId:
            payload.fiscalPeriodId && mongoose.isValidObjectId(payload.fiscalPeriodId)
              ? new mongoose.Types.ObjectId(payload.fiscalPeriodId)
              : undefined,
          entryNumber,
          postingDate: now,
          description: payload.description,
          source: payload.source || 'MANUAL',
          referenceId: payload.referenceId,
          currency: payload.currency || 'USD',
          lines: resolvedLines,
          status: 'POSTED',
          postedBy:
            payload.userId && mongoose.isValidObjectId(payload.userId)
              ? new mongoose.Types.ObjectId(payload.userId)
              : undefined,
        });

        await journal.save();

        // 4. Update Account Balances
        for (const line of journal.lines) {
          const account = await Account.findById(line.accountId);
          if (account) {
            if (['ASSET', 'COGS', 'EXPENSE'].includes(account.type)) {
              account.currentBalance += line.debit - line.credit;
            } else {
              account.currentBalance += line.credit - line.debit;
            }
            await account.save();
          }
        }

        // 5. Emit Event Bus
        eventBus.emit('finance.journal.posted', {
          entryNumber: journal.entryNumber,
          source: journal.source,
          totalAmount: journal.totalDebit,
          tenantId,
        });

        logger.info(
          `[Finance] Posted Journal Entry ${journal.entryNumber} ($${journal.totalDebit}) [${journal.source}]`
        );
        return journal;
      }
    );
  }

  /**
   * 3. Reverse Journal Entry with Audit Trail & Offset Posting
   */
  public static async reverseJournalEntry(payload: ReversalPayload): Promise<any> {
    return await ResilientExecutor.execute(
      { name: `Finance-ReverseJournal-${payload.journalEntryId}`, isIdempotent: true },
      async () => {
        const tenantId = payload.tenantId || 'default';
        const originalJournal = await JournalEntry.findById(payload.journalEntryId);

        if (!originalJournal) {
          throw new Error(`Journal Entry ${payload.journalEntryId} not found.`);
        }

        if (originalJournal.status === 'REVERSED') {
          throw new Error(
            `Journal Entry ${originalJournal.entryNumber} has already been reversed.`
          );
        }

        // Create offsetting reversal lines (swap debit and credit)
        const reversalLines: IJournalLine[] = originalJournal.lines.map((l) => ({
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit: l.credit,
          credit: l.debit,
          memo: `Reversal of ${originalJournal.entryNumber}: ${l.memo || ''}`,
          taxCode: l.taxCode,
          branchId: l.branchId,
        }));

        const reversalEntryNumber = `REV-${originalJournal.entryNumber}-${Math.floor(100 + Math.random() * 900)}`;

        const reversalJournal = new JournalEntry({
          tenantId,
          companyId: originalJournal.companyId,
          branchId: originalJournal.branchId,
          entryNumber: reversalEntryNumber,
          postingDate: new Date(),
          description: `Reversal of ${originalJournal.entryNumber}: ${payload.reason}`,
          source: 'REVERSAL',
          referenceId: originalJournal._id.toString(),
          currency: originalJournal.currency,
          lines: reversalLines,
          status: 'POSTED',
          isAdjustment: true,
          reversalReason: payload.reason,
          postedBy:
            payload.userId && mongoose.isValidObjectId(payload.userId)
              ? new mongoose.Types.ObjectId(payload.userId)
              : undefined,
        });

        await reversalJournal.save();

        // Update Account Balances for the reversal
        for (const line of reversalJournal.lines) {
          const account = await Account.findById(line.accountId);
          if (account) {
            if (['ASSET', 'COGS', 'EXPENSE'].includes(account.type)) {
              account.currentBalance += line.debit - line.credit;
            } else {
              account.currentBalance += line.credit - line.debit;
            }
            await account.save();
          }
        }

        // Update original journal status to REVERSED
        originalJournal.status = 'REVERSED';
        originalJournal.reversedByEntryId = reversalJournal._id as any;
        originalJournal.reversalReason = payload.reason;
        await originalJournal.save();

        eventBus.emit('finance.journal.reversed', {
          originalEntryNumber: originalJournal.entryNumber,
          reversalEntryNumber: reversalJournal.entryNumber,
          tenantId,
        });

        logger.info(
          `[Finance] Successfully reversed Journal ${originalJournal.entryNumber} via ${reversalJournal.entryNumber}`
        );

        return { originalJournal, reversalJournal };
      }
    );
  }

  /**
   * 4. General Ledger Extraction with Filtering & Running Balances
   */
  public static async getGeneralLedger(query: GeneralLedgerQuery) {
    const tenantId = query.tenantId || 'default';
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 50);
    const skip = (page - 1) * limit;

    const filter: any = { tenantId };

    if (query.accountCode) {
      filter['lines.accountCode'] = query.accountCode;
    }
    if (query.source) {
      filter.source = query.source;
    }
    if (query.branchId && mongoose.isValidObjectId(query.branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }
    if (query.startDate || query.endDate) {
      filter.postingDate = {};
      if (query.startDate) filter.postingDate.$gte = query.startDate;
      if (query.endDate) filter.postingDate.$lte = query.endDate;
    }

    const [entries, totalCount] = await Promise.all([
      JournalEntry.find(filter)
        .sort({ postingDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JournalEntry.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalEntries: totalCount,
      entries,
    };
  }

  /**
   * 5. Trial Balance Verification (Debits == Credits)
   */
  public static async getTrialBalance(tenantId = 'default') {
    await this.initializeChartOfAccounts(tenantId);
    const accounts = await Account.find({ tenantId, isActive: true }).sort({ code: 1 }).lean();

    let totalDebit = 0;
    let totalCredit = 0;

    const lines = accounts.map((a) => {
      let debit = 0;
      let credit = 0;

      if (['ASSET', 'COGS', 'EXPENSE'].includes(a.type)) {
        if (a.currentBalance >= 0) debit = a.currentBalance;
        else credit = Math.abs(a.currentBalance);
      } else {
        if (a.currentBalance >= 0) credit = a.currentBalance;
        else debit = Math.abs(a.currentBalance);
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        accountId: a._id.toString(),
        accountCode: a.code,
        accountName: a.name,
        accountType: a.type,
        category: a.category,
        debit: parseFloat(debit.toFixed(2)),
        credit: parseFloat(credit.toFixed(2)),
        balance: parseFloat(a.currentBalance.toFixed(2)),
      };
    });

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return {
      tenantId,
      isBalanced,
      totalDebit: parseFloat(totalDebit.toFixed(2)),
      totalCredit: parseFloat(totalCredit.toFixed(2)),
      variance: parseFloat((totalDebit - totalCredit).toFixed(2)),
      generatedAt: new Date(),
      lines,
    };
  }

  /**
   * 6. Profit & Loss (Income Statement)
   */
  public static async getProfitAndLoss(tenantId = 'default') {
    await this.initializeChartOfAccounts(tenantId);
    const accounts = await Account.find({ tenantId }).lean();

    let grossRevenue = 0;
    let contraRevenue = 0;
    let cogs = 0;
    let operatingExpenses = 0;
    let administrativeExpenses = 0;
    let taxExpense = 0;

    const revenueBreakdown: Array<{ code: string; name: string; amount: number }> = [];
    const cogsBreakdown: Array<{ code: string; name: string; amount: number }> = [];
    const expenseBreakdown: Array<{ code: string; name: string; amount: number }> = [];

    for (const a of accounts) {
      if (a.type === 'REVENUE') {
        if (a.code === '4900' || a.code === '4950') {
          contraRevenue += Math.abs(a.currentBalance);
        } else {
          grossRevenue += a.currentBalance;
        }
        revenueBreakdown.push({ code: a.code, name: a.name, amount: a.currentBalance });
      } else if (a.type === 'COGS') {
        cogs += a.currentBalance;
        cogsBreakdown.push({ code: a.code, name: a.name, amount: a.currentBalance });
      } else if (a.type === 'EXPENSE') {
        if (a.category === 'ADMINISTRATIVE_EXPENSE') administrativeExpenses += a.currentBalance;
        else if (a.category === 'TAX_EXPENSE') taxExpense += a.currentBalance;
        else operatingExpenses += a.currentBalance;
        expenseBreakdown.push({ code: a.code, name: a.name, amount: a.currentBalance });
      }
    }

    const netRevenue = grossRevenue - contraRevenue;
    const grossProfit = netRevenue - cogs;
    const grossMarginPercentage =
      netRevenue > 0 ? parseFloat(((grossProfit / netRevenue) * 100).toFixed(1)) : 0;
    const totalOperatingExpenses = operatingExpenses + administrativeExpenses;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netIncome = operatingProfit - taxExpense;

    return {
      grossRevenue: parseFloat(grossRevenue.toFixed(2)),
      contraRevenue: parseFloat(contraRevenue.toFixed(2)),
      netRevenue: parseFloat(netRevenue.toFixed(2)),
      cogs: parseFloat(cogs.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossMarginPercentage,
      operatingExpenses: parseFloat(operatingExpenses.toFixed(2)),
      administrativeExpenses: parseFloat(administrativeExpenses.toFixed(2)),
      totalOperatingExpenses: parseFloat(totalOperatingExpenses.toFixed(2)),
      operatingProfit: parseFloat(operatingProfit.toFixed(2)),
      taxExpense: parseFloat(taxExpense.toFixed(2)),
      netIncome: parseFloat(netIncome.toFixed(2)),
      breakdowns: {
        revenue: revenueBreakdown,
        cogs: cogsBreakdown,
        expenses: expenseBreakdown,
      },
    };
  }

  /**
   * 7. Balance Sheet (Assets = Liabilities + Equity)
   */
  public static async getBalanceSheet(tenantId = 'default') {
    await this.initializeChartOfAccounts(tenantId);
    const accounts = await Account.find({ tenantId }).lean();

    let currentAssets = 0;
    let nonCurrentAssets = 0;
    let currentLiabilities = 0;
    let longTermLiabilities = 0;
    let shareCapital = 0;
    let retainedEarnings = 0;

    const assetsList: Array<{ code: string; name: string; balance: number }> = [];
    const liabilitiesList: Array<{ code: string; name: string; balance: number }> = [];
    const equityList: Array<{ code: string; name: string; balance: number }> = [];

    for (const a of accounts) {
      if (a.type === 'ASSET') {
        if (a.category === 'NON_CURRENT_ASSET') nonCurrentAssets += a.currentBalance;
        else currentAssets += a.currentBalance;
        assetsList.push({ code: a.code, name: a.name, balance: a.currentBalance });
      } else if (a.type === 'LIABILITY') {
        if (a.category === 'LONG_TERM_LIABILITY') longTermLiabilities += a.currentBalance;
        else currentLiabilities += a.currentBalance;
        liabilitiesList.push({ code: a.code, name: a.name, balance: a.currentBalance });
      } else if (a.type === 'EQUITY') {
        if (a.category === 'RETAINED_EARNINGS') retainedEarnings += a.currentBalance;
        else shareCapital += a.currentBalance;
        equityList.push({ code: a.code, name: a.name, balance: a.currentBalance });
      }
    }

    const pnl = await this.getProfitAndLoss(tenantId);
    const cumulativeRetainedEarnings = retainedEarnings + pnl.netIncome;

    const totalAssets = currentAssets + nonCurrentAssets;
    const totalLiabilities = currentLiabilities + longTermLiabilities;
    const totalEquity = shareCapital + cumulativeRetainedEarnings;

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return {
      isBalanced,
      currentAssets: parseFloat(currentAssets.toFixed(2)),
      nonCurrentAssets: parseFloat(nonCurrentAssets.toFixed(2)),
      totalAssets: parseFloat(totalAssets.toFixed(2)),
      currentLiabilities: parseFloat(currentLiabilities.toFixed(2)),
      longTermLiabilities: parseFloat(longTermLiabilities.toFixed(2)),
      totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
      shareCapital: parseFloat(shareCapital.toFixed(2)),
      retainedEarnings: parseFloat(cumulativeRetainedEarnings.toFixed(2)),
      totalEquity: parseFloat(totalEquity.toFixed(2)),
      assetsList,
      liabilitiesList,
      equityList,
    };
  }
}
