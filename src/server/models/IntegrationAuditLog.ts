import mongoose, { Schema, type Document } from 'mongoose';

export type IntegrationAuditAction =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'CREDENTIALS_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'WEBHOOK_CREATED'
  | 'WEBHOOK_UPDATED'
  | 'WEBHOOK_DELETED'
  | 'WEBHOOK_REPLAYED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'API_KEY_ROTATED'
  | 'IMPORT_STARTED'
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'EXPORT_REQUESTED'
  | 'EXPORT_COMPLETED'
  | 'EXPORT_DOWNLOADED';

export interface IIntegrationAuditLog extends Document {
  tenantId: string;
  action: IntegrationAuditAction;
  provider?: string;
  resourceId?: string;
  details: Record<string, any>;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const IntegrationAuditLogSchema = new Schema<IIntegrationAuditLog>(
  {
    tenantId: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    provider: { type: String, index: true },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
    performedBy: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

IntegrationAuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const IntegrationAuditLog = mongoose.model<IIntegrationAuditLog>(
  'IntegrationAuditLog',
  IntegrationAuditLogSchema
);
