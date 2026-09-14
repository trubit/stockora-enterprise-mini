import { BusinessRule, type IBusinessRule } from '../models/BusinessRule.js';

export class RuleService {
  /**
   * Evaluate a single condition against a payload
   */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  public static evaluateCondition(fieldVal: any, operator: string, ruleVal: string): boolean {
    if (fieldVal === undefined || fieldVal === null) return false;

    switch (operator) {
      case 'GREATER_THAN':
        return Number(fieldVal) > Number(ruleVal);
      case 'LESS_THAN':
        return Number(fieldVal) < Number(ruleVal);
      case 'EQUAL':
        return String(fieldVal) === String(ruleVal);
      case 'CONTAINS':
        return String(fieldVal).toLowerCase().includes(ruleVal.toLowerCase());
      case 'REGEX':
        try {
          return new RegExp(ruleVal, 'i').test(String(fieldVal));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Evaluate a rule against variables payload
   */
  public static evaluateRule(rule: IBusinessRule, payload: Record<string, unknown>): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    // Default strategy is AND matching: all conditions must pass
    return rule.conditions.every((condition) => {
      const fieldVal = payload[condition.field];
      return this.evaluateCondition(fieldVal, condition.operator, condition.value);
    });
  }

  /**
   * Evaluate and fetch matching rules for an event
   */
  public static async evaluateRulesForEvent(
    companyId: string,
    triggerEvent: string,
    payload: Record<string, unknown>
  ): Promise<IBusinessRule[]> {
    const rules = await BusinessRule.find({
      companyId,
      triggerEvent,
      isActive: true,
    });

    return rules.filter((rule) => this.evaluateRule(rule, payload));
  }
}
