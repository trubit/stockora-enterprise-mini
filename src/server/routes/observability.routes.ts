import { Router } from 'express';
import { ObservabilityController } from '../controllers/observability.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const observabilityRouter = Router();

observabilityRouter.use(authMiddleware);

observabilityRouter.get(
  '/metrics',
  rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_READ]),
  ObservabilityController.getMetrics
);

observabilityRouter.get(
  '/incidents',
  rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_READ]),
  ObservabilityController.getIncidents
);

observabilityRouter.get(
  '/audit',
  rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_READ]),
  ObservabilityController.getAuditHistory
);
