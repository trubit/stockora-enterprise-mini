import mongoose from 'mongoose';
import {
  WorkflowDefinition,
  type IWorkflowDefinition,
  type IWorkflowStep,
} from '../models/WorkflowDefinition.js';
import {
  WorkflowInstance,
  type IWorkflowInstance,
  type IStepExecutionLog,
} from '../models/WorkflowInstance.js';
import { Task } from '../models/Task.js';
import { RuleService } from './rule.service.js';
import { NotificationService } from './notification.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import axios from 'axios';
import { logger } from '../logger.js';

export class WorkflowService {
  /**
   * Start a workflow instance triggered by an event
   */
  public static async startWorkflow(
    companyId: string,
    triggerEvent: string,
    variables: Record<string, unknown>
  ): Promise<IWorkflowInstance | null> {
    const definition = await WorkflowDefinition.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      triggerEvent,
      isActive: true,
    });

    if (!definition) {
      logger.info(`[Workflow] No active workflow definition for event: ${triggerEvent}`);
      return null;
    }

    const instance = await WorkflowInstance.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      definitionId: definition._id,
      triggerEvent,
      status: 'RUNNING',
      variables,
      executionLogs: [],
    });

    logger.info(`[Workflow] Started instance ${instance._id} of definition ${definition.name}`);

    // Begin execution with the first step
    if (definition.steps && definition.steps.length > 0) {
      await this.executeStep(instance._id.toString(), definition.steps[0].id);
    } else {
      instance.status = 'COMPLETED';
      await instance.save();
    }

    return instance;
  }

  /**
   * Execute a single workflow step
   */
  public static async executeStep(instanceId: string, stepId: string): Promise<void> {
    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance || instance.status !== 'RUNNING') return;

    const definition = await WorkflowDefinition.findById(instance.definitionId);
    if (!definition) return;

    const step = definition.steps.find((s: IWorkflowStep) => s.id === stepId);
    if (!step) {
      logger.error(`[Workflow] Step ${stepId} not found in definition ${definition._id}`);
      return;
    }

    instance.currentStepId = stepId;
    instance.executionLogs.push({
      stepId,
      status: 'PENDING',
      startedAt: new Date(),
    });
    await instance.save();

    try {
      await this.processStep(instance, step, definition);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Workflow] Step ${stepId} execution failed: ${errMsg}`);

      const log = instance.executionLogs.find(
        (l: IStepExecutionLog) => l.stepId === stepId && l.status === 'PENDING'
      );
      if (log) {
        log.status = 'FAILED';
        log.completedAt = new Date();
        log.error = errMsg;
      }
      instance.status = 'FAILED';
      await instance.save();
    }
  }

  /**
   * Process logic for a workflow step
   */
  private static async processStep(
    instance: IWorkflowInstance,
    step: IWorkflowStep,
    definition: IWorkflowDefinition
  ): Promise<void> {
    const log = instance.executionLogs.find((l) => l.stepId === step.id && l.status === 'PENDING');

    switch (step.type) {
      case 'START':
        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        await instance.save();
        await this.advanceNext(instance, step, definition);
        break;

      case 'END':
        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        instance.status = 'COMPLETED';
        await instance.save();
        break;

      case 'NOTIFICATION': {
        const targetRole = step.config.targetRole || 'Manager';
        const title = step.config.title || 'Workflow Notification';
        const body = step.config.body || `Workflow ${definition.name} notification.`;

        await NotificationService.send({
          targetRole,
          type: 'SYSTEM',
          title,
          body,
          channels: ['IN_APP'],
        });

        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        await instance.save();
        await this.advanceNext(instance, step, definition);
        break;
      }

      case 'APPROVAL': {
        const role = step.config.assignedRole || 'Manager';
        const title = step.config.title || `Workflow Approval Required`;
        const desc = step.config.description || `Please approve the step in ${definition.name}`;

        await Task.create({
          companyId: instance.companyId,
          workflowInstanceId: instance._id,
          stepId: step.id,
          title,
          description: desc,
          priority: step.config.priority || 'HIGH',
          status: 'PENDING',
          assignedRole: role,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24 hrs SLA
        });

        logger.info(`[Workflow] approval step paused. Created Task for role: ${role}`);
        break;
      }

      case 'API_CALL': {
        const url = step.config.url;
        const method = (step.config.method || 'POST').toUpperCase();

        if (url) {
          // Resilient outbound integration execution
          await ResilientExecutor.execute({ name: `workflow-api:${step.id}` }, async () => {
            logger.info(`[Workflow] Triggering outbound API: ${method} ${url}`);
            const response = await axios({
              method: method as any,
              url,
              data: instance.variables || {},
              timeout: 10000,
            });
            return response.data;
          });
        }

        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        await instance.save();
        await this.advanceNext(instance, step, definition);
        break;
      }

      case 'DECISION': {
        const targetField = step.config.field;
        const operator = step.config.operator;
        const value = step.config.value;
        const trueStepId = step.config.trueStepId;
        const falseStepId = step.config.falseStepId;

        const payloadVal = instance.variables[targetField];
        const conditionMatches = RuleService.evaluateCondition(payloadVal, operator, value);

        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        await instance.save();

        const targetNext = conditionMatches ? trueStepId : falseStepId;
        if (targetNext) {
          await this.executeStep(instance._id.toString(), targetNext);
        } else {
          await this.advanceNext(instance, step, definition);
        }
        break;
      }

      default:
        if (log) {
          log.status = 'COMPLETED';
          log.completedAt = new Date();
        }
        await instance.save();
        await this.advanceNext(instance, step, definition);
    }
  }

  /**
   * Helper to advance to next step sequentially
   */
  private static async advanceNext(
    instance: IWorkflowInstance,
    currentStep: IWorkflowStep,
    definition: IWorkflowDefinition
  ): Promise<void> {
    const currentIndex = definition.steps.findIndex((s) => s.id === currentStep.id);
    if (currentIndex !== -1 && currentIndex + 1 < definition.steps.length) {
      const nextStep = definition.steps[currentIndex + 1];
      await this.executeStep(instance._id.toString(), nextStep.id);
    } else {
      instance.status = 'COMPLETED';
      await instance.save();
    }
  }

  /**
   * Handle dynamic human tasks interaction approval callback
   */
  public static async handleApproval(
    taskId: string,
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ): Promise<void> {
    const task = await Task.findById(taskId);
    if (!task || task.status !== 'PENDING') return;

    task.status = action === 'APPROVE' ? 'COMPLETED' : 'CANCELLED';
    task.completedBy = new mongoose.Types.ObjectId(userId);
    task.completedAt = new Date();
    await task.save();

    const instance = await WorkflowInstance.findById(task.workflowInstanceId);
    if (!instance || instance.status !== 'RUNNING') return;

    const log = instance.executionLogs.find(
      (l: IStepExecutionLog) => l.stepId === task.stepId && l.status === 'PENDING'
    );
    if (log) {
      log.status = action === 'APPROVE' ? 'COMPLETED' : 'FAILED';
      log.completedAt = new Date();
      log.actionTakenBy = new mongoose.Types.ObjectId(userId);
    }

    if (action === 'REJECT') {
      instance.status = 'FAILED';
      await instance.save();
      logger.info(`[Workflow] Instance ${instance._id} rejected by user ${userId}`);
      return;
    }

    await instance.save();

    // Advance to the next step
    const definition = await WorkflowDefinition.findById(instance.definitionId);
    if (definition && task.stepId) {
      const currentStep = definition.steps.find((s: IWorkflowStep) => s.id === task.stepId);
      if (currentStep) {
        await this.advanceNext(instance, currentStep, definition);
      }
    }
  }
}
