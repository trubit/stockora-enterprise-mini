import { InventoryAIService } from './ai/inventoryAI.service.js';
import { CopilotService } from './copilot.service.js';
import { logger } from '../logger.js';

export class InventoryCopilotService {
  /**
   * Responds to natural language queries regarding inventory intelligence
   */
  public static async queryInventoryCopilot(sessionId: string, userQuery: string): Promise<string> {
    try {
      // 1. First attempt to query the unified InventoryAIService
      const aiResponse = await InventoryAIService.queryInventoryCopilot(userQuery, { sessionId });
      if (aiResponse && aiResponse.trim().length > 10) {
        logger.info(`[Inventory Copilot] Processed query via InventoryAIService: "${userQuery}"`);
        return aiResponse;
      }
    } catch (err) {
      logger.warn('[Inventory Copilot] Direct AI query fallback to CopilotService:', err);
    }

    // 2. Fallback to standard Copilot RAG pipeline
    const reply = await CopilotService.executeChat(sessionId, userQuery);
    return reply;
  }
}
