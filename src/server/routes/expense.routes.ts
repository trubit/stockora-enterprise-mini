import { Router } from 'express';
import { ExpenseController } from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

export const expenseRouter = Router();

expenseRouter.use(authenticate);

expenseRouter.get('/', rbac(['transactions:read']), ExpenseController.getExpenses);
expenseRouter.post('/', rbac(['transactions:write']), ExpenseController.submitExpense);
expenseRouter.post('/:id/approve', rbac(['transactions:write']), ExpenseController.approveExpense);
expenseRouter.get('/categories', rbac(['transactions:read']), ExpenseController.getCategories);
