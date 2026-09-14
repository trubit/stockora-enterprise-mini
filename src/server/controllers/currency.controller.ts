import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError } from '../errors/AppError.js';
import mongoose from 'mongoose';

export class CurrencyController {
  public static async listRates(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rates = await ExchangeRate.find({ isActive: true });
      res.json(rates);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateRate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { code, symbol, rate } = req.body;
    if (!code || !symbol || rate === undefined) {
      return next(new ValidationError('Code, symbol, and rate value are required.'));
    }

    try {
      const upperCode = code.toUpperCase();
      let rateDoc = await ExchangeRate.findOne({ code: upperCode });
      let prev: Record<string, unknown> | null = null;
      let action: 'CREATE' | 'UPDATE' = 'CREATE';

      if (rateDoc) {
        prev = rateDoc.toObject() as unknown as Record<string, unknown>;
        rateDoc.symbol = symbol;
        rateDoc.rate = Number(rate);
        action = 'UPDATE';
        await rateDoc.save();
      } else {
        rateDoc = await ExchangeRate.create({
          code: upperCode,
          symbol,
          rate: Number(rate),
          isActive: true,
        });
      }

      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user?.id),
        action,
        targetModel: 'ExchangeRate',
        targetId: rateDoc._id.toString(),
        previousValues: prev ?? undefined,
        newValues: rateDoc.toObject() as unknown as Record<string, unknown>,
      });

      res.status(action === 'CREATE' ? 201 : 200).json(rateDoc);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getTaxConfig(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        taxRate: 0,
        taxType: 'EXEMPT',
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateTaxConfig(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        taxRate: 0,
        taxType: 'EXEMPT',
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
