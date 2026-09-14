import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SalesQuote } from '../models/SalesQuote.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class QuoteController {
  public static async listQuotes(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const quotes = await SalesQuote.find()
        .populate('customerId', 'name code email')
        .populate('items.productId', 'name sku price')
        .sort({ createdAt: -1 })
        .lean();
      res.json(quotes);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createQuote(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { customerId, items, discount, validUntil, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !validUntil) {
      return next(new ValidationError('items array and validUntil date are required.'));
    }

    try {
      let subtotal = 0;
      const formattedItems = items.map((i) => {
        const qty = Number(i.quantity || 0);
        const prc = Number(i.price || 0);
        subtotal += qty * prc;
        return {
          productId: new mongoose.Types.ObjectId(i.productId),
          quantity: qty,
          price: prc,
        };
      });

      const taxRate = 0.08; // 8% sales tax
      const tax = subtotal * taxRate;
      const disc = Number(discount || 0);
      const total = Math.max(0, subtotal + tax - disc);

      const quoteNumber = `QT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const quote = await SalesQuote.create({
        quoteNumber,
        customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
        items: formattedItems,
        subtotal,
        tax,
        discount: disc,
        total,
        validUntil: new Date(validUntil),
        notes,
        status: 'PENDING',
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'SalesQuote',
        targetId: quote._id.toString(),
        newValues: quote.toObject(),
      });

      res.status(201).json(quote);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async acceptQuote(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const quote = await SalesQuote.findById(id);
      if (!quote) {
        return next(new NotFoundError('Sales Quote not found.'));
      }

      if (
        quote.status === 'CONVERTED' ||
        quote.status === 'EXPIRED' ||
        quote.status === 'REJECTED'
      ) {
        return next(new ValidationError(`Quote cannot be accepted from state: ${quote.status}`));
      }

      const oldValues = quote.toObject();
      quote.status = 'ACCEPTED';
      await quote.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'SalesQuote',
        targetId: quote._id.toString(),
        priorValues: oldValues,
        newValues: quote.toObject(),
      });

      res.json(quote);
    } catch (err: unknown) {
      next(err);
    }
  }
}
