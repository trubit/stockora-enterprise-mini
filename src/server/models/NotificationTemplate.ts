/**
 * NotificationTemplate.ts
 * Reusable message templates for notifications.
 * Templates use {{variable}} placeholders interpolated at send time.
 */

import mongoose, { Schema, type Document } from 'mongoose';

export interface INotificationTemplate extends Document {
  key: string; // Unique code used as templateKey in Notification
  name: string; // Human-readable display name
  type: 'INFO' | 'WARNING' | 'SECURITY' | 'SYSTEM' | 'PROMO' | 'TASK';
  channels: ('IN_APP' | 'EMAIL' | 'SMS' | 'PUSH')[];
  titleTemplate: string; // e.g. "Order {{orderNumber}} confirmed"
  bodyTemplate: string; // e.g. "Hello {{customerName}}, your order {{orderNumber}} is ready."
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    key: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'SECURITY', 'SYSTEM', 'PROMO', 'TASK'],
      default: 'INFO',
    },
    channels: {
      type: [{ type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] }],
      default: ['IN_APP'],
    },
    titleTemplate: { type: String, required: true },
    bodyTemplate: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const NotificationTemplate = mongoose.model<INotificationTemplate>(
  'NotificationTemplate',
  NotificationTemplateSchema
);
