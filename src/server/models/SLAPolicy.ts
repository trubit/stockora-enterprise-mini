import mongoose, { Schema, type Document } from 'mongoose';

export interface ISLAPolicy extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  targetType: 'TASK' | 'WORKFLOW';
  triggerEvent: string;
  warningThresholdMinutes: number;
  breachThresholdMinutes: number;
  escalationAction: 'NOTIFY' | 'ESCALATE_TO_ROLE';
  escalationTarget: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SLAPolicySchema = new Schema<ISLAPolicy>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    targetType: {
      type: String,
      enum: ['TASK', 'WORKFLOW'],
      required: true,
      index: true,
    },
    triggerEvent: { type: String, required: true, index: true },
    warningThresholdMinutes: { type: Number, required: true },
    breachThresholdMinutes: { type: Number, required: true },
    escalationAction: {
      type: String,
      enum: ['NOTIFY', 'ESCALATE_TO_ROLE'],
      required: true,
    },
    escalationTarget: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const SLAPolicy =
  mongoose.models.SLAPolicy || mongoose.model<ISLAPolicy>('SLAPolicy', SLAPolicySchema);
