import { Customer, ICustomer } from '../models/Customer.js';
import { CustomerSegment, ICustomerSegment, ISegmentRule } from '../models/CustomerSegment.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export interface ISegmentPreviewResult {
  totalCount: number;
  sampleCustomers: Array<{
    _id: string;
    name: string;
    email: string;
    phone?: string;
    totalSpending: number;
    totalOrders: number;
    loyaltyTier: string;
    churnRiskLevel: string;
  }>;
  matchingCriteriaSummary: string;
}

export class SegmentationService {
  /**
   * Compiles dynamic segment rules into a MongoDB Filter Query
   */
  public static compileRulesToMongoQuery(
    rules: ISegmentRule[],
    conjunction: 'AND' | 'OR' = 'AND',
    tenantId: string = 'default'
  ): Record<string, any> {
    if (!rules || rules.length === 0) {
      return { tenantId, isActive: true };
    }

    const clauses: Record<string, any>[] = [];

    for (const r of rules) {
      const field = r.field;
      const op = r.operator;
      const val = r.value;

      if (field === 'daysSinceLastPurchase') {
        const days = Number(val) || 0;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);

        if (op === 'GREATER_THAN') {
          // Last purchase was more than X days ago (i.e. before targetDate)
          clauses.push({ lastPurchaseDate: { $lte: targetDate } });
        } else if (op === 'LESS_THAN') {
          // Last purchase was within last X days (i.e. after targetDate)
          clauses.push({ lastPurchaseDate: { $gte: targetDate } });
        }
      } else if (field === 'tags') {
        if (op === 'CONTAINS' || op === 'EQUALS') {
          clauses.push({ tags: String(val) });
        } else if (op === 'IN') {
          clauses.push({ tags: { $in: Array.isArray(val) ? val : [val] } });
        } else if (op === 'NOT_IN') {
          clauses.push({ tags: { $nin: Array.isArray(val) ? val : [val] } });
        }
      } else {
        switch (op) {
          case 'EQUALS':
            clauses.push({ [field]: val });
            break;
          case 'NOT_EQUALS':
            clauses.push({ [field]: { $ne: val } });
            break;
          case 'GREATER_THAN':
            clauses.push({ [field]: { $gt: Number(val) } });
            break;
          case 'LESS_THAN':
            clauses.push({ [field]: { $lt: Number(val) } });
            break;
          case 'IN':
            clauses.push({ [field]: { $in: Array.isArray(val) ? val : [val] } });
            break;
          case 'NOT_IN':
            clauses.push({ [field]: { $nin: Array.isArray(val) ? val : [val] } });
            break;
          case 'CONTAINS':
            clauses.push({ [field]: { $regex: String(val), $options: 'i' } });
            break;
        }
      }
    }

    const logicOp = conjunction === 'OR' ? '$or' : '$and';
    return {
      tenantId,
      isActive: true,
      ...(clauses.length > 0 ? { [logicOp]: clauses } : {}),
    };
  }

  /**
   * Evaluates and updates dynamic segment member count
   */
  public static async evaluateSegment(
    segmentId: string,
    tenantId: string = 'default'
  ): Promise<ICustomerSegment> {
    return await ResilientExecutor.execute({ name: `evaluate-segment:${segmentId}` }, async () => {
      const segment = await CustomerSegment.findOne({ _id: segmentId, tenantId });
      if (!segment) {
        throw new Error(`Segment not found: ${segmentId}`);
      }

      if (!segment.isDynamic) {
        return segment;
      }

      const query = this.compileRulesToMongoQuery(segment.rules, segment.conjunction, tenantId);
      const count = await Customer.countDocuments(query);

      segment.memberCount = count;
      segment.lastEvaluatedAt = new Date();
      await segment.save();

      logger.info(`[Segmentation] Segment ${segment.code} evaluated: ${count} members.`);
      return segment;
    });
  }

  /**
   * Previews audience matching before saving or activating segment
   */
  public static async previewSegment(
    rules: ISegmentRule[],
    conjunction: 'AND' | 'OR' = 'AND',
    tenantId: string = 'default'
  ): Promise<ISegmentPreviewResult> {
    const query = this.compileRulesToMongoQuery(rules, conjunction, tenantId);
    const totalCount = await Customer.countDocuments(query);
    const sample = await Customer.find(query)
      .select('_id name email phone totalSpending totalOrders loyaltyTier churnRiskLevel')
      .limit(10)
      .lean();

    const criteria = rules
      .map((r) => `${r.field} ${r.operator} ${JSON.stringify(r.value)}`)
      .join(` ${conjunction} `);

    return {
      totalCount,
      sampleCustomers: sample.map((c: any) => ({
        _id: c._id.toString(),
        name: c.name,
        email: c.email,
        phone: c.phone,
        totalSpending: c.totalSpending || 0,
        totalOrders: c.totalOrders || 0,
        loyaltyTier: c.loyaltyTier || 'BRONZE',
        churnRiskLevel: c.churnRiskLevel || 'LOW',
      })),
      matchingCriteriaSummary: criteria || 'All Active Customers',
    };
  }

  /**
   * Gets list of customer IDs matching a segment
   */
  public static async getCustomerIdsInSegment(
    segmentId: string,
    tenantId: string = 'default'
  ): Promise<string[]> {
    const segment = await CustomerSegment.findOne({ _id: segmentId, tenantId });
    if (!segment) return [];

    const query = this.compileRulesToMongoQuery(segment.rules, segment.conjunction, tenantId);
    const customers = await Customer.find(query).select('_id').lean();
    return customers.map((c) => c._id.toString());
  }
}
