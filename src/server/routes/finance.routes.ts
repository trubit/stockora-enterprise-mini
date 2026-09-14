import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const financeRouter = Router();

financeRouter.use(authMiddleware);

// 1. Dashboard & Reports
financeRouter.get(
  '/report',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getFinancialReport
);
financeRouter.get(
  '/reports',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getFinancialReport
);
financeRouter.get(
  '/reports/profit-loss',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getProfitAndLossStatement
);
financeRouter.get(
  '/reports/balance-sheet',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getBalanceSheetStatement
);
financeRouter.get(
  '/reports/cashflow',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getCashflowStatement
);
financeRouter.get(
  '/reports/trial-balance',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getTrialBalanceReport
);
financeRouter.get(
  '/reports/cashflow-forecast',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getCashflowForecast
);

// 2. Chart of Accounts & General Ledger
financeRouter.get(
  '/accounts',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getChartOfAccounts
);
financeRouter.post(
  '/accounts',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.createAccount
);
financeRouter.get(
  '/journals',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getJournalEntries
);
financeRouter.post(
  '/journals',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.postJournalEntry
);
financeRouter.post(
  '/journals/:id/reverse',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.reverseJournalEntry
);

// 3. Accounts Receivable & Accounts Payable
financeRouter.get(
  '/receivables',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getReceivables
);
financeRouter.post(
  '/receivables/pay',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.recordCustomerPayment
);
financeRouter.get(
  '/payables',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getPayables
);
financeRouter.post(
  '/payables/disburse',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.recordSupplierDisbursement
);

// 4. Expense Management
financeRouter.get(
  '/expenses',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getExpenses
);
financeRouter.post(
  '/expenses',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.createExpense
);
financeRouter.post(
  '/expenses/:id/approve',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.approveExpense
);

// 5. Cash Management & Reconciliations
financeRouter.get(
  '/cash-position',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getCashPosition
);
financeRouter.post(
  '/reconciliation/gateway',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.reconcileGatewayBatch
);
financeRouter.post(
  '/reconciliation/pos-shift',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.reconcilePOSShift
);

// 6. Fiscal Periods
financeRouter.get(
  '/periods',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getFiscalPeriods
);
financeRouter.post(
  '/periods/:id/close',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.closeFiscalPeriod
);

// 7. Budgets
financeRouter.get(
  '/budgets',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.getBudgets
);
financeRouter.post(
  '/budgets',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  FinanceController.createBudget
);

// 8. AI Financial Assistant & What-If Simulations
financeRouter.post(
  '/ai/assistant',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.askFinancialAssistant
);
financeRouter.post(
  '/ai/simulate',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  FinanceController.simulateWhatIfScenario
);
