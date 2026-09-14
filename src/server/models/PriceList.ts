import mongoose, { Schema, type Document } from 'mongoose';

export type PriceListType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'B2B' | 'VIP';

export interface IPriceList extends Document {
  tenantId: string;
  companyId: string;
  code: string;
  name: string;
  type: PriceListType;
  currency: string;
  customerGroupId?: string;
  channelId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PriceListSchema = new Schema<IPriceList>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'B2B', 'VIP'],
      default: 'RETAIL',
      required: true,
      index: true,
    },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    customerGroupId: { type: String, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
  },
  { timestamps: true }
);

PriceListSchema.index({ tenantId: 1, companyId: 1, code: 1 }, { unique: true });

export const PriceList = mongoose.model<IPriceList>('PriceList', PriceListSchema);
