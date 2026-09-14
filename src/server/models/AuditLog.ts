import mongoose, { Schema, type Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  targetModel: string;
  targetId: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  previousValues?: Record<string, any>;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    targetModel: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    previousValues: { type: Schema.Types.Map, of: Schema.Types.Mixed },
    newValues: { type: Schema.Types.Map, of: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    sessionId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes for performance/filtering
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
