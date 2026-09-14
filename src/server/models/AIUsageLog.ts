import mongoose, { Schema, type Document } from 'mongoose';
import type { AIRequestStatus } from '../services/ai/gemini/gemini.types.js';

export interface IAIUsageLog extends Document {
  tenantId: string;
  userId?: string;
  action: string;
  modelName: string;
  providerName: string;
  prompt?: string;
  response?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  status: AIRequestStatus | 'ERROR';
  errorCategory?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AIUsageLogSchema = new Schema<IAIUsageLog>(
  {
    tenantId: { type: String, required: true, default: 'global', index: true },
    userId: { type: String, index: true },
    action: { type: String, required: true, default: 'AI_EXECUTION', index: true },
    modelName: { type: String, required: true, default: 'gemini-1.5-flash' },
    providerName: { type: String, required: true, default: 'GEMINI' },
    prompt: { type: String, default: '' },
    response: { type: String, default: '' },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'SUCCESS',
        'FAILED',
        'RATE_LIMITED',
        'QUOTA_EXCEEDED',
        'TIMEOUT',
        'INVALID_CONFIGURATION',
        'ERROR', // Legacy alias
      ],
      default: 'SUCCESS',
      index: true,
    },
    errorCategory: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AIUsageLogSchema.index({ tenantId: 1, createdAt: -1 });
AIUsageLogSchema.index({ status: 1, createdAt: -1 });

export const AIUsageLog =
  mongoose.models.AIUsageLog || mongoose.model<IAIUsageLog>('AIUsageLog', AIUsageLogSchema);
