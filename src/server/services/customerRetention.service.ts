import { Customer, ICustomer, ChurnRiskLevel } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export interface INextBestAction {
  customerId: string;
  customerName: string;
  recommendedAction:
    | 'OFFER_LOYALTY_REWARD'
    | 'SEND_WIN_BACK_COUPON'
    | 'INVITE_TO_VIP'
    | 'SEND_REENGAGEMENT_REMINDER'
    | 'DO_NOTHING';
  rationale: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedImpactRevenue: number;
}

export interface IRetentionKPIs {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  atRiskCustomers: number;
  repeatPurchaseRate: number;
  averageCLV: number;
  churnRiskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export class CustomerRetentionService {
  /**
   * 1. Evaluates Churn Risk and RFM Metrics for a Customer
   */
  public static async evaluateCustomerRetentionProfile(
    customerId: string,
    tenantId: string = 'default'
  ): Promise<ICustomer> {
    return await ResilientExecutor.execute({ name: `churn-eval:${customerId}` }, async () => {
      const customer =
        (await Customer.findOne({
          _id: customerId,
          ...(tenantId
            ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
            : {}),
        })) || (await Customer.findById(customerId));

      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const now = new Date();
      const lastPurchase = customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate) : null;
      const daysSincePurchase = lastPurchase
        ? Math.floor((now.getTime() - lastPurchase.getTime()) / (1000 * 3600 * 24))
        : 999;

      const signals: string[] = [];
      let churnScore = 15; // baseline

      if (daysSincePurchase > 120) {
        churnScore += 50;
        signals.push('No purchase activity in over 120 days');
      } else if (daysSincePurchase > 60) {
        churnScore += 30;
        signals.push('Purchase gap exceeds 60 days');
      } else if (daysSincePurchase > 30) {
        churnScore += 15;
        signals.push('No purchases in the last month');
      }

      if (customer.totalOrders <= 1 && daysSincePurchase > 45) {
        churnScore += 20;
        signals.push('Single-purchase customer at risk of lapsing');
      }

      if (customer.returnsCount >= 3) {
        churnScore += 15;
        signals.push('High return frequency');
      }

      // Engagement buffer
      if (customer.loyaltyPoints > 500) {
        churnScore = Math.max(5, churnScore - 15);
      }

      churnScore = Math.min(100, Math.max(0, churnScore));

      let churnRiskLevel: ChurnRiskLevel = 'LOW';
      if (churnScore >= 75) churnRiskLevel = 'CRITICAL';
      else if (churnScore >= 50) churnRiskLevel = 'HIGH';
      else if (churnScore >= 30) churnRiskLevel = 'MEDIUM';

      customer.churnRiskScore = churnScore;
      customer.churnRiskLevel = churnRiskLevel;
      customer.churnSignals = signals;

      // Calculate CLV with Documented Methodology:
      // CLV = (AOV * Purchase Frequency * Gross Margin [35%]) * Retention Factor (1 / Churn Rate)
      const aov =
        customer.avgOrderValue ||
        (customer.totalOrders > 0 ? customer.totalSpending / customer.totalOrders : 50);
      const ordersPerYear = Math.max(1, customer.totalOrders);
      const grossMarginPct = 0.35;
      const retentionYears = Math.max(0.5, (100 - churnScore) / 30);
      const estimatedCLV = Math.round(aov * ordersPerYear * grossMarginPct * retentionYears);

      customer.clvScore = estimatedCLV;
      customer.clvMethod = 'AOV_FREQUENCY_MARGIN_MULTIPLIER';
      customer.clvConfidence = customer.totalOrders >= 3 ? 90 : 65;

      await customer.save();
      return customer;
    });
  }

  /**
   * 2. Scans for Inactive Win-Back Candidates
   */
  public static async getWinBackCandidates(
    tenantId: string = 'default',
    inactivityDays: number = 60
  ): Promise<ICustomer[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactivityDays);

