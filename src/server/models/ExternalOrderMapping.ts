import mongoose, { Schema, type Document } from 'mongoose';

export interface IExternalOrderMapping extends Document {
  tenantId: string;
  companyId: string;
  channelId: mongoose.Types.ObjectId;
  externalOrderId: string;
  internalOrderId?: mongoose.Types.ObjectId;
  internalOrderNumber?: string;
  provider: string; // e.g. 'SHOPIFY', 'WOOCOMMERCE', 'AMAZON'
  status: 'PENDING' | 'IMPORTED' | 'FAILED';
  idempotencyKey: string;
  rawPayload?: Record<string, any>;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExternalOrderMappingSchema = new Schema<IExternalOrderMapping>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    channelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', required: true, index: true },
    externalOrderId: { type: String, required: true, index: true },
    internalOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder' },
    internalOrderNumber: { type: String, index: true },
    provider: { type: String, required: true, default: 'EXTERNAL' },
    status: {
      type: String,
      enum: ['PENDING', 'IMPORTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    rawPayload: { type: Schema.Types.Mixed },
    errorReason: { type: String },
  },
  { timestamps: true }
);

ExternalOrderMappingSchema.index(
  { tenantId: 1, channelId: 1, externalOrderId: 1 },
  { unique: true }
);

export const ExternalOrderMapping = mongoose.model<IExternalOrderMapping>(
  'ExternalOrderMapping',
  ExternalOrderMappingSchema
);
