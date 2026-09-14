import mongoose, { Schema, type Document } from 'mongoose';

export interface IPromptTemplate extends Document {
  name: string;
  category: string;
  templateText: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PromptTemplateSchema = new Schema<IPromptTemplate>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, index: true },
    templateText: { type: String, required: true },
    variables: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PromptTemplate =
  mongoose.models.PromptTemplate ||
  mongoose.model<IPromptTemplate>('PromptTemplate', PromptTemplateSchema);
