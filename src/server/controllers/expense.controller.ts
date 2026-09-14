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
      const tenantId = (req.user as any)?.tenantId || (req.user as any)?.companyId;
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
      const tenantId = (req.user as any)?.tenantId || (req.user as any)?.companyId;
      const query = tenantId
        ? { $or: [{ tenantId }, { tenantId: null }, { tenantId: { $exists: false } }] }
        : {};
      const expenses = await Expense.find(query).sort({ expenseDate: -1 });
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
      const tenantId = (req.user as any)?.tenantId || (req.user as any)?.companyId;
      let categories = await ExpenseCategory.find({
        $or: [{ tenantId: tenantId || null }, { tenantId: { $exists: false } }],
        isActive: true,
      });

      if (categories.length === 0) {
        const defaults = [
          { code: '6000', name: 'Operating & Administrative' },
          { code: '6100', name: 'Rent & Lease' },
          { code: '6200', name: 'Utilities & Power' },
          { code: '6300', name: 'Salaries & Payroll' },
        ];
        for (const def of defaults) {
          try {
            await ExpenseCategory.create({
              tenantId: tenantId || null,
              code: def.code,
              name: def.name,
              isActive: true,
            });
          } catch {
            // Already created
          }
        }
        categories = await ExpenseCategory.find({ isActive: true });
      }

      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }
}
