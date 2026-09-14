import mongoose, { Schema, type Document } from 'mongoose';

export interface IWorkflowStep {
  id: string;
  type: 'START' | 'END' | 'DECISION' | 'APPROVAL' | 'NOTIFICATION' | 'API_CALL' | 'DELAY';
  name: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  config: Record<string, any>;
}

export interface IWorkflowDefinition extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  version: number;
  triggerEvent: string;
  steps: IWorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowStepSchema = new Schema<IWorkflowStep>({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['START', 'END', 'DECISION', 'APPROVAL', 'NOTIFICATION', 'API_CALL', 'DELAY'],
    required: true,
  },
  name: { type: String, required: true },
  config: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
});

const WorkflowDefinitionSchema = new Schema<IWorkflowDefinition>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    version: { type: Number, default: 1 },
    triggerEvent: { type: String, required: true, index: true },
    steps: [WorkflowStepSchema],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const WorkflowDefinition =
  mongoose.models.WorkflowDefinition ||
  mongoose.model<IWorkflowDefinition>('WorkflowDefinition', WorkflowDefinitionSchema);
