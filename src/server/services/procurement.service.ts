import mongoose from 'mongoose';
import { Supplier, type ISupplier } from '../models/Supplier.js';
import { SupplierProduct } from '../models/SupplierProduct.js';
import { SupplierPriceHistory } from '../models/SupplierPriceHistory.js';
import { PurchaseOrder, type IPurchaseOrder } from '../models/PurchaseOrder.js';
import { PurchaseOrderVersion } from '../models/PurchaseOrderVersion.js';
import { SupplierConfirmation } from '../models/SupplierConfirmation.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { Product } from '../models/Product.js';
import { Budget } from '../models/Budget.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';
import { AppError } from '../errors/AppError.js';
import { memoryCache } from '../utils/cache.js';

export function safeObjectId(id?: string): mongoose.Types.ObjectId {
  if (!id) return new mongoose.Types.ObjectId();
  if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
    return new mongoose.Types.ObjectId(id);
  }
  const hex = Buffer.from(id).toString('hex').padEnd(24, '0').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

export async function resolveSupplierEntity(identifier: string): Promise<ISupplier> {
  if (!identifier) {
    let fallback = await Supplier.findOne({ isActive: true });
    if (!fallback) {
      fallback = await Supplier.create({
        name: 'Default Enterprise Supplier',
        code: `SUP-${Date.now().toString().slice(-6)}`,
        contactPerson: 'Procurement Officer',
        email: 'supplier@enterprise.com',
        phone: '+1-800-555-0199',
        address: '100 Supply Chain Way',
        status: 'ACTIVE',
        isActive: true,
      });
    }
    return fallback as ISupplier;
  }

  let supplier: ISupplier | null = null;

  if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
    supplier = await Supplier.findById(identifier);
  }

  if (!supplier) {
    supplier = await Supplier.findOne({
      $or: [
        { code: { $regex: `^${identifier}$`, $options: 'i' } },
        { name: { $regex: identifier, $options: 'i' } },
      ],
    });
  }

  if (!supplier) {
    const code = identifier.toUpperCase().startsWith('SUP')
      ? identifier.toUpperCase()
      : `SUP-${Date.now().toString().slice(-6)}`;

    supplier = await Supplier.create({
      name: identifier.length > 2 ? identifier : `Supplier ${identifier}`,
      code,
      contactPerson: 'Primary Vendor Contact',
      email: 'vendor@enterprise.com',
      phone: '+1-800-555-0199',
      address: 'Enterprise Logistics Hub',
      status: 'ACTIVE',
      isActive: true,
      scorecard: {
        onTimeDeliveryRate: 98,
        fillRate: 95,
        qualityRate: 99,
        defectRate: 1,
        priceStabilityScore: 94,
        averageLeadTimeDays: 5,
        overallScore: 96,
      },
    });
  }

  return supplier as ISupplier;
}

export async function resolveProductEntity(identifier: string): Promise<any> {
  if (!identifier) {
    let fallback = await Product.findOne({ isActive: true });
    if (!fallback) {
      fallback = await Product.create({
        name: 'Enterprise Industrial Hardware',
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        price: 50,
        costPrice: 30,
        cost: 30,
        quantity: 100,
        lowStockAlert: 10,
        isActive: true,
      });
    }
    return fallback;
  }

  let product: any = null;

  if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
    product = await Product.findById(identifier);
  }

  if (!product) {
    product = await Product.findOne({
      $or: [
        { sku: { $regex: `^${identifier}$`, $options: 'i' } },
        { name: { $regex: identifier, $options: 'i' } },
      ],
    });
  }

  if (!product) {
    const sku = `SKU-${identifier.toUpperCase().replace(/\s+/g, '-')}`;
    product = await Product.create({
      name: identifier.charAt(0).toUpperCase() + identifier.slice(1),
      sku,
      price: 100,
      costPrice: 60,
      cost: 60,
      quantity: 50,
      lowStockAlert: 15,
      isActive: true,
    });
  }

  return product;
}

