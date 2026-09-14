import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const workflowRouter = Router();

workflowRouter.use(authMiddleware);

workflowRouter.get(
  '/definitions',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_READ]),
  WorkflowController.getDefinitions
);

workflowRouter.post(
  '/definitions',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_WRITE]),
  WorkflowController.saveDefinition
);

workflowRouter.post(
  '/trigger',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_WRITE]),
  WorkflowController.triggerWorkflow
);

workflowRouter.get(
  '/tasks',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_READ]),
  WorkflowController.getTasks
);

workflowRouter.post(
  '/tasks/approve',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_WRITE]),
  WorkflowController.approveTask
);

workflowRouter.get(
  '/instances',
  rbacMiddleware([SYSTEM_PERMISSIONS.WORKFLOWS_READ]),
  WorkflowController.getInstances
);
