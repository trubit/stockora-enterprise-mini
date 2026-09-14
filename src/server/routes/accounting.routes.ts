import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

export const accountingRouter = Router();

accountingRouter.use(authenticate);

accountingRouter.get(
  '/accounts',
  rbac(['transactions:read']),
  FinanceController.getChartOfAccounts
);
accountingRouter.post('/accounts', rbac(['transactions:write']), FinanceController.createAccount);
accountingRouter.get('/journals', rbac(['transactions:read']), FinanceController.getJournalEntries);
accountingRouter.post(
  '/journals',
  rbac(['transactions:write']),
  FinanceController.postJournalEntry
);
accountingRouter.get('/periods', rbac(['transactions:read']), FinanceController.getFiscalPeriods);
accountingRouter.post(
  '/periods/close',
  rbac(['transactions:write']),
  FinanceController.closeFiscalPeriod
);
