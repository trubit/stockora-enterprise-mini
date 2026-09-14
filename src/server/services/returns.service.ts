import { SalesReturn } from '../models/SalesReturn.js';
import type { ISalesReturnItem, IExchangeItem } from '../models/SalesReturn.js';
import { Warranty } from '../models/Warranty.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { NotificationService } from './notification.service.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import mongoose from 'mongoose';
import { logger } from '../logger.js';

export interface CreateReturnInput {
  transactionNumber: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    reason: string;
    condition: 'SELLABLE' | 'DAMAGED';
    action: 'REFUND' | 'EXCHANGE';
  }[];
  exchangeItems?: { productId: string; quantity: number; price: number }[];
  refundMethod: 'CASH' | 'CARD' | 'STORE_CREDIT' | 'WALLET';
  refundType?: 'FULL' | 'PARTIAL';
  partialRefundAmount?: number;
  notes?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApproveReturnInput {
  returnId: string;
  status: 'APPROVED' | 'REJECTED' | 'COMPLETED';
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ReturnsService {
  /**
   * Create a new Sales Return (RMA). Handles both pure refunds and product exchanges.
   * Adjusts inventory, computes refund amount, and emits audit trail.
   */
  public static async createReturn(input: CreateReturnInput) {
    const {
      transactionNumber,
      items,
      exchangeItems = [],
      refundMethod,
      refundType = 'FULL',
      partialRefundAmount,
      notes,
      userId,
      ipAddress,
      userAgent,
    } = input;

    const transaction = await Transaction.findOne({ transactionNumber });
    if (!transaction)
      throw new NotFoundError('Original transaction [' + transactionNumber + '] not found.');

    const returnNumber = 'RET-' + Date.now().toString(36).toUpperCase();
    let calculatedRefund = 0;
    const processedItems: ISalesReturnItem[] = [];

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId))
        throw new ValidationError('Invalid product ID: ' + item.productId);
      const product = await Product.findById(item.productId);
      if (!product) throw new NotFoundError('Product [' + item.productId + '] not found.');
      if (item.quantity < 1)
        throw new ValidationError('Quantity must be >= 1 for [' + product.name + '].');

      if (item.condition === 'SELLABLE') product.quantity += item.quantity;
      else product.damagedQuantity = (product.damagedQuantity || 0) + item.quantity;
      product.returnedQuantity = (product.returnedQuantity || 0) + item.quantity;
      await product.save();

      await StockMovement.create({
        productId: product._id,
        type: 'RETURN',
        quantity: item.quantity,
        costPrice: product.cost,
        sellingPrice: product.price,
        referenceId: returnNumber,
        userId,
        notes: 'RMA [' + returnNumber + '] Condition:' + item.condition + ' Reason:' + item.reason,
      });

      calculatedRefund += item.price * item.quantity;
      processedItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: item.price,
        reason: item.reason,
        condition: item.condition,
        action: item.action,
      });
    }

    const processedExchangeItems: IExchangeItem[] = [];
    let exchangeTotal = 0;

    for (const exItem of exchangeItems) {
      if (!mongoose.Types.ObjectId.isValid(exItem.productId))
        throw new ValidationError('Invalid exchange product ID: ' + exItem.productId);
      const product = await Product.findById(exItem.productId);
      if (!product)
        throw new NotFoundError('Exchange product [' + exItem.productId + '] not found.');
      if (product.quantity < exItem.quantity)
        throw new ValidationError(
          'Insufficient stock for exchange product [' + product.name + '].'
        );

      product.quantity -= exItem.quantity;
      await product.save();
      await StockMovement.create({
        productId: product._id,
        type: 'TRANSFER',
        quantity: -exItem.quantity,
        costPrice: product.cost,
        sellingPrice: product.price,
        referenceId: returnNumber,
        userId,
        notes: 'Exchange via RMA [' + returnNumber + ']',
      });
      exchangeTotal += exItem.price * exItem.quantity;
      processedExchangeItems.push({
        productId: new mongoose.Types.ObjectId(exItem.productId),
        productName: product.name,
        sku: product.sku,
        quantity: exItem.quantity,
        price: exItem.price,
      });
    }

    const exchangePriceDiff = exchangeTotal - calculatedRefund;
    const finalRefund =
      refundType === 'PARTIAL' && partialRefundAmount !== undefined
        ? Math.min(partialRefundAmount, calculatedRefund)
        : Math.max(0, calculatedRefund - exchangeTotal);

    let walletRefundRef: string | undefined;
    if (refundMethod === 'WALLET') {
      walletRefundRef = 'WALLET-REF-' + Date.now().toString(36).toUpperCase();
      logger.info(
        '[Wallet Refund Placeholder] Ref: ' + walletRefundRef + ' Amount: $' + finalRefund
      );
    }

    const salesReturn = await SalesReturn.create({
      returnNumber,
      transactionNumber,
      items: processedItems,
      exchangeItems: processedExchangeItems,
      refundType,
      refundAmount: finalRefund,
      exchangePriceDifference: exchangePriceDiff,
      refundMethod,
      walletRefundRef,
      status: 'PENDING',
      notes,
      ipAddress,
      userAgent,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await AuditLog.create({
      userId,
      action: 'CREATE',
      targetModel: 'SalesReturn',
      targetId: salesReturn._id.toString(),
      newValues: salesReturn.toObject(),
      ipAddress,
      userAgent,
    });

    await NotificationService.send({
      type: 'INFO',
      title: 'New Return RMA: ' + returnNumber,
      body:
        'Return for TX [' +
        transactionNumber +
        ']. Refund: $' +
        finalRefund.toFixed(2) +
        ' via ' +
        refundMethod +
        '. Pending approval.',
      channels: ['IN_APP'],
    });

    logger.info('[Returns Service] RMA created: ' + returnNumber + ' Refund: $' + finalRefund);
    return salesReturn;
  }

  /**
   * Approve, reject, or complete an RMA. Immutable once COMPLETED or REJECTED.
   */
  public static async approveReturn(input: ApproveReturnInput) {
    const { returnId, status, userId, ipAddress, userAgent } = input;
    if (!mongoose.Types.ObjectId.isValid(returnId)) throw new ValidationError('Invalid return ID.');

    const salesReturn = await SalesReturn.findById(returnId);
    if (!salesReturn) throw new NotFoundError('Return record not found.');
    if (salesReturn.status === 'COMPLETED' || salesReturn.status === 'REJECTED') {
      throw new ValidationError('Cannot update a return with status [' + salesReturn.status + '].');
    }

    const prev = salesReturn.toObject();
    salesReturn.status = status;
    salesReturn.approvedBy = new mongoose.Types.ObjectId(userId);
    salesReturn.approvedAt = new Date();
    await salesReturn.save();

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'SalesReturn',
      targetId: salesReturn._id.toString(),
      previousValues: prev,
      newValues: salesReturn.toObject(),
      ipAddress,
      userAgent,
    });

    if (status === 'COMPLETED') {
      await NotificationService.send({
        type: 'INFO',
        title: 'Return Completed: ' + salesReturn.returnNumber,
        body: 'RMA processed. Refund: $' + salesReturn.refundAmount.toFixed(2) + '.',
        channels: ['IN_APP'],
      });
    }
    return salesReturn;
  }

  public static async listReturns(status?: string) {
    const filter = status ? { status } : {};
    return SalesReturn.find(filter)
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username email')
      .sort({ createdAt: -1 });
  }

  public static async getReturn(returnId: string) {
    if (!mongoose.Types.ObjectId.isValid(returnId)) throw new ValidationError('Invalid return ID.');
    const salesReturn = await SalesReturn.findById(returnId)
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username email');
    if (!salesReturn) throw new NotFoundError('Return record not found.');
    return salesReturn;
  }

  /**
   * Register a product warranty immediately after a sale.
   */
  public static async registerWarranty(input: {
    productId: string;
    serialNumber: string;
    customerName: string;
    customerEmail: string;
    durationMonths: number;
    notes?: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const {
      productId,
      serialNumber,
      customerName,
      customerEmail,
      durationMonths,
      notes,
      userId,
      ipAddress,
      userAgent,
    } = input;
    if (!mongoose.Types.ObjectId.isValid(productId))
      throw new ValidationError('Invalid product ID.');

    const product = await Product.findById(productId);
    if (!product) throw new NotFoundError('Product not found.');

    const warrantyNumber = 'WAR-' + Date.now().toString(36).toUpperCase();
    const registeredAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + Number(durationMonths));

    const warranty = await Warranty.create({
      warrantyNumber,
      productId,
      productName: product.name,
      serialNumber,
      customerName,
      customerEmail,
      registeredAt,
      durationMonths: Number(durationMonths),
      expiresAt,
      notes,
      claims: [],
    });

    await AuditLog.create({
      userId,
      action: 'CREATE',
      targetModel: 'Warranty',
      targetId: warranty._id.toString(),
      newValues: warranty.toObject(),
      ipAddress,
      userAgent,
    });

    logger.info('[Returns Service] Warranty registered: ' + warrantyNumber);
    return warranty;
  }

  /**
   * File a warranty claim. Handles REPAIR, REPLACEMENT (auto-deducts stock), REFUND, REJECTED.
   */
  public static async fileWarrantyClaim(input: {
    warrantyId: string;
    issueDescription: string;
    actionTaken: 'REPAIR' | 'REPLACEMENT' | 'REFUND' | 'REJECTED';
    resolutionNotes?: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const {
      warrantyId,
      issueDescription,
      actionTaken,
      resolutionNotes,
      userId,
      ipAddress,
      userAgent,
    } = input;
    if (!mongoose.Types.ObjectId.isValid(warrantyId))
      throw new ValidationError('Invalid warranty ID.');

    const warranty = await Warranty.findById(warrantyId);
    if (!warranty) throw new NotFoundError('Warranty not found.');
    if (new Date() > warranty.expiresAt) {
      throw new ValidationError(
        'Warranty [' +
          warranty.warrantyNumber +
          '] expired on ' +
          warranty.expiresAt.toLocaleDateString() +
          '.'
      );
    }

    const prev = warranty.toObject();
    const claimNumber = 'CLM-' + Date.now().toString(36).toUpperCase();
    const claimStatus = actionTaken === 'REJECTED' ? ('REJECTED' as const) : ('COMPLETED' as const);

    warranty.claims.push({
      claimNumber,
      claimDate: new Date(),
      status: claimStatus,
      issueDescription,
      resolutionNotes,
      actionTaken,
      resolvedAt: new Date(),
    });
    await warranty.save();

    if (actionTaken === 'REPLACEMENT') {
      const product = await Product.findById(warranty.productId);
      if (product) {
        if (product.quantity < 1)
          throw new ValidationError(
            'Insufficient stock for warranty replacement of [' + product.name + '].'
          );
        product.quantity -= 1;
        product.returnedQuantity = (product.returnedQuantity || 0) + 1;
        await product.save();
        await StockMovement.create({
          productId: product._id,
          type: 'TRANSFER',
          quantity: -1,
          costPrice: product.cost,
          sellingPrice: product.price,
          referenceId: claimNumber,
          userId,
          notes: 'Warranty Replacement Claim: ' + claimNumber,
        });
      }
    }

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'Warranty',
      targetId: warranty._id.toString(),
      previousValues: prev,
      newValues: warranty.toObject(),
      ipAddress,
      userAgent,
    });

    logger.info('[Returns Service] Warranty claim: ' + claimNumber + ' Action: ' + actionTaken);
    return warranty;
  }
}
