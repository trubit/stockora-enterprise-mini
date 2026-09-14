import { Package, type IPackage, type IPackageItem } from '../models/Package.js';
import { PackingStation, type IPackingStation } from '../models/PackingStation.js';
import { PickList } from '../models/PickList.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreatePackageParams {
  companyId: string;
  warehouseId: string;
  orderId: string;
  orderNumber: string;
  packingStationId?: string;
  items: IPackageItem[];
  packagingType?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  carrier?: string;
  shippingMethod?: string;
  packerId: string;
  idempotencyKey?: string;
}

export class PackingService {
  /**
   * Create & initialize a Packing Station
   */
  async createPackingStation(params: {
    companyId: string;
    warehouseId: string;
    stationCode: string;
    name: string;
    createdBy: string;
  }): Promise<IPackingStation> {
    const whObjId = safeObjectId(params.warehouseId);
    const existing = await PackingStation.findOne({
      warehouseId: whObjId,
      stationCode: params.stationCode.toUpperCase(),
    });
    if (existing) {
      throw new ValidationError(`Packing station code [${params.stationCode}] already exists.`);
    }

    return PackingStation.create({
      companyId: safeObjectId(params.companyId),
      warehouseId: whObjId,
      stationCode: params.stationCode.toUpperCase(),
      name: params.name,
      isActive: true,
      createdBy: safeObjectId(params.createdBy),
    });
  }

  /**
   * Pack Picked Items into a Shipping Package
   */
  async packOrder(params: CreatePackageParams): Promise<IPackage> {
    const {
      companyId,
      warehouseId,
      orderId,
      orderNumber,
      packingStationId,
      items,
      packagingType = 'BOX_MED',
      weight,
      length,
      width,
      height,
      carrier,
      shippingMethod,
      packerId,
      idempotencyKey,
    } = params;

    if (idempotencyKey) {
      const existingPkg = await Package.findOne({ idempotencyKey });
      if (existingPkg) return existingPkg;
    }

    const orderObjId = safeObjectId(orderId);
    const whObjId = safeObjectId(warehouseId);
    const compObjId = safeObjectId(companyId);
    const packerObjId = safeObjectId(packerId);

    // Format package items with safeObjectIds
    const formattedItems = (items || []).map((item) => ({
      ...item,
      productId: safeObjectId(item.productId as any),
    }));

    const packageNumber = `PKG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const pkg = await Package.create({
      packageNumber,
      companyId: compObjId,
      warehouseId: whObjId,
      orderId: orderObjId,
      orderNumber: orderNumber || `STK-${Date.now().toString().slice(-6)}`,
      packingStationId: packingStationId ? safeObjectId(packingStationId) : undefined,
      packerId: packerObjId,
      items: formattedItems,
      packagingType,
      weight: weight || 1.5,
      length: length || 30,
      width: width || 20,
      height: height || 15,
      carrier: carrier || 'FedEx Express',
      shippingMethod: shippingMethod || 'STANDARD',
      status: 'PACKED',
      packedAt: new Date(),
      idempotencyKey,
      createdBy: packerObjId,
    });

    // Update OmnichannelOrder state if found
    const order = await OmnichannelOrder.findById(orderObjId);
    if (order) {
      order.fulfillmentStatus = 'PACKED';
      await order.save();
    }

    eventBus.emit('warehouse.order.packed', {
      packageId: pkg._id.toString(),
      orderId,
      packageNumber,
    });

    return pkg;
  }

  /**
   * Get active packages for an order
   */
  async getPackagesByOrder(orderId: string): Promise<IPackage[]> {
    const orderObjId = safeObjectId(orderId);
    return Package.find({ orderId: orderObjId })
      .sort({ createdAt: -1 })
      .lean() as unknown as IPackage[];
  }
}

export const packingService = new PackingService();
