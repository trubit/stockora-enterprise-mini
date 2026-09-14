import mongoose, { Schema, type Document } from 'mongoose';

export interface IBranch extends Document {
  tenantId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: mongoose.Types.ObjectId;
  timezone?: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    timezone: { type: String, default: 'UTC' },
    isActive: { type: Boolean, default: true, index: true },
    settings: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

BranchSchema.index({ tenantId: 1, code: 1 });
BranchSchema.index({ companyId: 1, code: 1 });

export const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema);
