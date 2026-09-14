import mongoose, { Schema, type Document } from 'mongoose';

export type SegmentField =
  | 'totalSpending'
  | 'totalOrders'
  | 'avgOrderValue'
  | 'loyaltyTier'
  | 'churnRiskLevel'
  | 'daysSinceLastPurchase'
  | 'customerType'
  | 'group'
  | 'tags'
  | 'loyaltyPoints';

export type SegmentOperator =
  'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN' | 'NOT_IN' | 'CONTAINS';

export interface ISegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value: unknown;
}

export interface ICustomerSegment extends Document {
  tenantId: string;
  companyId?: string;
  name: string;
  code: string;
  description?: string;
  isDynamic: boolean;
  conjunction: 'AND' | 'OR';
  rules: ISegmentRule[];
  memberCount: number;
  tags: string[];
  isActive: boolean;
  lastEvaluatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentRuleSchema = new Schema<ISegmentRule>({
  field: {
    type: String,
    enum: [
      'totalSpending',
      'totalOrders',
      'avgOrderValue',
      'loyaltyTier',
      'churnRiskLevel',
      'daysSinceLastPurchase',
      'customerType',
      'group',
      'tags',
      'loyaltyPoints',
    ],
    required: true,
  },
  operator: {
    type: String,
    enum: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'CONTAINS'],
    required: true,
  },
  value: { type: Schema.Types.Mixed, required: true },
});

const CustomerSegmentSchema = new Schema<ICustomerSegment>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    isDynamic: { type: Boolean, default: true },
    conjunction: { type: String, enum: ['AND', 'OR'], default: 'AND' },
    rules: [SegmentRuleSchema],
    memberCount: { type: Number, default: 0 },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
    lastEvaluatedAt: { type: Date },
  },
  { timestamps: true }
);

CustomerSegmentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CustomerSegmentSchema.index({ tenantId: 1, isActive: 1 });

export const CustomerSegment = mongoose.model<ICustomerSegment>(
  'CustomerSegment',
  CustomerSegmentSchema
);
