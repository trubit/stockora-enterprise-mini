import mongoose from 'mongoose';
import { DispatchManifest, type IDispatchManifest } from '../models/DispatchManifest.js';
import { Package } from '../models/Package.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export class DispatchAdvancedService {
  public static async createDispatchManifest(input: {
    tenantId?: string;
    companyId?: string;
    warehouseId: string;
    carrierName: string;
    carrierCode?: string;
    driverName?: string;
    driverPhone?: string;
    vehiclePlateNumber?: string;
    packageIds: string[];
    notes?: string;
  }): Promise<IDispatchManifest> {
    const tenantId = input.tenantId || 'default';
    const manifestNumber = `MNF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const items = [];
    let totalWeight = 0;

    for (const pkgId of input.packageIds) {
      const pkg = await Package.findById(pkgId).populate('orderId');
      if (!pkg) throw new NotFoundError(`Package ${pkgId} not found`);

      totalWeight += pkg.weight || 0;
      items.push({
        packageId: pkg._id,
        packageNumber: pkg.packageNumber,
        orderId: pkg.orderId?._id,
        orderNumber: (pkg.orderId as any)?.orderNumber,
        recipientName: (pkg.orderId as any)?.customerName,
        destinationCity: (pkg.orderId as any)?.shippingAddress?.city,
        weight: pkg.weight || 0,
        isVerifiedLoaded: false,
      });
    }

    const manifest = await DispatchManifest.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      manifestNumber,
      carrierName: input.carrierName,
      carrierCode: input.carrierCode,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      vehiclePlateNumber: input.vehiclePlateNumber,
      items,
      totalPackages: items.length,
      totalWeight,
      status: 'DRAFT',
      notes: input.notes,
    });

    eventBus.emit('manifest.created', { manifestId: manifest._id, manifestNumber });
    return manifest;
  }

  public static async verifyPackageLoaded(
    manifestId: string,
    packageNumber: string
  ): Promise<IDispatchManifest> {
    const manifest = await DispatchManifest.findById(manifestId);
    if (!manifest) throw new NotFoundError('Dispatch manifest not found');

    const item = manifest.items.find((i: any) => i.packageNumber === packageNumber);
    if (!item)
      throw new ValidationError(
        `Package ${packageNumber} is not on manifest ${manifest.manifestNumber}`
      );

    item.isVerifiedLoaded = true;
    const allLoaded = manifest.items.every((i: any) => i.isVerifiedLoaded);
    if (allLoaded) manifest.status = 'LOADED';
    await manifest.save();

    eventBus.emit('manifest.item_verified', { manifestId: manifest._id, packageNumber });
    return manifest;
  }

  public static async executeDispatch(
    manifestId: string,
    userId?: string,
    userName?: string
  ): Promise<IDispatchManifest> {
    const manifest = await DispatchManifest.findById(manifestId);
    if (!manifest) throw new NotFoundError('Dispatch manifest not found');

    for (const item of manifest.items) {
      if (item.packageId) {
        await Package.findByIdAndUpdate(item.packageId, { status: 'DISPATCHED' });
      }
      if (item.orderId) {
        await OmnichannelOrder.findByIdAndUpdate(item.orderId, { fulfillmentStatus: 'DISPATCHED' });

        const order = await OmnichannelOrder.findById(item.orderId);
        if (order) {
          for (const orderItem of order.items || []) {
            await StockMovement.create({
              tenantId: manifest.tenantId,
              companyId: manifest.companyId,
              productId: orderItem.productId,
              warehouseId: manifest.warehouseId,
              quantity: -orderItem.quantity,
              type: 'DISPATCH',
              referenceId: manifest.manifestNumber,
              userId: parseObjectId(userId),
              notes: `Dispatched on manifest ${manifest.manifestNumber}`,
            });
          }
        }
      }
    }

    manifest.status = 'DISPATCHED';
    manifest.dispatchedBy = parseObjectId(userId);
    manifest.dispatchedByName = userName || 'Dispatch Supervisor';
    manifest.dispatchedAt = new Date();
    await manifest.save();

    eventBus.emit('shipment.dispatched', {
      manifestId: manifest._id,
      manifestNumber: manifest.manifestNumber,
    });
    return manifest;
  }
}
