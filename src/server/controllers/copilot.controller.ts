import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { CopilotService } from '../services/copilot.service.js';
import { PromptTemplate } from '../models/PromptTemplate.js';
import { KnowledgeDocument } from '../models/KnowledgeDocument.js';
import { AppError } from '../errors/AppError.js';

export class CopilotController {
  /**
   * Execute chat request
   */
  public static async chat(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const prompt = req.body.prompt || req.body.message;
      const sessionId = req.body.sessionId || 'procurement_session_default';
      if (!prompt) {
        return next(new AppError('Prompt text is required', 400, 'VALIDATION_ERROR'));
      }

      const tenantId = req.tenantId || req.user?.tenantId?.toString() || 'default';
      const userId = req.user?.id;
      const reply = await CopilotService.executeChat(sessionId, prompt, tenantId, userId);
      res.status(200).json({ success: true, reply });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch session conversation history
   */
  public static async getHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      if (!sessionId) return next(new AppError('Session ID is required', 400, 'VALIDATION_ERROR'));

      const history = await CopilotService.getHistory(String(sessionId));
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Save a prompt template configuration
   */
  public static async saveTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name, category, templateText, variables } = req.body;

      const template = await PromptTemplate.findOneAndUpdate(
        { name },
        { category, templateText, variables, isActive: true },
        { new: true, upsert: true }
      );

      res.status(200).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch all active prompt configurations
   */
  public static async getTemplates(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const templates = await PromptTemplate.find({ isActive: true });
      res.status(200).json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Insert a document into the Knowledge Base index
   */
  public static async saveKnowledge(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, content, category, metadata } = req.body;
      if (!title || !content || !category) {
        return next(
          new AppError('Title, content, and category are required', 400, 'VALIDATION_ERROR')
        );
      }

      const doc = await KnowledgeDocument.create({ title, content, category, metadata });
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }
}
