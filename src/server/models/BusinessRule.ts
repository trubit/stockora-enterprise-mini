import mongoose, { Schema, type Document } from 'mongoose';

export interface IRuleCondition {
  field: string;
  operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL' | 'CONTAINS' | 'REGEX';
  value: string;
}

export interface IRuleAction {
  type: 'APPROVE' | 'REJECT' | 'NOTIFY' | 'TRIGGER_WORKFLOW' | 'ASSIGN_ROLE';
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  config: Record<string, any>;
}

export interface IBusinessRule extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  triggerEvent: string;
  conditions: IRuleCondition[];
  actions: IRuleAction[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RuleConditionSchema = new Schema<IRuleCondition>({
  field: { type: String, required: true },
  operator: {
    type: String,
    enum: ['GREATER_THAN', 'LESS_THAN', 'EQUAL', 'CONTAINS', 'REGEX'],
    required: true,
  },
  value: { type: String, required: true },
});

const RuleActionSchema = new Schema<IRuleAction>({
  type: {
    type: String,
    enum: ['APPROVE', 'REJECT', 'NOTIFY', 'TRIGGER_WORKFLOW', 'ASSIGN_ROLE'],
    required: true,
  },
  config: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
});

const BusinessRuleSchema = new Schema<IBusinessRule>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    triggerEvent: { type: String, required: true, index: true },
    conditions: [RuleConditionSchema],
    actions: [RuleActionSchema],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const BusinessRule =
  mongoose.models.BusinessRule || mongoose.model<IBusinessRule>('BusinessRule', BusinessRuleSchema);
