import mongoose, { Schema, type Document } from 'mongoose';

export interface IStepExecutionLog {
  stepId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  actionTakenBy?: mongoose.Types.ObjectId;
}

export interface IWorkflowInstance extends Document {
  companyId: mongoose.Types.ObjectId;
  definitionId: mongoose.Types.ObjectId;
  triggerEvent: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentStepId?: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  variables: Record<string, any>;
  executionLogs: IStepExecutionLog[];
  createdAt: Date;
  updatedAt: Date;
}

const StepExecutionLogSchema = new Schema<IStepExecutionLog>({
  stepId: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    required: true,
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  error: { type: String },
  actionTakenBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

const WorkflowInstanceSchema = new Schema<IWorkflowInstance>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    definitionId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkflowDefinition',
      required: true,
      index: true,
    },
    triggerEvent: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    currentStepId: { type: String },
    variables: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
    executionLogs: [StepExecutionLogSchema],
  },
  { timestamps: true }
);

export const WorkflowInstance =
  mongoose.models.WorkflowInstance ||
  mongoose.model<IWorkflowInstance>('WorkflowInstance', WorkflowInstanceSchema);
