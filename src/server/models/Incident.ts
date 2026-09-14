import mongoose, { Schema, type Document } from 'mongoose';

export interface IIncidentEvent {
  message: string;
  createdAt: Date;
}

export interface IIncident extends Document {
  companyId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  timeline: IIncidentEvent[];
  rootCause?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentEventSchema = new Schema<IIncidentEvent>({
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const IncidentSchema = new Schema<IIncident>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['OPEN', 'INVESTIGATING', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    severity: {
      type: String,
      enum: ['WARNING', 'CRITICAL', 'EMERGENCY'],
      default: 'WARNING',
      index: true,
    },
    timeline: [IncidentEventSchema],
    rootCause: { type: String },
  },
  { timestamps: true }
);

export const Incident =
  mongoose.models.Incident || mongoose.model<IIncident>('Incident', IncidentSchema);
