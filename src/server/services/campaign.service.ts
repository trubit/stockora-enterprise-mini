import mongoose from 'mongoose';
import { MarketingCampaign, IMarketingCampaign } from '../models/MarketingCampaign.js';
import { Coupon, ICoupon } from '../models/Coupon.js';
import { Customer } from '../models/Customer.js';
import { NotificationService } from './notification.service.js';
import { CRMService } from './crm.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class CampaignService {
  /**
   * Dispatches a marketing campaign to its targeted customer audience
   */
  public static async dispatchCampaign(campaignId: string): Promise<IMarketingCampaign> {
    return await ResilientExecutor.execute(
      { name: `campaign-dispatch:${campaignId}` },
      async () => {
        const campaign = await MarketingCampaign.findById(campaignId);
        if (!campaign) {
          throw new Error(`Campaign not found: ${campaignId}`);
        }

        if (campaign.status === 'COMPLETED') {
          throw new Error('Campaign has already been completed.');
        }

        // Audience lookup based on consent controls
        const query: any = { isActive: true, optInMarketing: true };
        const recipients = await Customer.find(query).limit(100);

        campaign.status = 'ACTIVE';
        campaign.sentAt = new Date();
        campaign.stats.targetCount = recipients.length;
        await campaign.save();

        let sentCount = 0;
        for (const cust of recipients) {
          try {
            await NotificationService.send({
              type: 'INFO',
              title: `📣 ${campaign.title}`,
              body: campaign.messageTemplate.replace(/\{\{name\}\}/g, cust.name),
              channels: ['IN_APP'],
              userId: (cust._id as mongoose.Types.ObjectId).toString(),
            });

            await CRMService.recordTimelineEvent(
              (cust._id as mongoose.Types.ObjectId).toString(),
              'CAMPAIGN_SENT',
              `Received Campaign: ${campaign.title}`,
              `Channel: ${campaign.channel}`
            );
            sentCount++;
          } catch (err) {
            logger.error(`Error sending campaign to customer ${cust.email}:`, err);
          }
        }

        campaign.status = 'COMPLETED';
        campaign.stats.sentCount = sentCount;
        campaign.stats.deliveredCount = sentCount;
        await campaign.save();

        logger.info(
          `[Campaign Service] Campaign "${campaign.title}" completed. Sent to ${sentCount} customers.`
        );
        return campaign;
      }
    );
  }

  /**
   * Validates a promotional discount coupon code for checkout
   */
  public static async validateCoupon(
    code: string,
    purchaseTotal: number
  ): Promise<{ valid: boolean; discountAmount: number; coupon?: ICoupon; message?: string }> {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return { valid: false, discountAmount: 0, message: 'Invalid or inactive coupon code.' };
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return {
        valid: false,
        discountAmount: 0,
        message: 'Coupon code has expired or is not yet active.',
      };
    }

    if (purchaseTotal < coupon.minPurchaseAmount) {
      return {
        valid: false,
        discountAmount: 0,
        message: `Minimum purchase of $${coupon.minPurchaseAmount} required.`,
      };
    }

    if (coupon.usageLimit && coupon.currentUsageCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, message: 'Coupon usage limit reached.' };
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (purchaseTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    return {
      valid: true,
      discountAmount: Number(discountAmount.toFixed(2)),
      coupon,
    };
  }
}
