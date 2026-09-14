import mongoose from 'mongoose';
import { PurchaseOrder, type IPurchaseOrder } from '../models/PurchaseOrder.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export class PurchaseOrderVersioningService {
  public static async revisePurchaseOrder(
    poId: string,
    input: {
      userId?: string;
      userName?: string;
      reason: string;
      updatedItems?: { productId: string; quantity: number; costPrice: number }[];
      notes?: string;
    }
  ): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    const previousVersion = po.version || 1;
    const previousTotalAmount = po.totalAmount || 0;

    let newTotalAmount = previousTotalAmount;

    if (input.updatedItems && input.updatedItems.length > 0) {
      const items = [];
      let subtotal = 0;

      for (const item of input.updatedItems) {
        const lineTotal = item.quantity * item.costPrice;
        subtotal += lineTotal;

        items.push({
          productId: new mongoose.Types.ObjectId(item.productId),
          quantity: item.quantity,
          costPrice: item.costPrice,
          receivedQuantity: 0,
          lineTotal,
        });
      }

      po.items = items as any;
      po.subtotal = subtotal;
      po.totalAmount =
        subtotal + (po.taxAmount || 0) + (po.shippingCost || 0) - (po.discountAmount || 0);
      newTotalAmount = po.totalAmount;
    }

    const newVersion = previousVersion + 1;
    po.version = newVersion;

    if (!po.revisions) po.revisions = [];
    po.revisions.push({
      version: newVersion,
      revisedBy: parseObjectId(input.userId),
      revisedByName: input.userName || 'Procurement Specialist',
      revisedAt: new Date(),
      reason: input.reason,
      previousTotalAmount,
      newTotalAmount,
      changesDescription: `Revised PO version from v${previousVersion} to v${newVersion}. Reason: ${input.reason}`,
    });

    if (input.notes) po.notes = input.notes;
    await po.save();

    eventBus.emit('purchase_order.revised', {
      poId: po._id,
      poNumber: po.poNumber,
      version: newVersion,
    });
    return po;
  }

  public static async recordSupplierAcknowledgement(
    poId: string,
    status: 'ACKNOWLEDGED' | 'REJECTED' | 'COUNTER_PROPOSED',
    counterProposal?: {
      proposedDeliveryDate?: Date;
      proposedItems?: { productId: string; proposedQuantity: number }[];
      comments?: string;
    }
  ): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    po.acknowledgementStatus = status;
    po.acknowledgementDate = new Date();

    if (status === 'ACKNOWLEDGED') {
      po.status = 'ACKNOWLEDGED';
    } else if (status === 'COUNTER_PROPOSED' && counterProposal) {
      po.status = 'COUNTER_PROPOSED';
      po.counterProposal = {
        proposedDeliveryDate: counterProposal.proposedDeliveryDate,
        proposedItems: counterProposal.proposedItems?.map((i) => ({
          productId: new mongoose.Types.ObjectId(i.productId),
          proposedQuantity: i.proposedQuantity,
        })),
        comments: counterProposal.comments,
        status: 'PENDING_REVIEW',
        proposedAt: new Date(),
      };
    } else if (status === 'REJECTED') {
      po.status = 'REJECTED';
    }

    await po.save();
    eventBus.emit('purchase_order.acknowledged', { poId: po._id, poNumber: po.poNumber, status });
    return po;
  }

  public static async resolveSupplierCounterProposal(
    poId: string,
    action: 'ACCEPT' | 'REJECT',
    userId?: string,
    userName?: string
  ): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findById(poId);
    if (!po || !po.counterProposal)
      throw new NotFoundError('Purchase Order or counter proposal not found');

    if (action === 'ACCEPT') {
      po.counterProposal.status = 'ACCEPTED';
      if (po.counterProposal.proposedDeliveryDate) {
        po.expectedDeliveryDate = po.counterProposal.proposedDeliveryDate;
      }
      if (po.counterProposal.proposedItems) {
        for (const pItem of po.counterProposal.proposedItems) {
          const item = po.items.find(
            (i: any) => i.productId?.toString() === pItem.productId?.toString()
          );
          if (item) {
            item.quantity = pItem.proposedQuantity;
            item.lineTotal = item.quantity * item.costPrice;
          }
        }
      }
      po.status = 'ACKNOWLEDGED';
    } else {
      po.counterProposal.status = 'REJECTED';
      po.status = 'SENT';
    }

    await po.save();
    eventBus.emit('purchase_order.counter_proposal_resolved', { poId: po._id, action });
    return po;
  }
}
