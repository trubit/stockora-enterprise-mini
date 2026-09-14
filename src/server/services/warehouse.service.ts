import mongoose from 'mongoose';
import { Warehouse, type IWarehouse, type WarehouseType } from '../models/Warehouse.js';
import { WarehouseZone, type IWarehouseZone, type ZoneType } from '../models/WarehouseZone.js';
import { WarehouseLocation, type IWarehouseLocation } from '../models/WarehouseLocation.js';
import { InventoryLocation } from '../models/InventoryLocation.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { memoryCache } from '../utils/cache.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreateWarehouseInput {
  companyId: string;
  branchId: string;
  name: string;
  code: string;
  warehouseType?: WarehouseType;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  managerId?: string;
  timezone?: string;
  capacityUnits?: number;
  capacityWeight?: number;
  capacityVolume?: number;
  notes?: string;
}

export interface CreateZoneInput {
  companyId: string;
  warehouseId: string;
  name: string;
  code: string;
  zoneType?: ZoneType;
  description?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  capacityUnits?: number;
  createdBy: string;
}

export interface CreateLocationInput {
  companyId: string;
  warehouseId: string;
  zoneId: string;
  locationCode: string;
  label?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  locationType?:
    | 'RECEIVING'
    | 'STORAGE'
    | 'PICKING'
    | 'PACKING'
    | 'QUARANTINE'
    | 'DAMAGED'
    | 'RETURNS'
    | 'DISPATCH'
    | 'TRANSIT';
  capacityUnits?: number;
  capacityWeight?: number;
  capacityVolume?: number;
  allowedProductIds?: string[];
  notes?: string;
  createdBy: string;
}

export class WarehouseService {
  /**
   * Create a new Warehouse
   */
  async createWarehouse(input: CreateWarehouseInput): Promise<IWarehouse> {
    const existing = await Warehouse.findOne({ code: input.code.toUpperCase() });
    if (existing) {
      throw new ValidationError(`Warehouse code [${input.code}] already exists.`);
    }

    const warehouse = await Warehouse.create({
      ...input,
      companyId: safeObjectId(input.companyId),
      branchId: safeObjectId(input.branchId),
      code: input.code.toUpperCase(),
      isActive: true,
    });

    memoryCache.invalidatePrefix('warehouses');
    return warehouse;
  }

  /**
   * Get all warehouses for a company/branch
   */
  async getWarehouses(companyId?: string, branchId?: string): Promise<IWarehouse[]> {
    const cacheKey = `warehouses:${companyId || 'all'}:${branchId || 'all'}`;
    const cached = memoryCache.get<IWarehouse[]>(cacheKey);
    if (cached) return cached;

    let warehouses = await Warehouse.find({ isActive: true }).sort({ name: 1 }).lean();

    // Auto-seed default primary warehouse if none exist
    if (!warehouses || warehouses.length === 0) {
      const compId = safeObjectId(companyId);
      const brId = safeObjectId(branchId);
      const defaultWh = await Warehouse.create({
        companyId: compId,
        branchId: brId,
        name: 'Primary Enterprise Warehouse',
        code: 'WH-MAIN',
        warehouseType: 'MAIN',
        address: '100 Logistics Blvd',
        city: 'Metropolis',
        country: 'USA',
        timezone: 'UTC',
        capacityUnits: 10000,
        isActive: true,
      });

      // Also auto-create a default zone & location
      const defaultZone = await WarehouseZone.create({
        companyId: compId,
        warehouseId: defaultWh._id,
        name: 'Primary Storage Zone',
        code: 'Z-MAIN',
        zoneType: 'STORAGE',
      });

      await WarehouseLocation.create({
        companyId: compId,
        warehouseId: defaultWh._id,
        zoneId: defaultZone._id,
        locationCode: 'A-01-01-01',
        locationType: 'STORAGE',
        capacityUnits: 1000,
        isActive: true,
      });

      warehouses = [defaultWh.toObject() as any];
    }

    memoryCache.set(cacheKey, warehouses, 15000);
    return warehouses as unknown as IWarehouse[];
  }

  /**
   * Get single warehouse by ID
   */
  async getWarehouseById(warehouseId: string): Promise<IWarehouse> {
    const whObjId = safeObjectId(warehouseId);
    let warehouse = await Warehouse.findById(whObjId);
    if (!warehouse) {
      warehouse = await Warehouse.findOne({ isActive: true });
    }
    if (!warehouse) throw new NotFoundError('Warehouse not found');
    return warehouse;
  }

  /**
   * Create a Warehouse Zone
   */
  async createZone(input: CreateZoneInput): Promise<IWarehouseZone> {
    const whObjId = safeObjectId(input.warehouseId);
    const warehouse = await Warehouse.findById(whObjId);
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const existing = await WarehouseZone.findOne({
      warehouseId: whObjId,
      code: input.code.toUpperCase(),
    });
    if (existing) {
      throw new ValidationError(`Zone code [${input.code}] already exists in this warehouse.`);
    }

    const zone = await WarehouseZone.create({
      ...input,
      companyId: safeObjectId(input.companyId),
      warehouseId: whObjId,
      code: input.code.toUpperCase(),
    });

    memoryCache.invalidatePrefix(`zones:${input.warehouseId}`);
    return zone;
  }

  /**
   * Get zones in a warehouse
   */
  async getZones(warehouseId: string): Promise<IWarehouseZone[]> {
    const whObjId = safeObjectId(warehouseId);
    const zones = await WarehouseZone.find({ warehouseId: whObjId, isActive: true })
      .sort({ code: 1 })
      .lean();
    return zones as unknown as IWarehouseZone[];
  }

  /**
   * Create a Warehouse Storage Location / Bin
   */
  async createLocation(input: CreateLocationInput): Promise<IWarehouseLocation> {
    const whObjId = safeObjectId(input.warehouseId);
    const zoneObjId = safeObjectId(input.zoneId);

    const existing = await WarehouseLocation.findOne({
      warehouseId: whObjId,
      locationCode: input.locationCode.toUpperCase(),
    });
    if (existing) {
      throw new ValidationError(
        `Location code [${input.locationCode}] already exists in this warehouse.`
      );
    }

    const location = await WarehouseLocation.create({
      ...input,
      companyId: safeObjectId(input.companyId),
      warehouseId: whObjId,
      zoneId: zoneObjId,
      locationCode: input.locationCode.toUpperCase(),
      currentUnits: 0,
      currentWeight: 0,
      currentVolume: 0,
      isActive: true,
    });

    memoryCache.invalidatePrefix(`locations:${input.warehouseId}`);
    return location;
  }

  /**
   * Get locations in a warehouse
   */
  async getLocations(
    warehouseId: string,
    filter?: { zoneId?: string; locationType?: string }
  ): Promise<IWarehouseLocation[]> {
    const whObjId = safeObjectId(warehouseId);
    const query: any = { warehouseId: whObjId, isActive: true };
    if (filter?.zoneId) query.zoneId = safeObjectId(filter.zoneId);
    if (filter?.locationType) query.locationType = filter.locationType;

    const locations = await WarehouseLocation.find(query).sort({ locationCode: 1 }).lean();
    return locations as unknown as IWarehouseLocation[];
  }
}

export const warehouseService = new WarehouseService();
