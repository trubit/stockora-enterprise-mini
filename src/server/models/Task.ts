import mongoose, { Schema, type Document } from 'mongoose';

export interface ITask extends Document {
  companyId: mongoose.Types.ObjectId;
  workflowInstanceId?: mongoose.Types.ObjectId;
  stepId?: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'ESCALATED';
  assignedUser?: mongoose.Types.ObjectId;
  assignedRole?: string;
  assignedDepartment?: string;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  slaStatus: 'MET' | 'BREACHED' | 'NEAR_BREACH';
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance', index: true },
    stepId: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED', 'ESCALATED'],
      default: 'PENDING',
      index: true,
    },
    assignedUser: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedRole: { type: String, index: true },
    assignedDepartment: { type: String, index: true },
    dueDate: { type: Date },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    slaStatus: {
      type: String,
      enum: ['MET', 'BREACHED', 'NEAR_BREACH'],
      default: 'MET',
      index: true,
    },
  },
  { timestamps: true }
);

export const Task = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
