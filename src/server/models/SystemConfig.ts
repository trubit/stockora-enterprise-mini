import mongoose, { Schema, type Document } from 'mongoose';

export interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface ISystemConfig extends Document {
  maintenanceMode: boolean;
  featureFlags: Map<string, boolean>;
  allowedIPs: string[];
  deniedIPs: string[];
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  passwordPolicy: IPasswordPolicy;
  taxRate: number;
  taxType: 'VAT' | 'GST' | 'SALES_TAX';
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordPolicySchema = new Schema<IPasswordPolicy>(
  {
    minLength: { type: Number, default: 8 },
    requireUppercase: { type: Boolean, default: true },
    requireLowercase: { type: Boolean, default: true },
    requireNumbers: { type: Boolean, default: true },
    requireSpecialChars: { type: Boolean, default: true },
  },
  { _id: false }
);

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    maintenanceMode: { type: Boolean, default: false },
    featureFlags: { type: Map, of: Boolean, default: {} },
    allowedIPs: [{ type: String }],
    deniedIPs: [{ type: String }],
    maxConcurrentSessions: { type: Number, default: 3 },
    sessionTimeoutMinutes: { type: Number, default: 60 },
    passwordPolicy: {
      type: PasswordPolicySchema,
      default: () => ({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      }),
    },
    taxRate: { type: Number, default: 8.0 },
    taxType: { type: String, enum: ['VAT', 'GST', 'SALES_TAX'], default: 'GST' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
