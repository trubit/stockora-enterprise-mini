import mongoose, { Schema, type Document } from 'mongoose';

export interface IExternalIdMapping extends Document {
  tenantId: string;
  provider: string; // e.g. 'quickbooks', 'shopify', 'xero'
  entityType: 'product' | 'customer' | 'order' | 'inventory' | 'invoice' | 'supplier';
  stockoraId: string;
  externalId: string;
  lastSyncedAt: Date;
  syncHash?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ExternalIdMappingSchema = new Schema<IExternalIdMapping>(
  {
    tenantId: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    entityType: {
      type: String,
      required: true,
      enum: ['product', 'customer', 'order', 'inventory', 'invoice', 'supplier'],
      index: true,
    },
    stockoraId: { type: String, required: true, index: true },
    externalId: { type: String, required: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now },
    syncHash: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

ExternalIdMappingSchema.index(
  { tenantId: 1, provider: 1, entityType: 1, externalId: 1 },
  { unique: true }
);

ExternalIdMappingSchema.index(
  { tenantId: 1, provider: 1, entityType: 1, stockoraId: 1 },
  { unique: true }
);

export const ExternalIdMapping = mongoose.model<IExternalIdMapping>(
  'ExternalIdMapping',
  ExternalIdMappingSchema
);
