import mongoose from 'mongoose';
import { Task, type ITask } from '../models/Task.js';
import { SLAPolicy } from '../models/SLAPolicy.js';
import { NotificationService } from './notification.service.js';
import { logger } from '../logger.js';

export class TaskService {
  /**
   * Fetch all pending tasks for a user based on their roles/departments
   */
  public static async getPendingTasksForUser(
    companyId: string,
    roleName: string,
    userId?: string
  ): Promise<ITask[]> {
    const query: mongoose.FilterQuery<ITask> = {
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'PENDING',
      $or: [{ assignedRole: roleName }],
    };

    if (userId && query.$or) {
      query.$or.push({ assignedUser: new mongoose.Types.ObjectId(userId) });
    }

    return Task.find(query).sort({ createdAt: -1 });
  }

  /**
   * Monitor pending tasks and escalate overdue SLA targets
   */
  public static async escalateOverdueTasks(): Promise<void> {
    const now = new Date();
    const overdueTasks = await Task.find({
      status: 'PENDING',
      dueDate: { $lte: now },
    });

    if (overdueTasks.length === 0) return;

    logger.info(`[SLA Engine] Found ${overdueTasks.length} overdue tasks to escalate.`);

    for (const task of overdueTasks) {
      task.status = 'ESCALATED';
      task.slaStatus = 'BREACHED';

      // Find an SLA Policy for task level escalation
      const policy = await SLAPolicy.findOne({
        companyId: task.companyId,
        targetType: 'TASK',
        isActive: true,
      });

      if (policy) {
        task.assignedRole = policy.escalationTarget;
        await task.save();

        // Dispatch SLA warning alerts
        await NotificationService.send({
          targetRole: policy.escalationTarget,
          type: 'SYSTEM',
          title: `[SLA Breach Warning] Task Escalated`,
          body: `Task "${task.title}" breached SLA constraints. Assigned to ${policy.escalationTarget}.`,
          channels: ['IN_APP'],
        });
      } else {
        // Fallback standard escalation
        task.assignedRole = 'Company Owner';
        await task.save();
      }

      logger.info(`[SLA Engine] Escalated task "${task.title}" (${task._id}) successfully.`);
    }
  }
}