    return await Customer.find({
      tenantId,
      isActive: true,
      totalOrders: { $gte: 1 },
      lastPurchaseDate: { $lte: cutoffDate },
    })
      .sort({ totalSpending: -1 })
      .limit(50);
  }

  /**
   * 3. Next-Best-Action Recommendation Engine
   */
  public static async getNextBestActions(tenantId: string = 'default'): Promise<INextBestAction[]> {
    const atRiskCustomers = await Customer.find({
      tenantId,
      isActive: true,
      churnRiskLevel: { $in: ['HIGH', 'CRITICAL', 'MEDIUM'] },
    })
      .sort({ totalSpending: -1 })
      .limit(20);

    const actions: INextBestAction[] = [];

    for (const cust of atRiskCustomers) {
      if (cust.churnRiskLevel === 'CRITICAL' && cust.totalSpending > 500) {
        actions.push({
          customerId: cust._id.toString(),
          customerName: cust.name,
          recommendedAction: 'SEND_WIN_BACK_COUPON',
          rationale: `High-value customer ($${cust.totalSpending}) has not purchased recently. A 20% win-back incentive is recommended.`,
          urgency: 'HIGH',
          estimatedImpactRevenue: Math.round(cust.avgOrderValue * 0.8),
        });
      } else if (cust.loyaltyTier === 'GOLD' || cust.loyaltyTier === 'PLATINUM') {
        actions.push({
          customerId: cust._id.toString(),
          customerName: cust.name,
          recommendedAction: 'OFFER_LOYALTY_REWARD',
          rationale: `VIP tier customer with ${cust.loyaltyPoints} points. Prompt them to redeem reward before points expire.`,
          urgency: 'MEDIUM',
          estimatedImpactRevenue: Math.round(cust.avgOrderValue),
        });
      } else if (cust.totalOrders >= 5 && cust.loyaltyTier === 'BRONZE') {
        actions.push({
          customerId: cust._id.toString(),
          customerName: cust.name,
          recommendedAction: 'INVITE_TO_VIP',
          rationale: `Frequent buyer (${cust.totalOrders} orders). Upgrading to Silver tier will solidify retention.`,
          urgency: 'MEDIUM',
          estimatedImpactRevenue: Math.round(cust.avgOrderValue * 1.2),
        });
      } else {
        actions.push({
          customerId: cust._id.toString(),
          customerName: cust.name,
          recommendedAction: 'SEND_REENGAGEMENT_REMINDER',
          rationale: `Customer exhibits medium inactivity gap. Send product catalog digest.`,
          urgency: 'LOW',
          estimatedImpactRevenue: Math.round(cust.avgOrderValue * 0.5),
        });
      }
    }

    return actions;
  }

  /**
   * 4. Aggregate Retention KPIs for Executive Dashboard
   */
  public static async getRetentionKPIs(tenantId: string = 'default'): Promise<IRetentionKPIs> {
    const totalCustomers = await Customer.countDocuments({ tenantId });
    const activeCustomers = await Customer.countDocuments({ tenantId, isActive: true });
    const inactiveCustomers = totalCustomers - activeCustomers;

    const repeatCustomers = await Customer.countDocuments({ tenantId, totalOrders: { $gt: 1 } });
    const repeatPurchaseRate =
      totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    const [low, medium, high, critical] = await Promise.all([
      Customer.countDocuments({ tenantId, churnRiskLevel: 'LOW' }),
      Customer.countDocuments({ tenantId, churnRiskLevel: 'MEDIUM' }),
      Customer.countDocuments({ tenantId, churnRiskLevel: 'HIGH' }),
      Customer.countDocuments({ tenantId, churnRiskLevel: 'CRITICAL' }),
    ]);

    const clvAgg = await Customer.aggregate([
      { $match: { tenantId } },
      { $group: { _id: null, avgCLV: { $avg: '$clvScore' } } },
    ]);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      atRiskCustomers: high + critical,
      repeatPurchaseRate,
      averageCLV: Math.round(clvAgg[0]?.avgCLV || 0),
      churnRiskDistribution: {
        low,
        medium,
        high,
        critical,
      },
    };
  }
}