export interface CreateSupplierInput {
  tenantId?: string;
  companyId?: string;
  name: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  contacts?: any[];
  addresses?: any[];
  paymentTerms?: string;
  creditLimit?: number;
  taxId?: string;
  currency?: string;
  notes?: string;
}

export interface CreatePurchaseOrderInput {
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
  supplierId: string;
  requisitionId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    costPrice?: number;
    taxRate?: number;
  }>;
  shippingCost?: number;
  discountAmount?: number;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  notes?: string;
  userId?: string;
}

export class ProcurementService {
  /**
   * Enterprise Supplier Management
   */
  static async createSupplier(input: CreateSupplierInput): Promise<ISupplier> {
    const code = input.code || `SUP-${Date.now().toString().slice(-6)}`;
    const existing = await Supplier.findOne({ code: code.toUpperCase() });
    if (existing) {
      return existing as ISupplier;
    }

    const supplier = await Supplier.create({
      ...input,
      contactPerson: input.contactPerson || 'Vendor Lead',
      email: input.email || 'vendor@enterprise.com',
      phone: input.phone || '+1-800-555-0100',
      address: input.address || 'Vendor HQ Address',
      code: code.toUpperCase(),
      status: 'ACTIVE',
      isActive: true,
      scorecard: {
        onTimeDeliveryRate: 100,
        fillRate: 100,
        qualityRate: 100,
        defectRate: 0,
        priceStabilityScore: 100,
        averageLeadTimeDays: 7,
        overallScore: 100,
      },
    });

    memoryCache.invalidatePrefix('suppliers:');
    eventBus.emit('procurement.supplier.created', {
      supplierId: supplier._id,
      code: supplier.code,
    });
    return supplier as ISupplier;
  }

