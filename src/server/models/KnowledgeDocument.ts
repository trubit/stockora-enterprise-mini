import mongoose, { Schema, type Document } from 'mongoose';

export interface IKnowledgeDocument extends Document {
  title: string;
  content: string;
  category: 'PRODUCT' | 'POLICY' | 'SOP' | 'FAQ';
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['PRODUCT', 'POLICY', 'SOP', 'FAQ'],
      required: true,
      index: true,
    },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const KnowledgeDocument =
  mongoose.models.KnowledgeDocument ||
  mongoose.model<IKnowledgeDocument>('KnowledgeDocument', KnowledgeDocumentSchema);
