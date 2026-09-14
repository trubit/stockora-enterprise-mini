import { Router } from 'express';
import { ReportingController } from '../controllers/reporting.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const reportingRouter = Router();

reportingRouter.use(authMiddleware);

reportingRouter.get(
  '/summary',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getExecutiveSummary
);

reportingRouter.get(
  '/inventory',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getInventoryReport
);

reportingRouter.get(
  '/sales',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getSalesReport
);

reportingRouter.get(
  '/kpis',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getKPIs
);

reportingRouter.post(
  '/saved',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  ReportingController.saveReport
);

reportingRouter.get(
  '/saved',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getSavedReports
);

reportingRouter.post(
  '/scheduled',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  ReportingController.createSchedule
);

reportingRouter.get(
  '/scheduled',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getScheduledReports
);

reportingRouter.get(
  '/exports',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  ReportingController.getExportHistory
);
