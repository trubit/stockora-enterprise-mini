import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { WorkflowDefinition } from '../models/WorkflowDefinition.js';
import { WorkflowInstance } from '../models/WorkflowInstance.js';
import { WorkflowService } from '../services/workflow.service.js';
import { TaskService } from '../services/task.service.js';
import { AppError, AuthorizationError } from '../errors/AppError.js';
import { Company } from '../models/Company.js';
import mongoose from 'mongoose';

export class WorkflowController {
  private static async getCompanyId(req: AuthenticatedRequest): Promise<string> {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new AuthorizationError('Tenant context required for workflow operations.');
    }

    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      const comp = await Company.findOne({
        $or: [
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          { _id: new mongoose.Types.ObjectId(tenantId) },
        ],
      });
      if (comp) return comp._id.toString();
      return tenantId;
    }

    const comp = await Company.findOne({ tenantId });
    if (comp) return comp._id.toString();
    return tenantId;
  }
  /**
   * Create or update a workflow definition
   */
  public static async saveDefinition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await WorkflowController.getCompanyId(req);

      const { name, description, triggerEvent, steps, isActive } = req.body;

      const definition = await WorkflowDefinition.findOneAndUpdate(
        { companyId, name },
        { description, triggerEvent, steps, isActive },
        { new: true, upsert: true }
      );

      res.status(200).json({ success: true, data: definition });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch all workflow definitions for a company
   */
  public static async getDefinitions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await WorkflowController.getCompanyId(req);

      const definitions = await WorkflowDefinition.find({ companyId });
      res.status(200).json({ success: true, data: definitions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger a workflow manually
   */
  public static async triggerWorkflow(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await WorkflowController.getCompanyId(req);

      const { triggerEvent, variables } = req.body;

      const instance = await WorkflowService.startWorkflow(
        companyId.toString(),
        triggerEvent,
        variables || {}
      );
      res.status(200).json({ success: true, data: instance });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get active tasks assigned to the user/role
   */
  public static async getTasks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await WorkflowController.getCompanyId(req);
      const roleName = req.user?.roleName;
      const userId = req.user?.id;

      if (!companyId || !roleName) {
        return next(
          new AppError('Unauthorized: Company or role metadata missing', 401, 'AUTHORIZATION_ERROR')
        );
      }

      const tasks = await TaskService.getPendingTasksForUser(
        companyId.toString(),
        roleName,
        userId
      );
      res.status(200).json({ success: true, data: tasks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Perform an approval or rejection action on a human task
   */
  public static async approveTask(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'AUTHENTICATION_ERROR'));

      const { taskId, action } = req.body; // action: 'APPROVE' | 'REJECT'
      if (!taskId || !action) {
        return next(new AppError('Task ID and action are required', 400, 'VALIDATION_ERROR'));
      }

      await WorkflowService.handleApproval(taskId, userId, action);
      res.status(200).json({ success: true, message: `Task response ${action} processed.` });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch instance run history logs
   */
  public static async getInstances(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await WorkflowController.getCompanyId(req);

      const instances = await WorkflowInstance.find({ companyId }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: instances });
    } catch (err) {
      next(err);
    }
  }
}
