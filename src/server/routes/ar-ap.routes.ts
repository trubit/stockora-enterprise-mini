import { Router } from 'express';
import { ARAPService } from '../services/ar-ap.service.js';
import { AccountsReceivable } from '../models/AccountsReceivable.js';
import { AccountsPayable } from '../models/AccountsPayable.js';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

export const arApRouter = Router();

arApRouter.use(authenticate);

arApRouter.get('/receivables', rbac(['transactions:read']), async (req: any, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    await ARAPService.recalculateAging(tenantId);
    const ar = await AccountsReceivable.find({ tenantId: tenantId || null }).sort({ dueDate: 1 });
    res.json({ success: true, data: ar });
  } catch (err) {
    next(err);
  }
});

arApRouter.post(
  '/receivables/payment',
  rbac(['transactions:write']),
  async (req: any, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const ar = await ARAPService.recordARPayment({ ...req.body, tenantId });
      res.json({ success: true, data: ar });
    } catch (err) {
      next(err);
    }
  }
);

arApRouter.get('/payables', rbac(['transactions:read']), async (req: any, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    await ARAPService.recalculateAging(tenantId);
    const ap = await AccountsPayable.find({ tenantId: tenantId || null }).sort({ dueDate: 1 });
    res.json({ success: true, data: ap });
  } catch (err) {
    next(err);
  }
});
