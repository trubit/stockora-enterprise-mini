import type { Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service.js';
import { Expense } from '../models/Expense.js';
import { ExpenseCategory } from '../models/ExpenseCategory.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class ExpenseController {
  public static async submitExpense(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId =
        (req as any).tenantId || (req.user as any)?.tenantId || (req.user as any)?.companyId;
      const userId = (req.user as any)?.id;

      const expense = await ExpenseService.submitExpense({
        ...req.body,
        tenantId,
        userId,
      });

      res.status(201).json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  public static async getExpenses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId =
        (req as any).tenantId || (req.user as any)?.tenantId || (req.user as any)?.companyId;
      const query: Record<string, unknown> = {};
      if (tenantId) {
        query.tenantId = tenantId;
      }

      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * limit;

      const expenses = await Expense.find(query).sort({ expenseDate: -1 }).skip(skip).limit(limit);
      res.json({ success: true, data: expenses });
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
      const id = req.params.id as string;
      const userId = (req.user as any)?.id;

      const expense = await ExpenseService.approveExpense(id, userId);
      res.json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  public static async getCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId =
        (req as any).tenantId || (req.user as any)?.tenantId || (req.user as any)?.companyId;
      const catQuery: Record<string, unknown> = { isActive: true };
      if (tenantId) {
        catQuery.tenantId = tenantId;
      }

      let categories = await ExpenseCategory.find(catQuery);

      if (categories.length === 0 && tenantId) {
        const defaults = [
          { code: '6000', name: 'Operating & Administrative' },
          { code: '6100', name: 'Rent & Lease' },
          { code: '6200', name: 'Utilities & Power' },
          { code: '6300', name: 'Salaries & Payroll' },
        ];
        for (const def of defaults) {
          try {
            await ExpenseCategory.create({
              tenantId,
              code: def.code,
              name: def.name,
              isActive: true,
            });
          } catch {
            // Already created
          }
        }
        categories = await ExpenseCategory.find(catQuery);
      }

      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }
}
