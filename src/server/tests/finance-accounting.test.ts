import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { Expense } from '../models/Expense.js';
import { ExpenseCategory } from '../models/ExpenseCategory.js';
import { AccountsReceivable } from '../models/AccountsReceivable.js';
import { AccountsPayable } from '../models/AccountsPayable.js';
import { Invoice } from '../models/Invoice.js';
import { FiscalPeriod } from '../models/FiscalPeriod.js';
import { FinanceService } from '../services/finance.service.js';
import { ExpenseService } from '../services/expense.service.js';
import { ARAPService } from '../services/ar-ap.service.js';

describe('Phase 32 — Advanced Finance, Accounting & Financial Intelligence Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }
    await FinanceService.initializeChartOfAccounts('tenant-fin-test');
  });

  afterAll(async () => {
    await Account.deleteMany({ tenantId: 'tenant-fin-test' });
    await JournalEntry.deleteMany({ tenantId: 'tenant-fin-test' });
    await Expense.deleteMany({ tenantId: 'tenant-fin-test' });
    await ExpenseCategory.deleteMany({ tenantId: 'tenant-fin-test' });
    await AccountsReceivable.deleteMany({ tenantId: 'tenant-fin-test' });
    await AccountsPayable.deleteMany({ tenantId: 'tenant-fin-test' });
    await Invoice.deleteMany({ tenantId: 'tenant-fin-test' });
    await FiscalPeriod.deleteMany({ tenantId: 'tenant-fin-test' });
  });

  describe('Double-Entry Accounting & Chart of Accounts', () => {
    it('should initialize Chart of Accounts and create standard account codes', async () => {
      await FinanceService.initializeChartOfAccounts('tenant-fin-test');
      const cashAccount = await Account.findOne({ code: '1000', tenantId: 'tenant-fin-test' });
      expect(cashAccount).toBeDefined();
      expect(cashAccount?.type).toBe('ASSET');
    });

    it('should post balanced journal entry and update account balances', async () => {
      const journal = await FinanceService.postJournalEntry({
        description: 'Initial Capital Cash Injection',
        source: 'MANUAL',
        lines: [
          { accountCode: '1000', debit: 5000, credit: 0, memo: 'Debit Cash' },
          { accountCode: '3000', debit: 0, credit: 5000, memo: 'Credit Equity' },
        ],
        tenantId: 'tenant-fin-test',
      });

      expect(journal.status).toBe('POSTED');
      expect(journal.totalDebit).toBe(5000);
      expect(journal.totalCredit).toBe(5000);

      const cashAccount = await Account.findOne({ code: '1000', tenantId: 'tenant-fin-test' });
      expect(cashAccount?.currentBalance).toBeGreaterThanOrEqual(5000);
    });

    it('should reject unbalanced journal entries where debits != credits', async () => {
      await expect(
        FinanceService.postJournalEntry({
          description: 'Unbalanced Journal',
          source: 'MANUAL',
          lines: [
            { accountCode: '1000', debit: 5000, credit: 0 },
            { accountCode: '3000', debit: 0, credit: 4000 },
          ],
          tenantId: 'tenant-fin-test',
        })
      ).rejects.toThrow();
    });
  });

  describe('Trial Balance, P&L and Balance Sheet Statements', () => {
    it('should verify Trial Balance zero-sum equality (Debits == Credits)', async () => {
      const trial = await FinanceService.getTrialBalance('tenant-fin-test');
      expect(trial.isBalanced).toBe(true);
      expect(trial.totalDebit).toBe(trial.totalCredit);
    });

    it('should calculate Profit & Loss and Balance Sheet statements correctly', async () => {
      // Post revenue sale journal ($1000 sale, $400 COGS)
      await FinanceService.postJournalEntry({
        description: 'POS Sale Journal',
        source: 'POS_SALE',
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 1000 },
          { accountCode: '5000', debit: 400, credit: 0 },
          { accountCode: '1300', debit: 0, credit: 400 },
        ],
        tenantId: 'tenant-fin-test',
      });

      const pnl = await FinanceService.getProfitAndLoss('tenant-fin-test');
      expect(pnl.netRevenue).toBeGreaterThanOrEqual(1000);
      expect(pnl.cogs).toBeGreaterThanOrEqual(400);
      expect(pnl.grossProfit).toBe(pnl.netRevenue - pnl.cogs);

      const bs = await FinanceService.getBalanceSheet('tenant-fin-test');
      expect(bs.isBalanced).toBe(true);
    });
  });

  describe('Expense Management & Workflow', () => {
    it('should submit expense and post to journal upon approval', async () => {
      await ExpenseCategory.create({
        code: '6000',
        name: 'Operating Expense',
        tenantId: 'tenant-fin-test',
      });

      const expense = await ExpenseService.submitExpense({
        categoryCode: '6000',
        vendorName: 'Acme Power Co',
        amount: 250,
        notes: 'Monthly power utility bill',
        tenantId: 'tenant-fin-test',
      });

      expect(expense.status).toBe('POSTED');
      expect(expense.totalAmount).toBe(250);
      expect(expense.journalEntryId).toBeDefined();
    });
  });

  describe('Accounts Receivable / Payable Aging & Period Closing Governance', () => {
    it('should recalculate AR aging and record customer payment', async () => {
      const inv = await Invoice.create({
        invoiceNumber: 'INV-TEST-999',
        customerId: new mongoose.Types.ObjectId(),
        customerName: 'Delta Retail LLC',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Sample Product',
            sku: 'SP-100',
            quantity: 2,
            unitPrice: 200,
            discountAmount: 0,
            taxAmount: 0,
            subtotal: 400,
          },
        ],
        subtotal: 400,
        totalAmount: 400,
        paidAmount: 0,
        balanceDue: 400,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 86400000 * 14),
        status: 'ISSUED',
        tenantId: 'tenant-fin-test',
      });

      await AccountsReceivable.create({
        customerId: inv.customerId,
        customerName: inv.customerName,
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: 400,
        paidAmount: 0,
        balanceDue: 400,
        dueDate: inv.dueDate,
        status: 'UNPAID',
        tenantId: 'tenant-fin-test',
      });

      const { arUpdated } = await ARAPService.recalculateAging('tenant-fin-test');
      expect(arUpdated).toBeGreaterThanOrEqual(1);

      const paidAr = await ARAPService.recordARPayment({
        invoiceId: inv._id.toString(),
        amountPaid: 400,
        tenantId: 'tenant-fin-test',
      });

      expect(paidAr.status).toBe('PAID');
      expect(paidAr.balanceDue).toBe(0);
    });

    it('should block journal entry posting when fiscal period is closed', async () => {
      const now = new Date();
      await FiscalPeriod.create({
        name: 'August 2026',
        periodCode: 'FP-2026-08',
        quarter: 3,
        year: 2026,
        month: 8,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        status: 'CLOSED',
        tenantId: 'tenant-fin-test',
      });

      await expect(
        FinanceService.postJournalEntry({
          description: 'Late Adjustment',
          source: 'MANUAL',
          lines: [
            { accountCode: '1000', debit: 100, credit: 0 },
            { accountCode: '3000', debit: 0, credit: 100 },
          ],
          tenantId: 'tenant-fin-test',
        })
      ).rejects.toThrow();
    });
  });
});
