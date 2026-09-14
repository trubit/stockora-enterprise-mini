import mongoose from 'mongoose';
import {
  CustomerJourney,
  ICustomerJourney,
  JourneyTriggerType,
} from '../models/CustomerJourney.js';
import { Customer, ICustomer } from '../models/Customer.js';
import { NotificationService } from './notification.service.js';
import { LoyaltyAdvancedService } from './loyaltyAdvanced.service.js';
import { CRMService } from './crm.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class CustomerJourneyService {
  /**
   * 1. Trigger Journey Execution on Operational Customer Event
   */
  public static async handleJourneyTrigger(
    triggerType: JourneyTriggerType,
    customerId: string,
    tenantId: string = 'default'
  ): Promise<{ journeyName: string; executedSteps: number }[]> {
    return await ResilientExecutor.execute(
      { name: `journey-trigger:${triggerType}:${customerId}` },
      async () => {
        const activeJourneys = await CustomerJourney.find({
          tenantId,
          triggerType,
          isActive: true,
        });

        if (!activeJourneys || activeJourneys.length === 0) {
          return [];
        }

        const customer = await Customer.findOne({ _id: customerId, tenantId });
        if (!customer) return [];

        const results: { journeyName: string; executedSteps: number }[] = [];

        for (const journey of activeJourneys) {
          let stepCount = 0;
          journey.enrollmentCount += 1;

          for (const step of journey.steps) {
            if (step.type === 'ACTION') {
              await this.executeActionStep(step, customer, tenantId);
              stepCount++;
            } else if (step.type === 'CONDITION' && step.condition) {
              const meetsCondition = this.evaluateCondition(step.condition, customer);
              if (!meetsCondition) {
                // Condition not met, exit or branch
                break;
              }
            }
          }

          journey.completionCount += 1;
          await journey.save();
          results.push({ journeyName: journey.name, executedSteps: stepCount });
        }

        return results;
      }
    );
  }

  /**
   * 2. Executes Individual Action Step
   */
  private static async executeActionStep(step: any, customer: ICustomer, tenantId: string) {
    switch (step.actionType) {
      case 'SEND_EMAIL':
      case 'SEND_SMS':
      case 'SEND_PUSH':
        await NotificationService.send({
          type: 'INFO',
          title: 'Automated Journey Notification',
          body: (step.actionConfig?.message || 'Thank you for being a valued customer!').replace(
            /\{\{name\}\}/g,
            customer.name
          ),
          channels:
            step.actionType === 'SEND_EMAIL'
              ? ['EMAIL']
              : step.actionType === 'SEND_SMS'
                ? ['SMS']
                : ['IN_APP'],
          userId: customer._id.toString(),
        });
        break;

      case 'ISSUE_LOYALTY_POINTS':
        const points = Number(step.actionConfig?.points) || 100;
        customer.loyaltyPoints += points;
        customer.loyaltyHistory.push({
          date: new Date(),
          points,
          reason: `Automated Journey Reward (${step.stepId})`,
        });
        await customer.save();
        break;

      case 'ADD_TAG':
        const tag = String(step.actionConfig?.tag || 'ENGAGED');
        if (!customer.tags.includes(tag)) {
          customer.tags.push(tag);
          await customer.save();
        }
        break;

      default:
        break;
    }

    await CRMService.recordTimelineEvent(
      customer._id.toString(),
      'JOURNEY_STEP_EXECUTED',
      `Journey Action: ${step.actionType}`,
      `Automated step ${step.stepId} completed successfully.`,
      { stepId: step.stepId, actionType: step.actionType },
      undefined,
      undefined,
      tenantId
    );
  }

  /**
   * 3. Evaluates Condition Step
   */
  private static evaluateCondition(
    condition: { field: string; operator: string; value: any },
    customer: any
  ): boolean {
    const val = customer[condition.field];
    switch (condition.operator) {
      case 'EQUALS':
        return val === condition.value;
      case 'GREATER_THAN':
        return Number(val) > Number(condition.value);
      case 'LESS_THAN':
        return Number(val) < Number(condition.value);
      case 'CONTAINS':
        return Array.isArray(val)
          ? val.includes(condition.value)
          : String(val).includes(String(condition.value));
      default:
        return true;
    }
  }
}
