import mongoose from 'mongoose';
import { Supplier, type ISupplier } from '../models/Supplier.js';
import { SupplierProduct, type ISupplierProduct } from '../models/SupplierProduct.js';
import { SupplierPriceHistory } from '../models/SupplierPriceHistory.js';
import { PurchaseRequisition, type IPurchaseRequisition } from '../models/PurchaseRequisition.js';
import {
  PurchaseOrder,
  type IPurchaseOrder,
  type IPurchaseOrderItem,
} from '../models/PurchaseOrder.js';
import { PurchaseOrderRevision } from '../models/PurchaseOrderRevision.js';
import { SupplierConfirmation } from '../models/SupplierConfirmation.js';
import { GoodsReceipt, type IGoodsReceipt } from '../models/GoodsReceipt.js';
import { QualityInspection } from '../models/QualityInspection.js';
import { SupplierReturn } from '../models/SupplierReturn.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProcurementBudget } from '../models/ProcurementBudget.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface CreatePurchaseOrderInput {
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
  supplierId: string;
  requisitionId?: string;
  items: { productId: string; quantity: number; costPrice: number; supplierSku?: string }[];
  expectedDeliveryDate?: Date;
  paymentTerms?: string;
  shippingCost?: number;
  notes?: string;
  userId?: string;
  userName?: string;
}

