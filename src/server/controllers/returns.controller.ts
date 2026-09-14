import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ReturnsService } from '../services/returns.service.js';
import { Warranty } from '../models/Warranty.js';
import { ValidationError } from '../errors/AppError.js';

export class ReturnsController {
  public static async listReturns(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const returns = await ReturnsService.listReturns(req.query.status as string | undefined);
      res.json(returns);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const salesReturn = await ReturnsService.getReturn(String(req.params.id));
      res.json(salesReturn);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      transactionNumber,
      items,
      exchangeItems,
      refundMethod,
      refundType,
      partialRefundAmount,
      notes,
    } = req.body;
    if (!transactionNumber || !items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('Transaction number and items are required.'));
    }
    try {
      const salesReturn = await ReturnsService.createReturn({
        transactionNumber,
        items,
        exchangeItems,
        refundMethod,
        refundType,
        partialRefundAmount,
        notes,
        userId: req.user?.id ?? '',
        ipAddress: req.ipAddress || '',
        userAgent: req.userAgent || '',
      });
      res.status(201).json(salesReturn);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async approveReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { status } = req.body;
    if (!status) return next(new ValidationError('Status is required.'));
    try {
      const salesReturn = await ReturnsService.approveReturn({
        returnId: String(req.params.id),
        status,
        userId: req.user?.id ?? '',
        ipAddress: req.ipAddress || '',
        userAgent: req.userAgent || '',
      });
      res.json(salesReturn);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async listWarranties(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const warranties = await Warranty.find().sort({ createdAt: -1 });
      res.json(warranties);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async registerWarranty(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { productId, serialNumber, customerName, customerEmail, durationMonths, notes } =
      req.body;
    if (!productId || !serialNumber || !customerName || !customerEmail || !durationMonths) {
      return next(new ValidationError('All warranty fields are required.'));
    }
    try {
      const warranty = await ReturnsService.registerWarranty({
        productId,
        serialNumber,
        customerName,
        customerEmail,
        durationMonths: Number(durationMonths),
        notes,
        userId: req.user?.id ?? '',
        ipAddress: req.ipAddress || '',
        userAgent: req.userAgent || '',
      });
      res.status(201).json(warranty);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async claimWarranty(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { issueDescription, actionTaken, resolutionNotes } = req.body;
    if (!issueDescription || !actionTaken) {
      return next(new ValidationError('Issue description and action taken are required.'));
    }
    try {
      const warranty = await ReturnsService.fileWarrantyClaim({
        warrantyId: String(req.params.id),
        issueDescription,
        actionTaken,
        resolutionNotes,
        userId: req.user?.id ?? '',
        ipAddress: req.ipAddress || '',
        userAgent: req.userAgent || '',
      });
      res.json(warranty);
    } catch (err: unknown) {
      next(err);
    }
  }
}
