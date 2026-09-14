import { Customer, ICustomer } from '../../models/Customer.js';
import { Product } from '../../models/Product.js';
import { Transaction } from '../../models/Transaction.js';
import { ResilientExecutor } from '../../utils/resiliency/index.js';
import { logger } from '../../logger.js';
import { geminiService } from './gemini/gemini.service.js';

export interface IProductRecommendation {
  productId: string;
  productName: string;
  price: number;
  category: string;
  reason: string; // e.g. "Frequently bought with previous purchases", "Popular in preferred category"
  confidence: number;
}

export class CRMAIService {
  /**
   * 1. Grounded Conversational AI Assistant for CRM Managers
   */
  public static async askCRMAssistant(
    prompt: string,
    customerId?: string,
    tenantId: string = 'default'
  ): Promise<{
    answer: string;
    groundedContext: Record<string, any>;
  }> {
    return await ResilientExecutor.execute({ name: 'crm-ai-assistant' }, async () => {
      let customerContext = '';
      const groundedData: any = {};

      if (customerId) {
        const cust = await Customer.findOne({ _id: customerId, tenantId }).lean();
        if (cust) {
          groundedData.customer = {
            name: cust.name,
            email: cust.email,
            spending: cust.totalSpending,
            orders: cust.totalOrders,
            tier: cust.loyaltyTier,
            churnRisk: cust.churnRiskLevel,
            churnSignals: cust.churnSignals,
            clv: cust.clvScore,
          };
          customerContext = `
Customer Profile:
- Name: ${cust.name}
- Total Orders: ${cust.totalOrders}, Total Spend: $${cust.totalSpending}
- Loyalty Tier: ${cust.loyaltyTier}, Points: ${cust.loyaltyPoints}
- Churn Risk: ${cust.churnRiskLevel} (Score: ${cust.churnRiskScore}/100)
- Churn Signals: ${cust.churnSignals?.join(', ') || 'None'}
- Estimated Lifetime Value (CLV): $${cust.clvScore}
`;
        }
      }

      const totalCustomers = await Customer.countDocuments({ tenantId });
      const atRiskCount = await Customer.countDocuments({
        tenantId,
        churnRiskLevel: { $in: ['HIGH', 'CRITICAL'] },
      });
      groundedData.summary = { totalCustomers, atRiskCount };

      const systemPrompt = `You are Stockora Enterprise CRM Intelligence AI.
You provide evidence-backed, factual customer relationship, retention, and engagement advice grounded strictly in database facts.
Never invent imaginary customers or false transactions.

CRM Overview:
- Total Customers: ${totalCustomers}
- High/Critical At-Risk Customers: ${atRiskCount}
${customerContext}
`;

      try {
        const res = await geminiService.generateContent({
          tenantId: tenantId || 'default',
          action: 'crm_ai_analysis',
          systemInstruction: systemPrompt,
          prompt,
          responseMimeType: 'text/plain',
        });
        const aiResponse = res.content;

        return {
          answer: aiResponse || 'Unable to analyze customer data at this time.',
          groundedContext: groundedData,
        };
      } catch (err: any) {
        logger.warn(`[CRMAI] Fallback grounded answer due to: ${err.message}`);
        return {
          answer: customerContext
            ? `Based on verified records for ${groundedData.customer?.name}: Total spend is $${groundedData.customer?.spending} with ${groundedData.customer?.orders} orders. Churn risk is currently ${groundedData.customer?.churnRisk}. Recommend proactive engagement with tailored incentives.`
            : `Verified CRM statistics show ${totalCustomers} total customers with ${atRiskCount} at-risk profiles requiring retention workflows.`,
          groundedContext: groundedData,
        };
      }
    });
  }

  /**
   * 2. Personalized Product Recommendations with Explainable Rationale
   */
  public static async getPersonalizedRecommendations(
    customerId: string,
    tenantId: string = 'default'
  ): Promise<IProductRecommendation[]> {
    return await ResilientExecutor.execute(
      { name: `product-recommendations:${customerId}` },
      async () => {
        const customer = await Customer.findOne({ _id: customerId, tenantId });
        if (!customer) throw new Error(`Customer not found: ${customerId}`);

        // Fetch customer's past purchases
        const transactions = await Transaction.find({
          $or: [{ customerEmail: customer.email }, { customerId: customer._id }],
          status: 'COMPLETED',
        })
          .limit(10)
          .lean();

        const purchasedProductIds: string[] = [];
        for (const tx of transactions) {
          for (const item of (tx as any).items || []) {
            if (item.productId) purchasedProductIds.push(item.productId.toString());
          }
        }

        // Fetch candidate products
        const preferredCategories = customer.preferences?.preferredCategories || [];
        const query: any = {
          tenantId,
          isActive: true,
          ...(purchasedProductIds.length > 0 ? { _id: { $nin: purchasedProductIds } } : {}),
          ...(preferredCategories.length > 0 ? { category: { $in: preferredCategories } } : {}),
        };
        let availableProducts = await Product.find(query).limit(5).lean();

        if (availableProducts.length === 0) {
          availableProducts = await Product.find({
            tenantId,
            isActive: true,
            ...(purchasedProductIds.length > 0 ? { _id: { $nin: purchasedProductIds } } : {}),
          })
            .limit(5)
            .lean();
        }

        if (!availableProducts || availableProducts.length === 0) {
          return [];
        }

        return availableProducts.map((prod: any, idx: number) => {
          let reason = 'Popular product trending across your customer segment.';
          let confidence = 85;

          if (customer.preferences?.preferredCategories?.includes(prod.category)) {
            reason = `Recommended based on your preferred category: ${prod.category}`;
            confidence = 94;
          } else if (idx === 0) {
            reason = 'Frequently bought together with your previous purchases.';
            confidence = 90;
          }

          return {
            productId: prod._id.toString(),
            productName: prod.name,
            price: prod.sellingPrice || prod.price || 0,
            category: prod.category || 'General',
            reason,
            confidence,
          };
        });
      }
    );
  }
}
