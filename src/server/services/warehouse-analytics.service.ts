import { Warehouse } from '../models/Warehouse.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { PickList } from '../models/PickList.js';
import { Package } from '../models/Package.js';
import { Dispatch } from '../models/Dispatch.js';
import { PutAwayTask } from '../models/PutAwayTask.js';
import { CycleCount } from '../models/CycleCount.js';
import { StockMovement } from '../models/StockMovement.js';
import { memoryCache } from '../utils/cache.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface IWarehouseAnalytics {
  warehouseId: string;
  warehouseName: string;
  capacity: {
    totalLocations: number;
    totalCapacityUnits: number;
    usedUnits: number;
    utilizationPercentage: number;
  };
  fulfillment: {
    totalPickLists: number;
    completedPickLists: number;
    pendingPickLists: number;
    pickAccuracyPercentage: number;
    totalPackagesPacked: number;
    totalDispatchesExecuted: number;
  };
  logistics: {
    pendingPutawayTasks: number;
    recentStockMovements30d: number;
    totalCycleCountVarianceValue: number;
  };
}

export class WarehouseAnalyticsService {
  /**
   * Executive Warehouse Dashboard Analytics
   */
  async getWarehouseAnalytics(warehouseId: string): Promise<IWarehouseAnalytics> {
    const cacheKey = `analytics:warehouse:${warehouseId}`;
    const cached = memoryCache.get<IWarehouseAnalytics>(cacheKey);
    if (cached) return cached;

    const whObjId = safeObjectId(warehouseId);
    let warehouse = await Warehouse.findById(whObjId);

    if (!warehouse) {
      warehouse = await Warehouse.findOne({ isActive: true });
    }

    const resolvedWhId = warehouse?._id ? warehouse._id : whObjId;

    // Locations & Capacity
    const locations = await WarehouseLocation.find({ warehouseId: resolvedWhId, isActive: true });
    let totalCapUnits = 0;
    let totalUsedUnits = 0;
    for (const loc of locations) {
      totalCapUnits += loc.capacityUnits || 0;
      totalUsedUnits += loc.currentUnits || 0;
    }

    // Picking Metrics
    const pickLists = await PickList.find({ warehouseId: resolvedWhId });
    const totalPickLists = pickLists.length;
    const completedPickLists = pickLists.filter((p) => p.status === 'PICKED').length;
    const totalItemsPicked = pickLists.reduce((acc, p) => acc + (p.totalPicked || 0), 0);
    const totalItemsShort = pickLists.reduce((acc, p) => acc + (p.totalShort || 0), 0);

    const pickAccuracy =
      totalItemsPicked + totalItemsShort > 0
        ? Math.round((totalItemsPicked / (totalItemsPicked + totalItemsShort)) * 100)
        : 100;

    // Packing Metrics
    const packages = await Package.find({ warehouseId: resolvedWhId });
    const totalPackages = packages.length;

    // Dispatch Metrics
    const dispatches = await Dispatch.find({ warehouseId: resolvedWhId });
    const totalDispatches = dispatches.length;

    // Put-away & Receiving Metrics
    const putawayTasks = await PutAwayTask.find({ warehouseId: resolvedWhId });
    const pendingPutaway = putawayTasks.filter((t) => t.status === 'PENDING').length;

    // Stock Movement History (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentMovements = await StockMovement.find({
      $or: [{ fromWarehouseId: resolvedWhId }, { toWarehouseId: resolvedWhId }],
      createdAt: { $gte: thirtyDaysAgo },
    }).countDocuments();

    // Cycle Count Variance
    const counts = await CycleCount.find({ warehouseId: resolvedWhId, status: 'COMPLETED' });
    const totalVarianceValue = counts.reduce((acc, c) => acc + (c.totalVarianceValue || 0), 0);

    const data: IWarehouseAnalytics = {
      warehouseId: resolvedWhId.toString(),
      warehouseName: warehouse?.name || 'Primary Enterprise Warehouse',
      capacity: {
        totalLocations: locations.length,
        totalCapacityUnits: totalCapUnits || warehouse?.capacityUnits || 10000,
        usedUnits: totalUsedUnits,
        utilizationPercentage:
          totalCapUnits > 0 ? Math.round((totalUsedUnits / totalCapUnits) * 100) : 0,
      },
      fulfillment: {
        totalPickLists,
        completedPickLists,
        pendingPickLists: totalPickLists - completedPickLists,
        pickAccuracyPercentage: pickAccuracy,
        totalPackagesPacked: totalPackages,
        totalDispatchesExecuted: totalDispatches,
      },
      logistics: {
        pendingPutawayTasks: pendingPutaway,
        recentStockMovements30d: recentMovements,
        totalCycleCountVarianceValue: totalVarianceValue,
      },
    };

    memoryCache.set(cacheKey, data, 10000);
    return data;
  }
}

export const warehouseAnalyticsService = new WarehouseAnalyticsService();
