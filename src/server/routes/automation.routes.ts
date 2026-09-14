import { Router } from 'express';
import { AutomationController } from '../controllers/automation.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

const router = Router();

router.post(
  '/trigger',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.AUTOMATION_WRITE]),
  AutomationController.triggerJob
);
router.get(
  '/metrics',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.AUTOMATION_READ]),
  AutomationController.listQueueMetrics
);
router.get(
  '/cron-jobs',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.AUTOMATION_READ]),
  AutomationController.listCronJobs
);
router.post(
  '/queue/:name/pause',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.AUTOMATION_WRITE]),
  AutomationController.pauseQueue
);
router.post(
  '/queue/:name/resume',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.AUTOMATION_WRITE]),
  AutomationController.resumeQueue
);

export { router as automationRouter };
