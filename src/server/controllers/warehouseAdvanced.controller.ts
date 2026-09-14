import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Warehouse } from '../models/Warehouse.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { WarehouseTransfer } from '../models/WarehouseTransfer.js';
import { PickList } from '../models/PickList.js';
import { Package } from '../models/Package.js';
import { DispatchManifest } from '../models/DispatchManifest.js';
import { CycleCount } from '../models/CycleCount.js';
import { WarehouseAdvancedService } from '../services/warehouseAdvanced.service.js';
import { PickingAdvancedService } from '../services/pickingAdvanced.service.js';
import { PackingAdvancedService } from '../services/packingAdvanced.service.js';
import { DispatchAdvancedService } from '../services/dispatchAdvanced.service.js';
import { StockCountAdvancedService } from '../services/stockCountAdvanced.service.js';
import { WarehouseAnalyticsAdvancedService } from '../services/warehouseAnalyticsAdvanced.service.js';

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

export class WarehouseAdvancedController {
  // Warehouses & Locations
  public static async listWarehouses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const warehouses = await Warehouse.find(buildTenantQuery(user)).sort({ name: 1 }).lean();
      res.json(warehouses);
    } catch (err) {
      next(err);
    }
  }

  public static async createWarehouse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const wh = await WarehouseAdvancedService.createWarehouse({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(wh);
    } catch (err) {
      next(err);
    }
  }

  public static async listLocations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const locations = await WarehouseLocation.find(buildTenantQuery(user))
        .sort({ locationCode: 1 })
        .lean();
      res.json(locations);
    } catch (err) {
      next(err);
    }
  }

  public static async createLocation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const loc = await WarehouseAdvancedService.createLocation({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
      });
      res.status(201).json(loc);
    } catch (err) {
      next(err);
    }
  }

  // Inter-Warehouse Transfers
  public static async listTransfers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const transfers = await WarehouseTransfer.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(transfers);
    } catch (err) {
      next(err);
    }
  }

  public static async createTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const transfer = await WarehouseAdvancedService.createTransferRequest({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
      });
      res.status(201).json(transfer);
    } catch (err) {
      next(err);
    }
  }

  public static async approveTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const transfer = await WarehouseAdvancedService.approveTransfer(id, user?.id);
      res.json(transfer);
    } catch (err) {
      next(err);
    }
  }

  public static async dispatchTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const transfer = await WarehouseAdvancedService.dispatchTransfer(
        id,
        req.body.shippedItems,
        user?.id
      );
      res.json(transfer);
    } catch (err) {
      next(err);
    }
  }

  public static async receiveTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const transfer = await WarehouseAdvancedService.receiveTransfer(
        id,
        req.body.receivedItems,
        user?.id
      );
      res.json(transfer);
    } catch (err) {
      next(err);
    }
  }

  // Picking Engine
  public static async listPickTasks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const tasks = await PickList.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(tasks);
    } catch (err) {
      next(err);
    }
  }

  public static async createPickTask(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const task = await PickingAdvancedService.createPickTask({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  }

  public static async executePickItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const pickList = await PickingAdvancedService.executePickItem({
        ...req.body,
        pickerId: user?.id,
      });
      res.json(pickList);
    } catch (err) {
      next(err);
    }
  }

  // Packing Station
  public static async listPackages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const pkgs = await Package.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(pkgs);
    } catch (err) {
      next(err);
    }
  }

  public static async packOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const pkg = await PackingAdvancedService.packOrderPackage({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        packerId: user?.id,
      });
      res.status(201).json(pkg);
    } catch (err) {
      next(err);
    }
  }

  // Dispatch & Manifests
  public static async listManifests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const manifests = await DispatchManifest.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(manifests);
    } catch (err) {
      next(err);
    }
  }

  public static async createManifest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const manifest = await DispatchAdvancedService.createDispatchManifest({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(manifest);
    } catch (err) {
      next(err);
    }
  }

  public static async verifyPackageLoaded(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const manifest = await DispatchAdvancedService.verifyPackageLoaded(
        id,
        req.body.packageNumber
      );
      res.json(manifest);
    } catch (err) {
      next(err);
    }
  }

  public static async executeDispatch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const manifest = await DispatchAdvancedService.executeDispatch(id, user?.id, user?.username);
      res.json(manifest);
    } catch (err) {
      next(err);
    }
  }

  // Stock Counting & Reconciliation
  public static async listCounts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const counts = await CycleCount.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(counts);
    } catch (err) {
      next(err);
    }
  }

  public static async createCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const countDoc = await StockCountAdvancedService.createStockCount({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(countDoc);
    } catch (err) {
      next(err);
    }
  }

  public static async submitCountResults(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const countDoc = await StockCountAdvancedService.submitCountResults({
        ...req.body,
        counterId: user?.id,
      });
      res.json(countDoc);
    } catch (err) {
      next(err);
    }
  }

  public static async approveCountReconciliation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const countDoc = await StockCountAdvancedService.approveCountReconciliation(
        id,
        user?.id,
        user?.username
      );
      res.json(countDoc);
    } catch (err) {
      next(err);
    }
  }

  // Dispositions
  public static async processDisposition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const adjustment = await WarehouseAdvancedService.processInventoryDisposition({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
      });
      res.status(201).json(adjustment);
    } catch (err) {
      next(err);
    }
  }

  // Analytics
  public static async getAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const analytics = await WarehouseAnalyticsAdvancedService.getWarehouseAnalytics(
        user?.tenantId,
        user?.companyId
      );
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}
