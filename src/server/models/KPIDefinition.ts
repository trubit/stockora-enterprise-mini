import mongoose, { Schema, type Document } from 'mongoose';

export interface IKPIDefinition extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  code: string; // e.g. "REV_GROWTH", "NET_PROFIT_MARGIN"
  name: string;
  category: 'FINANCE' | 'SALES' | 'INVENTORY' | 'SUPPLIER' | 'EMPLOYEE';
  formula: string; // Dynamic math configuration description
  targetValue: number;
  currentValue?: number;
  timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KPIDefinitionSchema = new Schema<IKPIDefinition>(
  {
    tenantId: { type: String, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['FINANCE', 'SALES', 'INVENTORY', 'SUPPLIER', 'EMPLOYEE'],
    },
    formula: { type: String, required: true },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number },
    timeframe: { type: String, required: true, enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

KPIDefinitionSchema.index({ tenantId: 1, code: 1 }, { unique: true, sparse: true });
KPIDefinitionSchema.index({ companyId: 1, code: 1 }, { unique: false, sparse: true });

export const KPIDefinition = mongoose.model<IKPIDefinition>('KPIDefinition', KPIDefinitionSchema);
