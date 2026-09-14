import mongoose, { Schema, type Document } from 'mongoose';

export type ApiPermissionScope =
  | 'products:read'
  | 'products:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'orders:read'
  | 'orders:write'
  | 'customers:read'
  | 'customers:write'
  | 'suppliers:read'
  | 'suppliers:write'
  | 'reports:read'
  | 'finance:read'
  | 'webhooks:manage';

export interface IApiKey extends Document {
  tenantId: string;
  name: string;
  keyId: string;
  hashedSecret: string;
  prefix: string;
  permissions: ApiPermissionScope[];
  rateLimitPerMinute: number;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy: string;
  revokedAt?: Date;
  revokedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    keyId: { type: String, required: true, unique: true, index: true },
    hashedSecret: { type: String, required: true, index: true },
    prefix: { type: String, required: true },
    permissions: {
      type: [String],
      required: true,
      default: ['products:read', 'inventory:read', 'orders:read'],
    },
    rateLimitPerMinute: { type: Number, default: 60 },
    expiresAt: { type: Date },
    lastUsedAt: { type: Date },
    createdBy: { type: String, required: true },
    revokedAt: { type: Date },
    revokedBy: { type: String },
  },
  {
    timestamps: true,
  }
);

ApiKeySchema.index({ tenantId: 1, revokedAt: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