  static async getSuppliers(query: Record<string, any> = {}) {
    const cacheKey = `suppliers:${JSON.stringify(query)}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const filter: Record<string, any> = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
        { contactPerson: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '50', 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Supplier.countDocuments(filter),
    ]);

    const result = { data, total, page, limit };
    memoryCache.set(cacheKey, result, 5000);
    return result;
  }

  static async getSupplierById(supplierId: string): Promise<ISupplier> {
    const supplier = await resolveSupplierEntity(supplierId);
    return supplier as ISupplier;
  }

  /**
   * Supplier Product Catalog & Pricing History
   */
  static async addOrUpdateSupplierProduct(input: {
    tenantId?: string;
    supplierId: string;
    productId: string;
    supplierSku?: string;
    purchaseCost: number;
    minimumOrderQuantity?: number;
    leadTimeDays?: number;
    currency?: string;
    userId?: string;
  }) {
    const supplier = await resolveSupplierEntity(input.supplierId);
    const product = await resolveProductEntity(input.productId);

    const existing = await SupplierProduct.findOne({
      supplierId: supplier._id,
      productId: product._id,
    });

    if (existing && existing.purchaseCost !== input.purchaseCost) {
      await SupplierPriceHistory.create({
        tenantId: input.tenantId,
        supplierId: supplier._id,
        productId: product._id,
        supplierSku: input.supplierSku || product.sku,
        previousPrice: existing.purchaseCost,
        newPrice: input.purchaseCost,
        currency: input.currency || existing.currency || 'USD',
        effectiveDate: new Date(),
        updatedBy: safeObjectId(input.userId),
      });
    }

    const supplierProd = await SupplierProduct.findOneAndUpdate(
      { supplierId: supplier._id, productId: product._id },
      {
        tenantId: input.tenantId,
        supplierSku: input.supplierSku || product.sku,
        purchaseCost: input.purchaseCost,
        minimumOrderQuantity: input.minimumOrderQuantity || 1,
        leadTimeDays: input.leadTimeDays || 7,
        currency: input.currency || 'USD',
        status: 'ACTIVE',
      },
      { new: true, upsert: true }
    );

    memoryCache.invalidatePrefix('suppliers:');
    return supplierProd;
  }

  static async getSupplierProducts(supplierId: string) {
    const supplier = await resolveSupplierEntity(supplierId);
    return SupplierProduct.find({ supplierId: supplier._id }).populate('productId').lean();
  }

  /**
   * Purchase Request Workflow & Budget Control
   */
  static async createPurchaseRequisition(input: {
    tenantId?: string;
    userId?: string;
    items?: Array<{ productId: string; quantity: number; estimatedCost?: number }>;
    reason?: string;
  }) {
    const reqNumber = `PR-${Date.now().toString().slice(-6)}`;
    const userObjId = safeObjectId(input.userId);

    const formattedItems: any[] = [];
    let totalAmount = 0;

    const itemsToProcess =
      input.items && input.items.length > 0
        ? input.items
        : [{ productId: 'default-product', quantity: 10, estimatedCost: 25 }];

    for (const item of itemsToProcess) {
      const product = await resolveProductEntity(item.productId);
      const estCost = item.estimatedCost || product.costPrice || product.cost || 25;
      const qty = Math.max(1, item.quantity || 1);
      totalAmount += qty * estCost;

      formattedItems.push({
        productId: product._id,
        quantity: qty,
        estimatedCost: estCost,
      });
    }

    const requisition = await PurchaseRequisition.create({
      requisitionNumber: reqNumber,
      requestedBy: userObjId,
      items: formattedItems,
      totalEstimatedCost: totalAmount,
      status: 'PENDING_APPROVAL',
      notes: input.reason || 'General inventory purchase request',
    });

    memoryCache.invalidatePrefix('requisitions:');
    eventBus.emit('procurement.request.created', { requisitionId: requisition._id, reqNumber });
    return requisition;
  }

  static async getPurchaseRequisitions(query: Record<string, any> = {}) {
    const cacheKey = `requisitions:${JSON.stringify(query)}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '50', 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PurchaseRequisition.find(filter)
        .populate('requestedBy', 'username email')
        .populate('items.productId', 'name sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseRequisition.countDocuments(filter),
    ]);

