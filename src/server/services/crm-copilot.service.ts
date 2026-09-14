import { CopilotService } from './copilot.service.js';
import { Customer } from '../models/Customer.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { MarketingCampaign } from '../models/MarketingCampaign.js';
import { KnowledgeDocument } from '../models/KnowledgeDocument.js';
import { logger } from '../logger.js';

export class CRMCopilotService {
  /**
   * Responds to natural language CRM & Customer Intelligence prompts
   */
  public static async queryCRMCopilot(sessionId: string, userQuery: string): Promise<string> {
    let contextSummary = '';

    if (/valuable|top|vip|clv|spend/i.test(userQuery)) {
      const topCusts = await Customer.find({ isActive: true }).sort({ totalSpending: -1 }).limit(5);
      if (topCusts.length > 0) {
        contextSummary += `Top Customers by Total Spending:\n${topCusts
          .map(
            (c) =>
              `- ${c.name} (${c.email}): Spent $${c.totalSpending}, CLV $${c.clvScore}, Tier ${c.loyaltyTier}`
          )
          .join('\n')}\n`;
      }
    }

    if (/churn|at risk|inactive/i.test(userQuery)) {
      const riskCusts = await Customer.find({
        churnRiskLevel: { $in: ['HIGH', 'CRITICAL'] },
      }).limit(5);
      if (riskCusts.length > 0) {
        contextSummary += `At-Risk Customers:\n${riskCusts
          .map(
            (c) =>
              `- ${c.name}: Risk Score ${c.churnRiskScore}%, Level ${c.churnRiskLevel}, Orders ${c.totalOrders}`
          )
          .join('\n')}\n`;
      }
    }

    if (/campaign|promotion|copy|segment/i.test(userQuery)) {
      const activeCampaigns = await MarketingCampaign.find().sort({ createdAt: -1 }).limit(3);
      if (activeCampaigns.length > 0) {
        contextSummary += `Recent Marketing Campaigns:\n${activeCampaigns
          .map((m) => `- ${m.title} (${m.type}): Status ${m.status}, Channel ${m.channel}`)
          .join('\n')}\n`;
      }
    }

    if (contextSummary) {
      await KnowledgeDocument.findOneAndUpdate(
        { title: 'System Dynamic CRM Intelligence Snapshot' },
        {
          title: 'System Dynamic CRM Intelligence Snapshot',
          content: contextSummary,
          category: 'CRM_INTELLIGENCE',
        },
        { upsert: true }
      );
    }

    const reply = await CopilotService.executeChat(sessionId, userQuery);
    logger.info(`[CRM Copilot] Processed prompt: "${userQuery}"`);
    return reply;
  }
}
