import mongoose, { Schema, type Document } from 'mongoose';

export interface IProductVariant {
  sku: string;
  name: string;
  price?: number;
  quantity: number;
  attributes: { key: string; value: string }[];
}

export interface IProduct extends Document {
  tenantId?: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  uom?: string;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'OUT_OF_STOCK';
  costPrice: number;
  sellingPrice: number;
  price: number;
  cost: number;
  quantity: number;
  lowStockAlert: number;
  reservedQuantity: number;
  damagedQuantity: number;
  returnedQuantity: number;
  barcode?: string;
  qrCode?: string;
  wholesalePrice?: number;
  retailPrice?: number;
  promotionalPrice?: number;
  isTaxInclusive: boolean;
  currency: string;
  variants: IProductVariant[];
  attributes: { key: string; value: string }[];
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  imageUrl?: string;
  gallery: string[];
  tags: string[];
  notes?: string;
  expirationDate?: Date;
  batchNumbers: string[];
  serialNumbers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number },
  quantity: { type: Number, required: true, default: 0 },
  attributes: [
    {
      key: { type: String, required: true },
      value: { type: String, required: true },
    },
  ],
});

const ProductSchema = new Schema<IProduct>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    sku: { type: String, required: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, required: true, index: true, default: 'General' },
    subcategory: { type: String, index: true },
    brand: { type: String, index: true },
    uom: { type: String, default: 'pcs' },
    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DRAFT', 'OUT_OF_STOCK'],
      default: 'ACTIVE',
      index: true,
    },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0, default: 0 },
    cost: { type: Number, required: true, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockAlert: { type: Number, required: true, min: 0, default: 5 },
    reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    returnedQuantity: { type: Number, required: true, min: 0, default: 0 },
    barcode: { type: String, index: true },
    qrCode: { type: String },
    wholesalePrice: { type: Number, min: 0 },
    retailPrice: { type: Number, min: 0 },
    promotionalPrice: { type: Number, min: 0 },
    isTaxInclusive: { type: Boolean, default: false },
    currency: { type: String, required: true, uppercase: true, trim: true, default: 'USD' },
    variants: [ProductVariantSchema],
    attributes: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
    width: { type: Number },
    height: { type: Number },
    depth: { type: Number },
    weight: { type: Number },
    imageUrl: { type: String },
    gallery: [{ type: String }],
    tags: [{ type: String, index: true }],
    notes: { type: String },
    expirationDate: { type: Date },
    batchNumbers: [{ type: String }],
    serialNumbers: [{ type: String }],
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, sku: 1 });
ProductSchema.index({ tenantId: 1, category: 1 });
ProductSchema.index({ tenantId: 1, status: 1 });
ProductSchema.index({ tenantId: 1, createdAt: -1 });

ProductSchema.pre('validate', function (next) {
  if (this.costPrice === undefined && this.cost !== undefined) {
    this.costPrice = this.cost;
  }
  if (this.sellingPrice === undefined && this.price !== undefined) {
    this.sellingPrice = this.price;
  }
  if (!this.currency) {
    this.currency = 'USD';
  }
  next();
});

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
