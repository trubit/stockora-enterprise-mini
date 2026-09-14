import mongoose, { Schema, type Document } from 'mongoose';

export type IntegrationCategory =
  | 'Accounting'
  | 'Payments'
  | 'Shipping'
  | 'Messaging'
  | 'CRM'
  | 'ERP'
  | 'Analytics'
  | 'Storage'
  | 'Communication'
  | 'Automation'
  | 'Tax'
  | 'E-commerce'
  | 'Custom';

export type IntegrationStatus =
  'CONNECTED' | 'AVAILABLE' | 'PENDING' | 'FAILED' | 'DISABLED' | 'DEGRADED';

export type SyncDirection = 'STOCKORA_TO_EXTERNAL' | 'EXTERNAL_TO_STOCKORA' | 'BIDIRECTIONAL';

export interface IIntegration extends Document {
  tenantId: string;
  provider: string; // e.g. 'quickbooks', 'xero', 'shopify', 'slack', 'shipstation', 'custom_webhook'
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  isConfigured: boolean;
  configuration: Record<string, any>;
  credentialsEncrypted?: string;
  syncSettings: {
    enabled: boolean;
    direction: SyncDirection;
    frequencyMinutes: number;
    autoSyncOnEvent: boolean;
    conflictResolution: 'STOCKORA_WINS' | 'EXTERNAL_WINS' | 'MANUAL';
    syncedEntities: string[]; // e.g. ['products', 'orders', 'customers', 'inventory']
  };
  lastSyncAt?: Date;
  lastSyncStatus?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  lastError?: {
    message: string;
    code?: string;
    timestamp: Date;
    details?: any;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    tenantId: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'AVAILABLE', 'PENDING', 'FAILED', 'DISABLED', 'DEGRADED'],
      default: 'AVAILABLE',
      index: true,
    },
    isConfigured: { type: Boolean, default: false },
    configuration: { type: Schema.Types.Mixed, default: {} },
    credentialsEncrypted: { type: String },
    syncSettings: {
      enabled: { type: Boolean, default: false },
      direction: {
        type: String,
        enum: ['STOCKORA_TO_EXTERNAL', 'EXTERNAL_TO_STOCKORA', 'BIDIRECTIONAL'],
        default: 'STOCKORA_TO_EXTERNAL',
      },
      frequencyMinutes: { type: Number, default: 60 },
      autoSyncOnEvent: { type: Boolean, default: true },
      conflictResolution: {
        type: String,
        enum: ['STOCKORA_WINS', 'EXTERNAL_WINS', 'MANUAL'],
        default: 'STOCKORA_WINS',
      },
      syncedEntities: { type: [String], default: [] },
    },
    lastSyncAt: { type: Date },
    lastSyncStatus: { type: String, enum: ['SUCCESS', 'FAILED', 'PARTIAL'] },
    lastError: {
      message: { type: String },
      code: { type: String },
      timestamp: { type: Date },
      details: { type: Schema.Types.Mixed },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

IntegrationSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

export const Integration = mongoose.model<IIntegration>('Integration', IntegrationSchema);
