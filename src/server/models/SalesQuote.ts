import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesQuoteItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
}

export interface ISalesQuote extends Document {
  tenantId: string;
  companyId: string;
  quoteNumber: string;
  channelId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  salesRepId?: string;
  salesRepName?: string;
  territoryId?: mongoose.Types.ObjectId;
  items: ISalesQuoteItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  validUntil: Date;
  terms?: string;
  acceptedAt?: Date;
  convertedOrderId?: mongoose.Types.ObjectId;
  convertedOrderNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesQuoteItemSchema = new Schema<ISalesQuoteItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String },
  name: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
});

const SalesQuoteSchema = new Schema<ISalesQuote>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    quoteNumber: { type: String, required: true, unique: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customerName: { type: String },
    salesRepId: { type: String, index: true },
    salesRepName: { type: String },
    territoryId: { type: Schema.Types.ObjectId, ref: 'SalesTerritory', index: true },
    items: [SalesQuoteItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    validUntil: { type: Date, required: true },
    terms: { type: String },
    acceptedAt: { type: Date },
    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder' },
    convertedOrderNumber: { type: String, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

SalesQuoteSchema.index({ tenantId: 1, companyId: 1, quoteNumber: 1 });

export const SalesQuote = mongoose.model<ISalesQuote>('SalesQuote', SalesQuoteSchema);
