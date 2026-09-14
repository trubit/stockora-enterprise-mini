import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

const router = Router();

// --- User notifications ---
// Static paths must be declared before parameterized paths (/:id)
router.get('/', authenticate, NotificationController.listNotifications);
router.patch('/mark-all-read', authenticate, NotificationController.markAllRead);
router.patch('/:id/read', authenticate, NotificationController.markRead);
router.delete('/:id', authenticate, NotificationController.deleteNotification);

// --- Broadcast (admin/manager) ---
router.post(
  '/broadcast',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.NOTIFICATIONS_WRITE]),
  NotificationController.broadcast
);

// --- Templates ---
// /templates/* must also come before /:id routes
router.get('/templates', authenticate, NotificationController.listTemplates);
router.post(
  '/templates',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.NOTIFICATIONS_WRITE]),
  NotificationController.createTemplate
);
router.post(
  '/templates/send',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.NOTIFICATIONS_WRITE]),
  NotificationController.sendFromTemplate
);
router.put(
  '/templates/:id',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.NOTIFICATIONS_WRITE]),
  NotificationController.updateTemplate
);
router.delete(
  '/templates/:id',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.NOTIFICATIONS_WRITE]),
  NotificationController.deleteTemplate
);

export { router as notificationRouter };
