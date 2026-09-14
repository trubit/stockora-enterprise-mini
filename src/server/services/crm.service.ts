import mongoose from 'mongoose';
import { Customer, ICustomer, ChurnRiskLevel } from '../models/Customer.js';
import { CustomerTimeline, CustomerEventType } from '../models/CustomerTimeline.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { Transaction } from '../models/Transaction.js';
import { CustomerRetentionService } from './customerRetention.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class CRMService {
  /**
   * Retrieves complete Customer 360 Profile with Timeline & Metrics
   */
  public static async getCustomer360(customerId: string, tenantId: string = 'default') {
    return await ResilientExecutor.execute({ name: `customer360:${customerId}` }, async () => {
      const query: any = { _id: customerId };
      if (tenantId && tenantId !== 'default') {
        query.tenantId = tenantId;
      }
      const customer = await Customer.findOne(query);

      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const timelineFilter: any = {
        $or: [
          { customerId: customer._id },
          ...(mongoose.isValidObjectId(customerId)
            ? [{ customerId: new mongoose.Types.ObjectId(customerId) }]
            : []),
        ],
      };

      const timeline = await CustomerTimeline.find(timelineFilter)
        .sort({ createdAt: -1 })
        .limit(50);

      const recentOrders = await Transaction.find({
        $or: [
          ...(customer.email ? [{ customerEmail: customer.email }] : []),
          { customerId: customer._id },
          { customerId: customerId },
        ],
        status: 'COMPLETED',
      })
        .sort({ createdAt: -1 })
        .limit(10);

      return {
        customer,
        timeline,
        recentOrders,
      };
    });
  }

  /**
   * Records a Customer Timeline activity event with tenant scoping
   */
  public static async recordTimelineEvent(
    customerId: string,
    eventType: CustomerEventType,
    title: string,
    description?: string,
    metadata?: Record<string, unknown>,
    authorId?: string,
    authorName?: string,
    tenantId: string = 'default'
  ) {
    const validCustId = mongoose.isValidObjectId(customerId)
      ? new mongoose.Types.ObjectId(customerId)
      : customerId;

    return await CustomerTimeline.create({
      tenantId,
      companyId: 'default',
      customerId: validCustId,
      eventType,
      title,
      description,
      metadata,
      authorId:
        authorId && mongoose.isValidObjectId(authorId)
          ? new mongoose.Types.ObjectId(authorId)
          : undefined,
      authorName,
    });
  }

  /**
   * Recalculates customer analytics (CLV, AOV, Churn Risk) from transaction history
   */
  public static async recalculateCustomerMetrics(
    customerId: string,
    tenantId: string = 'default'
  ): Promise<ICustomer> {
    return await ResilientExecutor.execute({ name: `crm-metrics:${customerId}` }, async () => {
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

      const txList = await Transaction.find({
        $or: [
          ...(customer.email ? [{ customerEmail: customer.email }] : []),
          { customerId: customer._id },
          { customerId: customerId },
        ],
        status: 'COMPLETED',
      }).sort({ createdAt: 1 });

      const totalOrders = txList.length;
      let totalSpending = 0;
      let firstPurchaseDate: Date | undefined;
      let lastPurchaseDate: Date | undefined;

      if (totalOrders > 0) {
        firstPurchaseDate = txList[0].createdAt;
        lastPurchaseDate = txList[totalOrders - 1].createdAt;
        totalSpending = txList.reduce((acc, t) => acc + (t.total || 0), 0);
      }

      const avgOrderValue = totalOrders > 0 ? Number((totalSpending / totalOrders).toFixed(2)) : 0;

      customer.totalOrders = totalOrders;
      customer.totalSpending = totalSpending;
      customer.avgOrderValue = avgOrderValue;
      customer.firstPurchaseDate = firstPurchaseDate;
      customer.lastPurchaseDate = lastPurchaseDate;
      await customer.save();

      // Recalculate RFM & CLV retention profile
      return await CustomerRetentionService.evaluateCustomerRetentionProfile(
        customer._id.toString(),
        tenantId
      );
    });
  }

  /**
   * Detect duplicate customer accounts by email or phone
   */
  public static async findDuplicateCustomers(tenantId: string = 'default'): Promise<
    Array<{
      matchKey: string;
      customers: Array<{
        _id: string;
        name: string;
        email: string;
        phone?: string;
        totalSpending: number;
      }>;
    }>
  > {
    const duplicates: any[] = [];

    // Group by email duplicates
    const emailDups = await Customer.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: '$_id',
              name: '$name',
              email: '$email',
              phone: '$phone',
              totalSpending: '$totalSpending',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    for (const d of emailDups) {
      duplicates.push({ matchKey: `Email: ${d._id}`, customers: d.docs });
    }

    return duplicates;
  }

  /**
   * Merge secondary customer record into primary customer with full audit trail
   */
  public static async mergeCustomers(
    primaryId: string,
    secondaryId: string,
    tenantId: string = 'default'
  ): Promise<ICustomer> {
    return await ResilientExecutor.execute(
      { name: `merge-customers:${primaryId}:${secondaryId}` },
      async () => {
        const [primary, secondary] = await Promise.all([
          Customer.findOne({ _id: primaryId, tenantId }),
          Customer.findOne({ _id: secondaryId, tenantId }),
        ]);

        if (!primary || !secondary) {
          throw new Error('Both primary and secondary customer accounts must exist for merging.');
        }

        // Merge loyalty points and spending
        primary.loyaltyPoints += secondary.loyaltyPoints;
        primary.totalSpending += secondary.totalSpending;
        primary.totalOrders += secondary.totalOrders;

        // Merge tags
        for (const t of secondary.tags) {
          if (!primary.tags.includes(t)) primary.tags.push(t);
        }

        // Deactivate secondary account
        secondary.isActive = false;
        secondary.notes = `Merged into primary customer ${primary.code} (${primary._id}) on ${new Date().toISOString()}`;
        await secondary.save();

        await primary.save();

        await this.recordTimelineEvent(
          primary._id.toString(),
          'CUSTOMER_UPDATED',
          `Merged Account: ${secondary.name} (${secondary.email})`,
          `Consolidated loyalty points (+${secondary.loyaltyPoints} pts) and order spending.`,
          { mergedCustomerId: secondary._id },
          undefined,
          undefined,
          tenantId
        );

        logger.info(`[CRM] Merged customer ${secondary.code} into ${primary.code}`);
        return primary;
      }
    );
  }

  /**
   * Evaluates all dynamic customer segments for a tenant
   */
  public static async evaluateSegments(tenantId: string = 'default'): Promise<void> {
    const segments = await CustomerSegment.find({ tenantId, isActive: true, isDynamic: true });
    for (const segment of segments) {
      const { SegmentationService } = await import('./segmentation.service.js');
      await SegmentationService.evaluateSegment(segment._id.toString(), tenantId);
    }
  }

  /**
   * Export customer data for privacy compliance (GDPR/CCPA)
   */
  public static async exportCustomerData(customerId: string, tenantId: string = 'default') {
    const { customer, timeline, recentOrders } = await this.getCustomer360(customerId, tenantId);
    return {
      exportTimestamp: new Date().toISOString(),
      customer,
      timeline,
      recentOrders,
    };
  }
}
