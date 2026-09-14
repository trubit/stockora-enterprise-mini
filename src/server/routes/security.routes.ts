import { Router } from 'express';
import { SecurityController } from '../controllers/security.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

const router = Router();

router.use(authenticate);
router.use(sessionGuard);

router.get('/sessions', SecurityController.listActiveSessions);
router.post('/sessions/:id/revoke', SecurityController.revokeSession);
router.get('/password-policy', SecurityController.getPasswordPolicy);
router.get('/gdpr/:userId', SecurityController.exportGDPRData);

// Admin-only operations
router.post(
  '/users/:id/force-logout',
  rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_WRITE]),
  SecurityController.forceLogoutUser
);
router.get(
  '/health',
  rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_READ]),
  SecurityController.getHealthReport
);

export { router as securityRouter };
