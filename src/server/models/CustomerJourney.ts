import mongoose, { Schema, type Document } from 'mongoose';

export type JourneyTriggerType =
  | 'CUSTOMER_CREATED'
  | 'FIRST_PURCHASE'
  | 'ABANDONED_CART'
  | 'CHURN_RISK_HIGH'
  | 'INACTIVE_30_DAYS'
  | 'LOYALTY_TIER_UPGRADED'
  | 'BIRTHDAY';

export type JourneyActionType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'SEND_PUSH'
  | 'ISSUE_LOYALTY_POINTS'
  | 'ISSUE_COUPON'
  | 'ADD_TAG'
  | 'NOTIFY_SALES_REP';

export interface IJourneyStep {
  stepId: string;
  type: 'TRIGGER' | 'DELAY' | 'CONDITION' | 'ACTION';
  delayHours?: number;
  condition?: {
    field: string;
    operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';
    value: unknown;
  };
  actionType?: JourneyActionType;
  actionConfig?: Record<string, unknown>;
  nextStepIdIfTrue?: string;
  nextStepIdIfFalse?: string;
}

export interface ICustomerJourney extends Document {
  tenantId: string;
  name: string;
  description?: string;
  triggerType: JourneyTriggerType;
  steps: IJourneyStep[];
  isActive: boolean;
  enrollmentCount: number;
  completionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const JourneyStepSchema = new Schema<IJourneyStep>({
  stepId: { type: String, required: true },
  type: {
    type: String,
    enum: ['TRIGGER', 'DELAY', 'CONDITION', 'ACTION'],
    required: true,
  },
  delayHours: { type: Number, default: 0 },
  condition: {
    field: { type: String },
    operator: { type: String, enum: ['EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS'] },
    value: { type: Schema.Types.Mixed },
  },
  actionType: {
    type: String,
    enum: [
      'SEND_EMAIL',
      'SEND_SMS',
      'SEND_PUSH',
      'ISSUE_LOYALTY_POINTS',
      'ISSUE_COUPON',
      'ADD_TAG',
      'NOTIFY_SALES_REP',
    ],
  },
  actionConfig: { type: Schema.Types.Mixed },
  nextStepIdIfTrue: { type: String },
  nextStepIdIfFalse: { type: String },
});

const CustomerJourneySchema = new Schema<ICustomerJourney>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    triggerType: {
      type: String,
      enum: [
        'CUSTOMER_CREATED',
        'FIRST_PURCHASE',
        'ABANDONED_CART',
        'CHURN_RISK_HIGH',
        'INACTIVE_30_DAYS',
        'LOYALTY_TIER_UPGRADED',
        'BIRTHDAY',
      ],
      required: true,
    },
    steps: [JourneyStepSchema],
    isActive: { type: Boolean, default: true, index: true },
    enrollmentCount: { type: Number, default: 0 },
    completionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CustomerJourneySchema.index({ tenantId: 1, triggerType: 1, isActive: 1 });

export const CustomerJourney = mongoose.model<ICustomerJourney>(
  'CustomerJourney',
  CustomerJourneySchema
);