export class ProcurementAdvancedService {
  // Requisitions
  public static async createPurchaseRequest(input: any): Promise<IPurchaseRequisition> {
    const tenantId = input.tenantId || 'default';
    const companyId = parseObjectId(input.companyId);
    const requisitionNumber = `PR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    let estimatedTotalCost = 0;
    const items = [];
    for (const item of input.items || []) {
      const product = await Product.findById(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);
      const itemCost = item.estimatedCost || product.costPrice || product.cost || 0;
      estimatedTotalCost += itemCost * item.quantity;
      items.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        quantity: item.quantity,
        estimatedCost: itemCost,
        reason: item.reason,
      });
    }

    const requisition = await PurchaseRequisition.create({
      tenantId,
      companyId,
      branchId: parseObjectId(input.branchId),
      warehouseId: parseObjectId(input.warehouseId),
      requisitionNumber,
      requestedBy: parseObjectId(input.userId) || new mongoose.Types.ObjectId(),
      requesterName: input.userName || 'System Requisitioner',
      items,
      priority: input.priority || 'MEDIUM',
      status: 'SUBMITTED',
      requiredDate: input.requiredDate,
      estimatedTotalCost,
      supplierRecommendationId: parseObjectId(input.supplierRecommendationId),
      notes: input.notes,
    });

    eventBus.emit('procurement.purchase_request.created', {
      requisitionId: requisition._id,
      requisitionNumber: requisition.requisitionNumber,
      estimatedTotalCost,
    });

    return requisition;
  }

  public static async approvePurchaseRequest(
    requisitionId: string,
    approvedBy: string,
    approvedByName?: string
  ): Promise<IPurchaseRequisition> {
    const pr = await PurchaseRequisition.findById(requisitionId);
    if (!pr) throw new NotFoundError('Purchase requisition not found');

    pr.status = 'APPROVED';
    pr.approvedBy = parseObjectId(approvedBy) || new mongoose.Types.ObjectId();
    pr.approvedByName = approvedByName;
    await pr.save();

    eventBus.emit('procurement.purchase_request.approved', {
      requisitionId: pr._id,
      requisitionNumber: pr.requisitionNumber,
    });

    return pr;
  }

  // Purchase Orders
  public static async createPurchaseOrder(
    input: CreatePurchaseOrderInput
  ): Promise<IPurchaseOrder> {
    const tenantId = input.tenantId || 'default';
    const companyId = parseObjectId(input.companyId);

    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    if (supplier.status === 'SUSPENDED' || supplier.status === 'BLACKLISTED') {
      throw new ValidationError(
        `Cannot issue purchase order to ${supplier.status} supplier ${supplier.name}`
      );
    }

    const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    let subtotal = 0;
    const poItems: IPurchaseOrderItem[] = [];

    for (const item of input.items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

      const sp = await SupplierProduct.findOne({
        supplierId: supplier._id,
        productId: product._id,
      });
      const lineCost = item.costPrice || sp?.purchaseCost || product.costPrice || 0;
      const lineTotal = lineCost * item.quantity;
      subtotal += lineTotal;

      poItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        sku: product.sku,
        supplierSku: item.supplierSku || sp?.supplierSku || product.sku,
        quantity: item.quantity,
        costPrice: lineCost,
        receivedQuantity: 0,
        rejectedQuantity: 0,
        outstandingQuantity: item.quantity,
        lineTotal,
      });

      if (sp && sp.purchaseCost !== lineCost) {
        await SupplierPriceHistory.create({
          tenantId,
          supplierId: supplier._id,
          productId: product._id,
          oldCost: sp.purchaseCost,
          newCost: lineCost,
          changedBy: parseObjectId(input.userId),
        });
        sp.purchaseCost = lineCost;
        await sp.save();
      }
    }

    const shippingCost = input.shippingCost || 0;
    const totalAmount = subtotal + shippingCost;

    // Budget Policy Enforcement
    const budget = await ProcurementBudget.findOne({ tenantId, isActive: true });
    if (budget) {
      if (budget.remainingAmount < totalAmount && budget.overBudgetPolicy === 'BLOCK') {
        throw new ValidationError(
          `Procurement Budget Exceeded. Remaining: ${budget.remainingAmount}, Required: ${totalAmount}`
        );
      }
      budget.committedAmount += totalAmount;
      budget.remainingAmount = Math.max(0, budget.allocatedAmount - budget.committedAmount);
      await budget.save();
    }

    const po = await PurchaseOrder.create({
      tenantId,
      companyId,
      branchId: parseObjectId(input.branchId),
      warehouseId: parseObjectId(input.warehouseId),
      poNumber,
      supplierId: supplier._id,
      supplierName: supplier.name,
      requisitionId: parseObjectId(input.requisitionId),
      items: poItems,
      subtotal,
      shippingCost,
      totalAmount,
      currency: supplier.currency || 'USD',
      expectedDeliveryDate: input.expectedDeliveryDate || new Date(Date.now() + 7 * 86400000),
      paymentTerms: input.paymentTerms || supplier.paymentTerms || 'NET 30',
      status: 'APPROVED',
      approvedBy: parseObjectId(input.userId),
      approvedByName: input.userName || 'Procurement Approver',
      approvedAt: new Date(),
      notes: input.notes,
    });

    if (input.requisitionId) {
      await PurchaseRequisition.findByIdAndUpdate(input.requisitionId, {
        status: 'CONVERTED',
        convertedPoId: po._id,
      });
    }

    await PurchaseOrderRevision.create({
      tenantId,
      companyId,
      purchaseOrderId: po._id,
      poNumber: po.poNumber,
      revisionNumber: 1,
      changedBy: parseObjectId(input.userId),
      changedByName: input.userName || 'System Initial Creation',
      changesDescription: 'Initial PO Creation',
      snapshot: po.toObject(),
    });

    eventBus.emit('procurement.purchase_order.created', {
      poId: po._id,
      poNumber: po.poNumber,
      totalAmount: po.totalAmount,
    });

    return po;
  }

  public static async revisePurchaseOrder(
    poId: string,
    updates: Partial<CreatePurchaseOrderInput>,
    changedBy: string,
    changedByName?: string,
    reason?: string
  ): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    po.version += 1;
    if (updates.expectedDeliveryDate) po.expectedDeliveryDate = updates.expectedDeliveryDate;
    if (updates.paymentTerms) po.paymentTerms = updates.paymentTerms;
    if (updates.notes) po.notes = updates.notes;

    await po.save();

    await PurchaseOrderRevision.create({
      tenantId: po.tenantId,
      companyId: po.companyId,
      purchaseOrderId: po._id,
      poNumber: po.poNumber,
      revisionNumber: po.version,
      changedBy: parseObjectId(changedBy),
      changedByName: changedByName || 'Procurement Agent',
      changesDescription: reason || `Updated PO to version ${po.version}`,
      snapshot: po.toObject(),
    });

    eventBus.emit('procurement.purchase_order.updated', { poId: po._id, version: po.version });

    return po;
  }

  // Supplier Confirmation
  public static async processSupplierConfirmation(
    poId: string,
    confirmationStatus: 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'REJECTED',
    confirmedDeliveryDate?: Date,
    notes?: string
  ): Promise<any> {
    const po = await PurchaseOrder.findById(poId);
    if (!po) throw new NotFoundError('Purchase order not found');

    const confirmation = await SupplierConfirmation.create({
      tenantId: po.tenantId,
      companyId: po.companyId,
      poId: po._id,
      poNumber: po.poNumber,
      status: confirmationStatus,
      confirmedDeliveryDate,
      notes,
    });

    po.status = confirmationStatus === 'REJECTED' ? 'REJECTED' : 'ACKNOWLEDGED';
    if (confirmedDeliveryDate) po.expectedDeliveryDate = confirmedDeliveryDate;
    await po.save();

    eventBus.emit('procurement.purchase_order.acknowledged', { poId: po._id, confirmationStatus });

    return confirmation;
  }

  // Goods Receiving
  public static async processGoodsReceiving(input: {
    tenantId?: string;
    companyId?: string;
    warehouseId?: string;
    poId: string;
    items: {
      productId: string;
      quantityReceived: number;
      batchNumber?: string;
      serialNumbers?: string[];
      unitCost?: number;
    }[];
    overReceivingTolerancePercent?: number;
    receivedBy: string;
    receivedByName?: string;
    notes?: string;
  }): Promise<IGoodsReceipt> {
    const po = await PurchaseOrder.findById(input.poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    const tolerancePercent = input.overReceivingTolerancePercent ?? 5; // Default 5% tolerance
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const grnItems = [];
    let isFullyReceived = true;

    for (const rItem of input.items) {
      const poItem = po.items.find((i: any) => i.productId.toString() === rItem.productId);
      if (!poItem)
        throw new ValidationError(`Product ${rItem.productId} is not part of PO ${po.poNumber}`);

      const maxAllowed = poItem.quantity * (1 + tolerancePercent / 100);
      const newReceivedTotal = (poItem.receivedQuantity || 0) + rItem.quantityReceived;

      if (newReceivedTotal > maxAllowed) {
        throw new ValidationError(
          `Over-receiving limit exceeded for SKU ${poItem.sku}. Max allowed: ${maxAllowed}, Attempted: ${newReceivedTotal}`
        );
      }

      poItem.receivedQuantity = newReceivedTotal;
      poItem.outstandingQuantity = Math.max(0, poItem.quantity - newReceivedTotal);
      if (poItem.outstandingQuantity > 0) isFullyReceived = false;

      // Update product inventory
      await Product.findByIdAndUpdate(rItem.productId, {
        $inc: { quantity: rItem.quantityReceived },
        $set: { lastPurchaseCost: rItem.unitCost || poItem.costPrice },
      });

      await StockMovement.create({
        tenantId: po.tenantId,
        companyId: po.companyId,
        productId: rItem.productId,
        warehouseId: parseObjectId(input.warehouseId) || po.warehouseId,
        quantity: rItem.quantityReceived,
        type: 'PURCHASE_RECEIPT',
        referenceId: grnNumber,
        notes: `Received against ${po.poNumber}`,
      });

      grnItems.push({
        productId: new mongoose.Types.ObjectId(rItem.productId),
        sku: poItem.sku,
        quantityOrdered: poItem.quantity,
        quantityReceived: rItem.quantityReceived,
        quantityAccepted: rItem.quantityReceived,
        unitCost: rItem.unitCost || poItem.costPrice,
        batchNumber: rItem.batchNumber,
        serialNumbers: rItem.serialNumbers,
      });
    }

    po.status = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    po.actualDeliveryDate = new Date();
    await po.save();

    const grn = await GoodsReceipt.create({
      tenantId: po.tenantId,
      companyId: po.companyId,
      warehouseId: parseObjectId(input.warehouseId) || po.warehouseId,
      grnNumber,
      poId: po._id,
      poNumber: po.poNumber,
      items: grnItems,
      receivedBy: parseObjectId(input.receivedBy) || new mongoose.Types.ObjectId(),
      receivedByName: input.receivedByName || 'Receiving Clerk',
      inspectionStatus: 'PENDING',
      notes: input.notes,
    });

    eventBus.emit('procurement.purchase_order.received', { grnId: grn._id, poNumber: po.poNumber });

    return grn;
  }

  // Quality Inspection
  public static async processQualityInspection(input: {
    grnId: string;
    inspectorId: string;
    inspectorName?: string;
    items: {
      productId: string;
      quantityInspected: number;
      quantityPassed: number;
      quantityFailed: number;
      defectType?: string;
      failureReason?: string;
    }[];
    notes?: string;
  }): Promise<any> {
    const grn = await GoodsReceipt.findById(input.grnId);
    if (!grn) throw new NotFoundError('Goods Receipt not found');

    const inspectionNumber = `QI-${Date.now().toString().slice(-6)}`;
    let overallFailed = false;

    const inspectionItems = [];
    for (const item of input.items) {
      if (item.quantityFailed > 0) {
        overallFailed = true;

        // Reduce available stock for failed/rejected items & record quarantine/disposal
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantityFailed },
        });
      }

      inspectionItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        quantityInspected: item.quantityInspected,
        quantityPassed: item.quantityPassed,
        quantityFailed: item.quantityFailed,
        defectType: item.defectType,
        failureReason: item.failureReason,
        resultStatus: item.quantityFailed > 0 ? ('REJECTED' as const) : ('ACCEPTED' as const),
      });
    }

    grn.inspectionStatus = overallFailed ? 'QUARANTINED' : 'PASSED';
    await grn.save();

    const qi = await QualityInspection.create({
      tenantId: grn.tenantId,
      companyId: grn.companyId,
      inspectionNumber,
      grnId: grn._id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      poNumber: grn.poNumber,
      items: inspectionItems,
      overallStatus: overallFailed ? 'QUARANTINED' : 'ACCEPTED',
      inspectorId: parseObjectId(input.inspectorId) || new mongoose.Types.ObjectId(),
      inspectorName: input.inspectorName || 'QA Inspector',
      notes: input.notes,
    });

    eventBus.emit('procurement.receipt.inspected', {
      inspectionId: qi._id,
      overallStatus: qi.overallStatus,
    });

    return qi;
  }

  // Supplier Returns
  public static async createSupplierReturn(input: {
    supplierId: string;
    poId?: string;
    items: { productId: string; quantity: number; unitCost: number; returnReason?: string }[];
    createdById: string;
    createdByName?: string;
    notes?: string;
  }): Promise<any> {
    const returnNumber = `RET-SUP-${Date.now().toString().slice(-6)}`;
    let totalAmount = 0;

    const returnItems = [];
    for (const item of input.items) {
      const lineCost = item.unitCost * item.quantity;
      totalAmount += lineCost;

      returnItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        quantity: item.quantity,
        unitCost: item.unitCost,
        reason: item.returnReason || 'Defective stock return',
      });
    }

    const ret = await SupplierReturn.create({
      supplierId: new mongoose.Types.ObjectId(input.supplierId),
      poId: parseObjectId(input.poId),
      returnNumber,
      items: returnItems,
      totalAmount,
      status: 'APPROVED',
      createdBy: parseObjectId(input.createdById) || new mongoose.Types.ObjectId(),
      notes: input.notes,
    });

    eventBus.emit('procurement.supplier_return.created', { returnId: ret._id, totalAmount });

    return ret;
  }
}
