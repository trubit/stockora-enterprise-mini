import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesChannelSync extends Document {
  tenantId: string;
  companyId: string;
  channelId: mongoose.Types.ObjectId;
  syncType: 'PRODUCTS' | 'INVENTORY' | 'ORDERS' | 'PRICING';
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  recordsProcessed: number;
  recordsFailed: number;
  errorDetails?: string;
  retryCount: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SalesChannelSyncSchema = new Schema<ISalesChannelSync>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    channelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', required: true, index: true },
    syncType: {
      type: String,
      enum: ['PRODUCTS', 'INVENTORY', 'ORDERS', 'PRICING'],
      required: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS'],
      default: 'IN_PROGRESS',
      required: true,
      index: true,
    },
    recordsProcessed: { type: Number, default: 0 },
    recordsFailed: { type: Number, default: 0 },
    errorDetails: { type: String },
    retryCount: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const SalesChannelSync = mongoose.model<ISalesChannelSync>(
  'SalesChannelSync',
  SalesChannelSyncSchema
);
