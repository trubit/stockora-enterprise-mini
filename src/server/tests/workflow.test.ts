import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { WorkflowDefinition } from '../models/WorkflowDefinition.js';
import { WorkflowInstance } from '../models/WorkflowInstance.js';
import { BusinessRule } from '../models/BusinessRule.js';
import { Task } from '../models/Task.js';
import { SLAPolicy } from '../models/SLAPolicy.js';
import { RuleService } from '../services/rule.service.js';
import { WorkflowService } from '../services/workflow.service.js';
import { TaskService } from '../services/task.service.js';

describe('Phase 26 Workflow bpm, rules, and SLA tests', () => {
  const companyId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri =
        process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    // Non-destructive teardown
  });

  it('should correctly evaluate rules logic with operators', async () => {
    // Register business rule
    const rule = await BusinessRule.create({
      companyId,
      name: 'High Purchase Order Value Policy',
      triggerEvent: 'PO_CREATED',
      conditions: [
        { field: 'totalValue', operator: 'GREATER_THAN', value: '5000' },
        { field: 'category', operator: 'CONTAINS', value: 'electronics' },
      ],
      actions: [{ type: 'APPROVE', config: {} }],
    });

    const match = RuleService.evaluateRule(rule, {
      totalValue: 6000,
      category: 'Consumer Electronics',
    });
    expect(match).toBe(true);

    const noMatch = RuleService.evaluateRule(rule, {
      totalValue: 4000,
      category: 'Consumer Electronics',
    });
    expect(noMatch).toBe(false);
  });

  it('should start a workflow, process steps, create approval tasks, and complete after response', async () => {
    // 1. Definition configuration
    await WorkflowDefinition.create({
      companyId,
      name: 'Sales Approval Flow',
      triggerEvent: 'SALE_COMPLETED',
      steps: [
        { id: 'step-1', type: 'START', name: 'Start Flow', config: {} },
        {
          id: 'step-2',
          type: 'APPROVAL',
          name: 'Manager Audit Sign-off',
          config: { assignedRole: 'Manager', priority: 'HIGH' },
        },
        { id: 'step-3', type: 'END', name: 'End Flow', config: {} },
      ],
    });

    // 2. Start running workflow instance
    const instance = await WorkflowService.startWorkflow(companyId.toString(), 'SALE_COMPLETED', {
      totalAmount: 120,
    });

    expect(instance).toBeDefined();
    expect(instance?.status).toBe('RUNNING');

    // 3. Confirm that the human approval step created a pending task
    const task = await Task.findOne({
      companyId,
      workflowInstanceId: instance?._id,
      stepId: 'step-2',
      status: 'PENDING',
    });

    expect(task).toBeDefined();
    expect(task?.assignedRole).toBe('Manager');

    // 4. Perform approval response simulation
    await WorkflowService.handleApproval(task!._id.toString(), userId.toString(), 'APPROVE');

    // 5. Verify task status and workflow completion status
    const updatedTask = await Task.findById(task?._id);
    expect(updatedTask?.status).toBe('COMPLETED');

    const updatedInstance = await WorkflowInstance.findById(instance?._id);
    expect(updatedInstance?.status).toBe('COMPLETED');
  });

  it('should escalate overdue tasks based on SLA Policies configuration', async () => {
    // 1. Register an active SLA Policy
    await SLAPolicy.create({
      companyId,
      name: 'High Priority SLA Policy',
      targetType: 'TASK',
      triggerEvent: 'TASK_BREACH',
      warningThresholdMinutes: 10,
      breachThresholdMinutes: 20,
      escalationAction: 'ESCALATE_TO_ROLE',
      escalationTarget: 'VP Operations',
    });

    // 2. Create a task that is past its due date
    const overdueTask = await Task.create({
      companyId,
      title: 'Delayed Warehouse Transfer Audit',
      priority: 'CRITICAL',
      status: 'PENDING',
      assignedRole: 'Warehouse Supervisor',
      dueDate: new Date(Date.now() - 60000), // 1 minute in the past
    });

    // 3. Trigger SRE/BPM SLA escalation sweep
    await TaskService.escalateOverdueTasks();

    // 4. Verify escalation assigned to policy target role
    const updated = await Task.findById(overdueTask._id);
    expect(updated?.status).toBe('ESCALATED');
    expect(updated?.slaStatus).toBe('BREACHED');
    expect(updated?.assignedRole).toBe('VP Operations');
  });
});
