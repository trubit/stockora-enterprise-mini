import mongoose from 'mongoose';
import { MarketingCampaign, IMarketingCampaign } from '../models/MarketingCampaign.js';
import { CampaignRecipient, ICampaignRecipient } from '../models/CampaignRecipient.js';
import { Customer, ICustomer } from '../models/Customer.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { SegmentationService } from './segmentation.service.js';
import { NotificationService } from './notification.service.js';
import { CRMService } from './crm.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export interface ICreateCampaignPayload {
  title: string;
  description?: string;
  type?: any;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
  targetSegmentId?: string;
  messageSubject?: string;
  messageTemplate: string;
  couponCode?: string;
  budgetCost?: number;
  scheduledAt?: Date;
  tenantId?: string;
  userId?: string;
}

export class CampaignAdvancedService {
  /**
   * 1. Create a Marketing Campaign with Audience Estimation
   */
  public static async createCampaign(payload: ICreateCampaignPayload): Promise<IMarketingCampaign> {
    const tenantId = payload.tenantId || 'default';
    return await ResilientExecutor.execute(
      { name: `create-campaign:${payload.title}` },
      async () => {
        let targetSegmentName: string | undefined;
        let targetCount = 0;

        if (payload.targetSegmentId) {
          const segment = await CustomerSegment.findOne({
            _id: payload.targetSegmentId,
            tenantId,
          });
          if (segment) {
            targetSegmentName = segment.name;
            const customerIds = await SegmentationService.getCustomerIdsInSegment(
              segment._id.toString(),
              tenantId
            );
            targetCount = customerIds.length;
          }
        } else {
          targetCount = await Customer.countDocuments({ tenantId, isActive: true });
        }

        const campaign = await MarketingCampaign.create({
          tenantId,
          title: payload.title,
          description: payload.description,
          type: payload.type || 'PROMOTIONAL',
          channel: payload.channel,
          targetSegmentId: payload.targetSegmentId
            ? new mongoose.Types.ObjectId(payload.targetSegmentId)
            : undefined,
          targetSegmentName,
          messageSubject: payload.messageSubject,
          messageTemplate: payload.messageTemplate,
          couponCode: payload.couponCode,
          budgetCost: payload.budgetCost || 0,
          status:
            payload.scheduledAt && new Date(payload.scheduledAt) > new Date()
              ? 'SCHEDULED'
              : 'DRAFT',
          scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
          stats: {
            targetCount,
            sentCount: 0,
            deliveredCount: 0,
            openedCount: 0,
            clickedCount: 0,
            convertedCount: 0,
            totalRevenue: 0,
            failedCount: 0,
          },
          createdBy: payload.userId ? new mongoose.Types.ObjectId(payload.userId) : undefined,
        });

        logger.info(
          `[Campaign] Created campaign ${campaign.title} (Status: ${campaign.status}, Audience: ${targetCount})`
        );
        return campaign;
      }
    );
  }

