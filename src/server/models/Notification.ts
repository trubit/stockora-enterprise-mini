import mongoose, { Schema, type Document } from 'mongoose';

export interface INotification extends Document {
  userId?: mongoose.Types.ObjectId; // null = global broadcast
  targetRole?: string; // e.g. 'admin', 'cashier' — role-targeted broadcast
  type: 'INFO' | 'WARNING' | 'SECURITY' | 'SYSTEM' | 'PROMO' | 'TASK';
  title: string;
  body: string;
  status: 'UNREAD' | 'READ';
  channels: ('IN_APP' | 'EMAIL' | 'SMS' | 'PUSH')[];
  templateKey?: string; // Reference to a NotificationTemplate code
  scheduledAt?: Date; // If set, deliver at this time (handled by job scheduler)
  sentAt?: Date; // When actually dispatched
  metadata?: Record<string, unknown>; // Arbitrary extra payload for the client
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    targetRole: { type: String, index: true },
    type: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'SECURITY', 'SYSTEM', 'PROMO', 'TASK'],
      default: 'INFO',
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['UNREAD', 'READ'],
      default: 'UNREAD',
      index: true,
    },
    channels: [{ type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] }],
    templateKey: { type: String },
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ scheduledAt: 1, status: 1 });
NotificationSchema.index({ targetRole: 1, status: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
