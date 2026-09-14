import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { POSTerminal } from '../models/POSTerminal.js';
import { RegisterSession } from '../models/RegisterSession.js';
import { HeldSale } from '../models/HeldSale.js';
import { POSAdvancedService } from '../services/posAdvanced.service.js';

function buildTenantQuery(user: any): any {
  const query: any = {};
  if (user?.tenantId) {
    query.tenantId = user.tenantId;
  }
  if (user?.companyId && mongoose.isValidObjectId(user.companyId)) {
    query.companyId = new mongoose.Types.ObjectId(user.companyId);
  }
  return query;
}

export class POSAdvancedController {
  // Terminals
  public static async listTerminals(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const terminals = await POSTerminal.find(buildTenantQuery(user))
        .sort({ terminalCode: 1 })
        .lean();
      res.json(terminals);
    } catch (err) {
      next(err);
    }
  }

  public static async createTerminal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const terminal = await POSTerminal.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId:
          user?.companyId && mongoose.isValidObjectId(user.companyId) ? user.companyId : undefined,
      });
      res.status(201).json(terminal);
    } catch (err) {
      next(err);
    }
  }

  // Scan Product
  public static async scanProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const query = Array.isArray(req.params.query) ? req.params.query[0] : req.params.query || '';
      const result = await POSAdvancedService.scanBarcodeOrSku(query, user?.tenantId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Register Session Open/Close/Cash Movement
  public static async openRegisterSession(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const session = await RegisterSession.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        cashierId: user?.id,
        cashierName: user?.username || 'Cashier',
        status: 'OPEN',
        openedAt: new Date(),
      });
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  }

  public static async recordCashMovement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const session = await RegisterSession.findById(req.params.id);
      if (!session) {
        res.status(404).json({ message: 'Register session not found' });
        return;
      }
      session.cashMovements.push({
        type: req.body.type,
        amount: Number(req.body.amount),
        reason: req.body.reason,
        performedBy: user?.username || 'Operator',
        createdAt: new Date(),
      });
      await session.save();
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  public static async closeRegisterSession(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const session = await RegisterSession.findById(req.params.id);
      if (!session) {
        res.status(404).json({ message: 'Register session not found' });
        return;
      }
      session.closingCash = Number(req.body.closingCash);
      session.variance = session.closingCash - (session.expectedCash || 0);
      session.status = 'CLOSED';
      session.closedAt = new Date();
      if (req.body.managerNotes) session.managerNotes = req.body.managerNotes;
      await session.save();
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  // Hold / Resume
  public static async holdSale(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const held = await POSAdvancedService.holdSale({
        ...req.body,
        tenantId: user?.tenantId,
        cashierId: user?.id,
        cashierName: user?.username,
      });
      res.status(201).json(held);
    } catch (err) {
      next(err);
    }
  }

  public static async listHeldSales(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const sales = await HeldSale.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(sales);
    } catch (err) {
      next(err);
    }
  }

  public static async resumeSale(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const holdId = Array.isArray(req.params.holdId) ? req.params.holdId[0] : req.params.holdId;
      const sale = await POSAdvancedService.resumeSale(holdId);
      res.json(sale);
    } catch (err) {
      next(err);
    }
  }

  // Thermal Receipt
  public static async getThermalReceipt(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const receipt = await POSAdvancedService.generateThermalReceipt(id);
      res.json(receipt);
    } catch (err) {
      next(err);
    }
  }

  // Offline Sync
  public static async syncOfflineQueue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const result = await POSAdvancedService.syncOfflineQueue(
        req.body.transactions || [],
        user?.tenantId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
