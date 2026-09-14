import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { FinanceService } from '../services/finance.service.js';
import { AccountsReceivableService } from '../services/accountsReceivable.service.js';
import { AccountsPayableService } from '../services/accountsPayable.service.js';
import { CashManagementService } from '../services/cashManagement.service.js';
import { ExpenseManagementService } from '../services/expenseManagement.service.js';
import { CashflowService } from '../services/cashflow.service.js';
import { FinancialAIService } from '../services/ai/financialAI.service.js';
import { FinancialTransactionService } from '../services/financialTransaction.service.js';
import { Account } from '../models/Account.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { FiscalPeriod } from '../models/FiscalPeriod.js';
import { Expense } from '../models/Expense.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';

import { AccountsReceivable } from '../models/AccountsReceivable.js';
import { AccountsPayable } from '../models/AccountsPayable.js';

describe('Phase 41 — Advanced Financial Management & Accounting Integration Tests', () => {
  const tenantA = 'tenant-fin-a';
  const tenantB = 'tenant-fin-b';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockora_test_p41';
      await mongoose.connect(mongoUri);
    }

    try {
      await Account.collection.dropIndex('code_1');
    } catch {
      // index might not exist
    }

    try {
      await Account.syncIndexes();
      await JournalEntry.syncIndexes();
      await FiscalPeriod.syncIndexes();
      await Expense.syncIndexes();
      await AccountsReceivable.syncIndexes();
      await AccountsPayable.syncIndexes();
    } catch {
      // ignore
    }

    // Clean up test collections
    await Account.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await JournalEntry.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await FiscalPeriod.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Expense.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await AccountsReceivable.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await AccountsPayable.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Supplier.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
  });

  afterAll(async () => {
    await Account.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await JournalEntry.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await FiscalPeriod.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Expense.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await AccountsReceivable.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await AccountsPayable.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Supplier.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
  });

  it('1. should initialize full Chart of Accounts with assets, liabilities, equity, revenue, COGS, expenses', async () => {
    await FinanceService.initializeChartOfAccounts(tenantA);
    const accounts = await Account.find({ tenantId: tenantA });

    expect(accounts.length).toBeGreaterThanOrEqual(15);
    const cashAcc = accounts.find((a) => a.code === '1000');
    expect(cashAcc).toBeDefined();
    expect(cashAcc?.type).toBe('ASSET');
    expect(cashAcc?.category).toBe('CASH_AND_BANK');
  });

  it('2. should post a balanced double-entry journal entry and update account balances', async () => {
    const journal = await FinanceService.postJournalEntry({
      tenantId: tenantA,
      description: 'Initial Capital Injection',
      source: 'CAPITAL',
      lines: [
        { accountCode: '1010', debit: 50000, credit: 0, memo: 'Operating Bank' },
        { accountCode: '3000', debit: 0, credit: 50000, memo: 'Owner Capital' },
      ],
    });

    expect(journal).toBeDefined();
    expect(journal.entryNumber).toMatch(/^JE-/);
    expect(journal.totalDebit).toBe(50000);
    expect(journal.totalCredit).toBe(50000);
    expect(journal.status).toBe('POSTED');

    const bankAcc = await Account.findOne({ tenantId: tenantA, code: '1010' });
    const capitalAcc = await Account.findOne({ tenantId: tenantA, code: '3000' });
    expect(bankAcc?.currentBalance).toBe(50000);
    expect(capitalAcc?.currentBalance).toBe(50000);
  });

  it('3. should strictly reject unbalanced journal entries (Debits !== Credits)', async () => {
    await expect(
      FinanceService.postJournalEntry({
        tenantId: tenantA,
        description: 'Faulty Unbalanced Entry',
        source: 'MANUAL',
        lines: [
          { accountCode: '1010', debit: 1000, credit: 0 },
          { accountCode: '3000', debit: 0, credit: 800 },
        ],
      })
    ).rejects.toThrow();
  });

  it('4. should reverse a posted journal entry with audit trace and offsetting balances', async () => {
    const original = await FinanceService.postJournalEntry({
      tenantId: tenantA,
      description: 'Equipment Purchase Deposit',
      source: 'EQUIPMENT',
      lines: [
        { accountCode: '1500', debit: 5000, credit: 0 },
        { accountCode: '1010', debit: 0, credit: 5000 },
      ],
    });

    const { originalJournal, reversalJournal } = await FinanceService.reverseJournalEntry({
      journalEntryId: original._id.toString(),
      reason: 'Purchase order cancelled by vendor',
      tenantId: tenantA,
    });

    expect(originalJournal.status).toBe('REVERSED');
    expect(originalJournal.reversedByEntryId).toBeDefined();
    expect(reversalJournal.entryNumber).toMatch(/^REV-/);
    expect(reversalJournal.totalDebit).toBe(5000);
    expect(reversalJournal.totalCredit).toBe(5000);

    const bankAcc = await Account.findOne({ tenantId: tenantA, code: '1010' });
    expect(bankAcc?.currentBalance).toBe(50000); // Restored to 50k
  });

  it('5. should enforce period locking and prevent direct posting into a closed fiscal period', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);

    const period = await FiscalPeriod.create({
      tenantId: tenantA,
      periodCode: '2026-M02-TEST',
      name: 'February 2026',
      year: 2026,
      quarter: 1,
      month: 2,
      startDate,
      endDate,
      status: 'CLOSED',
    });

    await expect(
      FinanceService.postJournalEntry({
        tenantId: tenantA,
        description: 'Late Post to Closed Month',
        source: 'MANUAL',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '3000', debit: 0, credit: 100 },
        ],
      })
    ).rejects.toThrow();

    // Reopen period for remaining tests
    await FiscalPeriod.deleteOne({ _id: period._id });
  });

  it('6. should process operational sale event with COGS and double-entry postings', async () => {
    const journal = await FinancialTransactionService.recordSaleTransaction({
      orderId: 'ORDER-TEST-001',
      orderNumber: 'SO-1001',
      totalAmount: 1200,
      subtotal: 1100,
      taxAmount: 100,
      cogsAmount: 600,
      paymentMethod: 'CASH',
      channel: 'POS',
      tenantId: tenantA,
    });

    expect(journal).toBeDefined();
    expect(journal.source).toBe('SALE');
    expect(journal.totalDebit).toBe(1800); // 1200 Cash + 600 COGS

    // Idempotency: Running same sale twice returns existing journal without duplicate posting
    const duplicateJournal = await FinancialTransactionService.recordSaleTransaction({
      orderId: 'ORDER-TEST-001',
      orderNumber: 'SO-1001',
      totalAmount: 1200,
      subtotal: 1100,
      taxAmount: 100,
      paymentMethod: 'CASH',
      tenantId: tenantA,
    });

    expect(duplicateJournal._id.toString()).toBe(journal._id.toString());
  });

  it('7. should create Accounts Receivable, compute aging, and record customer debt settlement', async () => {
    const ts = Date.now();
    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-${ts}`,
      name: 'Acme Enterprises',
      email: `finance-${ts}@acme.corp`,
      creditLimit: 10000,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const ar = await AccountsReceivableService.createReceivable({
      customerId: customer._id.toString(),
      customerName: customer.name,
      invoiceNumber: `INV-ACME-${ts}`,
      totalAmount: 3000,
      dueDate,
      tenantId: tenantA,
    });

    expect(ar.status).toBe('UNPAID');
    expect(ar.agingBucket).toBe('CURRENT');

    const aging = await AccountsReceivableService.getAgingReport(tenantA);
    expect(aging.summary.totalOutstanding).toBeGreaterThanOrEqual(3000);

    // Record partial settlement
    const { ar: updatedAr, journal } = await AccountsReceivableService.recordCustomerPayment({
      receivableId: ar._id.toString(),
      amount: 1500,
      paymentMethod: 'BANK_TRANSFER',
      tenantId: tenantA,
    });

    expect(updatedAr.status).toBe('PARTIALLY_PAID');
    expect(updatedAr.balanceDue).toBe(1500);
    expect(journal.totalDebit).toBe(1500);
  });

  it('8. should manage Accounts Payable obligations and supplier disbursements', async () => {
    const ts = Date.now();
    const supplier = await Supplier.create({
      tenantId: tenantA,
      name: 'Apex Global Suppliers',
      code: `SUP-${ts}`,
      email: `vendor-${ts}@apex.com`,
      phone: '+1234567890',
      address: '123 Supply St',
      contactPerson: 'John Supplier',
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const ap = await AccountsPayableService.createPayable({
      supplierId: supplier._id.toString(),
      supplierName: supplier.name,
      invoiceNumber: `SUP-INV-${ts}`,
      totalAmount: 4000,
      dueDate,
      tenantId: tenantA,
    });

    expect(ap.balanceDue).toBe(4000);

    const { ap: paidAp, journal } = await AccountsPayableService.recordSupplierDisbursement({
      payableId: ap._id.toString(),
      amount: 4000,
      paymentMethod: 'BANK_TRANSFER',
      tenantId: tenantA,
    });

    expect(paidAp.status).toBe('PAID');
    expect(paidAp.balanceDue).toBe(0);
    expect(journal.totalDebit).toBe(4000);
  });

  it('9. should handle expense submissions, manager approvals, and automated postings', async () => {
    const expense = await ExpenseManagementService.createExpense({
      categoryId: new mongoose.Types.ObjectId().toString(),
      categoryName: 'Marketing & Advertising',
      vendorName: 'Google Ads',
      amount: 750,
      taxAmount: 50,
      tenantId: tenantA,
    });

    expect(expense.status).toBe('PENDING_APPROVAL');
    expect(expense.totalAmount).toBe(800);

    const { expense: approvedExpense, journal } = await ExpenseManagementService.processApproval({
      expenseId: expense._id.toString(),
      action: 'APPROVE',
      tenantId: tenantA,
    });

    expect(approvedExpense.status).toBe('APPROVED');
    expect(journal).toBeDefined();
    expect(journal.totalDebit).toBe(800);
  });

  it('10. should reconcile Paystack batch settlement with gross, merchant fee, and net payout', async () => {
    const { record, journal } = await CashManagementService.reconcileGatewaySettlement({
      gatewayProvider: 'PAYSTACK',
      transactions: [
        {
          providerTransactionRef: 'PSTK-001',
          orderNumber: 'ORD-901',
          grossAmount: 1000,
          providerFee: 15,
          netSettlementAmount: 985,
          transactionDate: new Date(),
        },
        {
          providerTransactionRef: 'PSTK-002',
          orderNumber: 'ORD-902',
          grossAmount: 2000,
          providerFee: 30,
          netSettlementAmount: 1970,
          transactionDate: new Date(),
        },
      ],
      tenantId: tenantA,
    });

    expect(record.status).toBe('MATCHED');
    expect(record.totalGrossAmount).toBe(3000);
    expect(record.totalFeeAmount).toBe(45);
    expect(record.totalNetSettlement).toBe(2955);
    expect(journal.totalDebit).toBe(3000);
    expect(journal.totalCredit).toBe(3000);
  });

  it('11. should verify Trial Balance zero-sum equality (Debits == Credits)', async () => {
    const tb = await FinanceService.getTrialBalance(tenantA);
    expect(tb.isBalanced).toBe(true);
    expect(tb.variance).toBe(0);
    expect(tb.totalDebit).toBeGreaterThan(0);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('12. should generate Balance Sheet satisfying Assets = Liabilities + Equity', async () => {
    const bs = await FinanceService.getBalanceSheet(tenantA);
    expect(bs.isBalanced).toBe(true);
    expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity);
  });

  it('13. should execute What-If financial scenario simulator and calculate profit delta', async () => {
    const sim = await FinancialAIService.simulateWhatIfScenario({
      tenantId: tenantA,
      salesChangePct: 15,
      priceChangePct: 5,
      expenseChangePct: -10,
    });

    expect(sim.baseline).toBeDefined();
    expect(sim.simulated).toBeDefined();
    expect(sim.simulated.netRevenue).toBeGreaterThan(sim.baseline.netRevenue);
    expect(sim.simulated.profitDelta).toBeGreaterThan(0);
    expect(sim.aiScenarioAssessment).toContain('Positive scenario impact');
  });

  it('14. should enforce strict multi-tenant isolation across all financial operations', async () => {
    await FinanceService.initializeChartOfAccounts(tenantB);
    const journalB = await FinanceService.postJournalEntry({
      tenantId: tenantB,
      description: 'Tenant B Capital Injection',
      source: 'CAPITAL',
      lines: [
        { accountCode: '1010', debit: 100000, credit: 0 },
        { accountCode: '3000', debit: 0, credit: 100000 },
      ],
    });

    expect(journalB.totalDebit).toBe(100000);

    const cashA = await CashManagementService.getCashPosition(tenantA);
    const cashB = await CashManagementService.getCashPosition(tenantB);

    // Tenant B's balances do not leak into Tenant A
    expect(cashB.breakdown.operatingBank).toBe(100000);
    expect(cashA.breakdown.operatingBank).not.toBe(100000);
  });
});
