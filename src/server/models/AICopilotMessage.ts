import mongoose, { Schema, type Document } from 'mongoose';

export interface IAICopilotMessage extends Document {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  cost: number;
  createdAt: Date;
}

const AICopilotMessageSchema = new Schema<IAICopilotMessage>({
  sessionId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  tokens: { type: Number, default: 0 },
  cost: { type: Number, default: 0.0 },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const AICopilotMessage =
  mongoose.models.AICopilotMessage ||
  mongoose.model<IAICopilotMessage>('AICopilotMessage', AICopilotMessageSchema);
