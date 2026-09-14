import mongoose, { Schema, type Document } from 'mongoose';

export type SalesChannelType = 'POS' | 'ONLINE' | 'B2B' | 'WHOLESALE' | 'SALES_REP' | 'MARKETPLACE';

export interface ISalesChannel extends Document {
  tenantId: string;
  companyId: string;
  code: string;
  name: string;
  type: SalesChannelType;
  isActive: boolean;
  currency: string;
  defaultWarehouseId?: mongoose.Types.ObjectId;
  allowedWarehouseIds: mongoose.Types.ObjectId[];
  priceListId?: mongoose.Types.ObjectId;
  taxConfig: {
    taxInclusive: boolean;
    defaultTaxRate: number;
    taxRegion?: string;
  };
  allowedPaymentMethods: string[];
  fulfillmentStrategy: 'DEFAULT_WAREHOUSE' | 'NEAREST' | 'SPLIT_AVAILABLE' | 'MANUAL';
  apiConfig?: {
    webhookUrl?: string;
    secretKey?: string;
    syncIntervalMinutes?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SalesChannelSchema = new Schema<ISalesChannel>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['POS', 'ONLINE', 'B2B', 'WHOLESALE', 'SALES_REP', 'MARKETPLACE'],
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    defaultWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    allowedWarehouseIds: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
    priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList' },
    taxConfig: {
      taxInclusive: { type: Boolean, default: false },
      defaultTaxRate: { type: Number, default: 0, min: 0 },
      taxRegion: { type: String },
    },
    allowedPaymentMethods: [{ type: String }],
    fulfillmentStrategy: {
      type: String,
      enum: ['DEFAULT_WAREHOUSE', 'NEAREST', 'SPLIT_AVAILABLE', 'MANUAL'],
      default: 'DEFAULT_WAREHOUSE',
    },
    apiConfig: {
      webhookUrl: { type: String },
      secretKey: { type: String },
      syncIntervalMinutes: { type: Number, default: 60 },
    },
  },
  { timestamps: true }
);

SalesChannelSchema.index({ tenantId: 1, companyId: 1, code: 1 }, { unique: true });

export const SalesChannel = mongoose.model<ISalesChannel>('SalesChannel', SalesChannelSchema);
