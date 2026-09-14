import { geminiService } from './ai/gemini/gemini.service.js';
import { AICopilotMessage } from '../models/AICopilotMessage.js';
import { KnowledgeDocument } from '../models/KnowledgeDocument.js';
import { logger } from '../logger.js';

export class CopilotService {
  /**
   * Interact with the AI Copilot using RAG context injection and authoritative Gemini service
   */
  public static async executeChat(
    sessionId: string,
    userPrompt: string,
    tenantId = 'default',
    userId?: string
  ): Promise<string> {
    // 1. Core keyword search to implement provider-agnostic baseline RAG
    const keywords = userPrompt.split(/\s+/).filter((w) => w.length > 4);
    const regexQueries = keywords.map((k) => new RegExp(k, 'i'));

    let contextText = '';
    if (regexQueries.length > 0) {
      const query: Record<string, any> = {
        $or: [{ title: { $in: regexQueries } }, { content: { $in: regexQueries } }],
      };
      if (tenantId && tenantId !== 'default') {
        query.tenantId = tenantId;
      }

      const docs = await KnowledgeDocument.find(query).limit(3);

      if (docs.length > 0) {
        contextText = docs.map((d) => `[Doc: ${d.title}] ${d.content}`).join('\n');
      }
    }

    const systemInstruction = contextText
      ? `You are Stockora Enterprise AI Copilot. Answer concisely using this business intelligence context:\n${contextText}`
      : 'You are Stockora Enterprise AI Copilot. Assist the employee with operational business inventory and sales advice.';

    const inputTokens = Math.round(userPrompt.length / 4);

    // Save User message
    await AICopilotMessage.create({
      sessionId,
      role: 'user',
      content: userPrompt,
      tokens: inputTokens,
      cost: Number((inputTokens * 0.000001).toFixed(6)),
    });

    let aiReply: string;
    try {
      const response = await geminiService.generateContent({
        tenantId,
        userId,
        action: 'copilot_chat',
        systemInstruction,
        prompt: userPrompt,
        responseMimeType: 'text/plain',
        temperature: 0.2,
      });
      aiReply = response.content;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Copilot Service] Inference failed: ${errMsg}`);
      aiReply =
        'The AI service is currently unavailable. Please verify your Gemini API key or try again in a few moments.';
    }

    // Save Assistant reply
    const outputTokens = Math.round(aiReply.length / 4);
    await AICopilotMessage.create({
      sessionId,
      role: 'assistant',
      content: aiReply,
      tokens: outputTokens,
      cost: Number((outputTokens * 0.000002).toFixed(6)),
    });

    return aiReply;
  }

  /**
   * Fetch chat logs history matching active session ID
   */
  public static async getHistory(sessionId: string): Promise<unknown[]> {
    return AICopilotMessage.find({ sessionId }).sort({ createdAt: 1 });
  }
}
