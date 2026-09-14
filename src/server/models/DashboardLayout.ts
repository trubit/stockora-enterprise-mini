import mongoose, { Schema, type Document } from 'mongoose';

export interface IDashboardLayout extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  roleName: string;
  widgets: {
    id: string;
    type: string; // e.g. "revenue_card", "sales_chart", "low_stock_table"
    x: number;
    y: number;
    w: number;
    h: number;
    config?: Record<string, unknown>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardLayoutSchema = new Schema<IDashboardLayout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    roleName: { type: String, required: true, index: true },
    widgets: {
      type: [
        {
          id: { type: String, required: true },
          type: { type: String, required: true },
          x: { type: Number, required: true },
          y: { type: Number, required: true },
          w: { type: Number, required: true },
          h: { type: Number, required: true },
          config: { type: Schema.Types.Map, of: Schema.Types.Mixed },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const DashboardLayout = mongoose.model<IDashboardLayout>(
  'DashboardLayout',
  DashboardLayoutSchema
);