  /**
   * 2. Dispatch Campaign to Targeted & Consented Audience with Idempotency & Retries
   */
  public static async dispatchCampaign(
    campaignId: string,
    tenantId: string = 'default'
  ): Promise<IMarketingCampaign> {
    return await ResilientExecutor.execute(
      { name: `campaign-dispatch:${campaignId}` },
      async () => {
        const campaign = await MarketingCampaign.findOne({ _id: campaignId, tenantId });
        if (!campaign) {
          throw new Error(`Campaign not found: ${campaignId}`);
        }

        if (campaign.status === 'COMPLETED') {
          throw new Error('Campaign has already completed.');
        }

        // 1. Fetch Target Audience
        let customers: ICustomer[] = [];
        if (campaign.targetSegmentId) {
          const segment = await CustomerSegment.findOne({
            _id: campaign.targetSegmentId,
            tenantId,
          });
          if (segment) {
            const query = SegmentationService.compileRulesToMongoQuery(
              segment.rules,
              segment.conjunction,
              tenantId
            );
            customers = await Customer.find(query);
          }
        } else {
          customers = await Customer.find({ tenantId, isActive: true });
        }

        // 2. Filter by Consent & Communication Preferences
        const eligibleRecipients = customers.filter((c) => {
          if (!c.optInMarketing) return false;
          if (campaign.channel === 'SMS' && (!c.optInSms || !c.phone)) return false;
          if (campaign.channel === 'WHATSAPP' && (!c.optInWhatsapp || !c.phone)) return false;
          if (campaign.channel === 'EMAIL' && !c.email) return false;
          return true;
        });

        campaign.status = 'ACTIVE';
        campaign.sentAt = new Date();
        campaign.stats.targetCount = eligibleRecipients.length;
        await campaign.save();

        let sentCount = 0;
        let failedCount = 0;

        // 3. Process Batch with Idempotency
        for (const cust of eligibleRecipients) {
          const idempotencyKey = `CAMP:${campaign._id}:${cust._id}`;
          const recipientAddress =
            campaign.channel === 'EMAIL' ? cust.email : cust.phone || cust.email;

          // Check if already dispatched
          const existingRecipient = await CampaignRecipient.findOne({
            tenantId,
            campaignId: campaign._id,
            customerId: cust._id,
          });

          if (existingRecipient && existingRecipient.status !== 'QUEUED') {
            continue; // Already processed
          }

          try {
            const renderedBody = campaign.messageTemplate
              .replace(/\{\{name\}\}/g, cust.name)
              .replace(/\{\{coupon\}\}/g, campaign.couponCode || '')
              .replace(/\{\{tier\}\}/g, cust.loyaltyTier || 'BRONZE');

            // Send through notification gateway / provider abstraction
            await NotificationService.send({
              type: 'INFO',
              title: campaign.messageSubject || `📣 ${campaign.title}`,
              body: renderedBody,
              channels:
                campaign.channel === 'EMAIL'
                  ? ['EMAIL']
                  : campaign.channel === 'SMS'
                    ? ['SMS']
                    : ['IN_APP'],
              userId: cust._id.toString(),
            });

            await CampaignRecipient.findOneAndUpdate(
              { tenantId, campaignId: campaign._id, customerId: cust._id },
              {
                tenantId,
                campaignId: campaign._id,
                customerId: cust._id,
                customerName: cust.name,
                recipientAddress,
                channel: campaign.channel,
                status: 'DELIVERED',
                idempotencyKey,
                deliveredAt: new Date(),
                $inc: { attempts: 1 },
              },
              { upsert: true, new: true }
            );

            await CRMService.recordTimelineEvent(
              cust._id.toString(),
              'CAMPAIGN_SENT',
              `Received Campaign: ${campaign.title}`,
              `Delivered via ${campaign.channel}.`,
              { campaignId: campaign._id, channel: campaign.channel },
              undefined,
              undefined,
              tenantId
            );

            sentCount++;
          } catch (err: any) {
            logger.error(`[Campaign] Failed sending to customer ${cust.email}:`, err.message);
            failedCount++;

            await CampaignRecipient.findOneAndUpdate(
              { tenantId, campaignId: campaign._id, customerId: cust._id },
              {
                tenantId,
                campaignId: campaign._id,
                customerId: cust._id,
                customerName: cust.name,
                recipientAddress,
                channel: campaign.channel,
                status: 'FAILED',
                idempotencyKey,
                errorMessage: err.message,
                $inc: { attempts: 1 },
              },
              { upsert: true }
            );
          }
        }

        campaign.status = 'COMPLETED';
        campaign.completedAt = new Date();
        campaign.stats.sentCount = sentCount;
        campaign.stats.deliveredCount = sentCount;
        campaign.stats.failedCount = failedCount;
        await campaign.save();

        logger.info(
          `[Campaign] Completed dispatch for ${campaign.title}: Sent ${sentCount}, Failed ${failedCount}`
        );
        return campaign;
      }
    );
  }

  /**
   * 3. Pause or Cancel Campaign
   */
  public static async updateCampaignStatus(
    campaignId: string,
    status: 'PAUSED' | 'CANCELLED' | 'ACTIVE',
    tenantId: string = 'default'
  ): Promise<IMarketingCampaign> {
    const campaign = await MarketingCampaign.findOneAndUpdate(
      { _id: campaignId, tenantId },
      { status },
      { new: true }
    );
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    return campaign;
  }
}