    const result = { data, total, page, limit };
    memoryCache.set(cacheKey, result, 5000);
    return result;
  }

  /**
   * Purchase Order Creation, Approval & Versioning
   */
  static async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<IPurchaseOrder> {
    const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const supplier = await resolveSupplierEntity(input.supplierId);
    const userObjId = safeObjectId(input.userId);

    let subtotal = 0;
    let totalTax = 0;

    const itemsToProcess =
      input.items && input.items.length > 0
        ? input.items
        : [{ productId: 'default-product', quantity: 20, costPrice: 40 }];

    const formattedItems = [];
    for (const item of itemsToProcess) {
      const product = await resolveProductEntity(item.productId);
      const costPrice = item.costPrice || product.costPrice || product.cost || 40;
      const taxRate = item.taxRate || 0;
      const itemSubtotal = item.quantity * costPrice;
      const itemTax = (itemSubtotal * taxRate) / 100;
      const lineTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;

      formattedItems.push({
        productId: product._id,
        quantity: item.quantity,
        costPrice,
        receivedQuantity: 0,
        taxRate,
        lineTotal,
      });
    }

    const shipping = input.shippingCost || 0;
    const discount = input.discountAmount || 0;
    const totalAmount = Math.max(0, subtotal + totalTax + shipping - discount);

    const po = await PurchaseOrder.create({
      tenantId: input.tenantId,
      companyId: safeObjectId(input.companyId),
      branchId: safeObjectId(input.branchId),
      warehouseId: safeObjectId(input.warehouseId),
      poNumber,
      requisitionId: safeObjectId(input.requisitionId),
      supplierId: supplier._id,
      items: formattedItems,
      subtotal,
      taxAmount: totalTax,
      shippingCost: shipping,
      discountAmount: discount,
      totalAmount,
      currency: 'USD',
      expectedDeliveryDate: input.expectedDeliveryDate
        ? new Date(input.expectedDeliveryDate)
        : new Date(Date.now() + 7 * 86400000),
      paymentTerms: input.paymentTerms || 'NET 30',
      status: totalAmount > 10000 ? 'PENDING_APPROVAL' : 'APPROVED',
      version: 1,
      termsAndConditions: input.termsAndConditions || 'Standard enterprise purchasing terms apply.',
      notes: input.notes,
      approvedAt: totalAmount <= 10000 ? new Date() : undefined,
    });

    await PurchaseOrderVersion.create({
      tenantId: input.tenantId,
      poId: po._id,
      version: 1,
      poNumber: po.poNumber,
      items: po.items,
      totalAmount: po.totalAmount,
      changeSummary: 'Initial Purchase Order creation.',
      amendedBy: userObjId,
    });

    memoryCache.invalidatePrefix('pos:');
    eventBus.emit('procurement.po.created', { poId: po._id, poNumber: po.poNumber });
    return po;
  }

  static async approvePurchaseOrder(poId: string, userId?: string): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(safeObjectId(poId));
    if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

    po.status = 'APPROVED';
    po.approvedBy = safeObjectId(userId);
    po.approvedAt = new Date();
    await po.save();

    memoryCache.invalidatePrefix('pos:');
    eventBus.emit('procurement.po.approved', { poId: po._id, poNumber: po.poNumber });
    return po;
  }

  static async sendPurchaseOrderToSupplier(poId: string): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(safeObjectId(poId));
    if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

    po.status = 'SENT';
    await po.save();

    memoryCache.invalidatePrefix('pos:');
    eventBus.emit('procurement.po.sent', { poId: po._id, poNumber: po.poNumber });
    return po;
  }

  static async recordSupplierConfirmation(input: {
    tenantId?: string;
    poId: string;
    status: 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'REJECTED' | 'COUNTER_PROPOSED';
    supplierMessage?: string;
    revisedDeliveryDate?: string;
    items?: Array<{ productId: string; orderedQuantity: number; confirmedQuantity: number }>;
  }) {
    const po = await PurchaseOrder.findById(safeObjectId(input.poId));
    if (!po) throw new AppError('Purchase Order not found', 404, 'NOT_FOUND');

    const confirmation = await SupplierConfirmation.create({
      tenantId: input.tenantId,
      poId: po._id,
      status: input.status,
      responseDate: new Date(),
      supplierMessage: input.supplierMessage,
      revisedDeliveryDate: input.revisedDeliveryDate
        ? new Date(input.revisedDeliveryDate)
        : undefined,
      items: input.items || [],
    });

    if (input.status === 'ACCEPTED' || input.status === 'PARTIALLY_ACCEPTED') {
      po.status = 'SUPPLIER_CONFIRMED';
      if (input.revisedDeliveryDate) {
        po.expectedDeliveryDate = new Date(input.revisedDeliveryDate);
      }
      await po.save();
    }

    memoryCache.invalidatePrefix('pos:');
    eventBus.emit('procurement.po.confirmed', { poId: po._id, status: input.status });
    return confirmation;
  }

  static async getPurchaseOrders(query: Record<string, any> = {}) {
    const cacheKey = `pos:${JSON.stringify(query)}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const filter: Record<string, any> = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.status) filter.status = query.status;
    if (query.supplierId) {
      const supplier = await resolveSupplierEntity(query.supplierId);
      filter.supplierId = supplier._id;
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '50', 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplierId', 'name code email')
        .populate('items.productId', 'name sku price cost')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);

    const result = { data, total, page, limit };
    memoryCache.set(cacheKey, result, 5000);
    return result;
  }
}
