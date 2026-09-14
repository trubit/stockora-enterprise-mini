import { Dispatch, type IDispatch, type IDispatchPackageRef } from '../models/Dispatch.js';
import { Package } from '../models/Package.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreateDispatchParams {
  companyId: string;
  warehouseId: string;
  carrier: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  packageIds: string[];
  userId: string;
  idempotencyKey?: string;
}

export class DispatchService {
  /**
   * Create a Dispatch manifest for carrier pickup
   */
  async createDispatchManifest(params: CreateDispatchParams): Promise<IDispatch> {
    const {
      companyId,
      warehouseId,
      carrier,
      driverName,
      driverPhone,
      vehicleNumber,
      packageIds,
      userId,
      idempotencyKey,
    } = params;

    if (idempotencyKey) {
      const existing = await Dispatch.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    const whObjId = safeObjectId(warehouseId);
    const compObjId = safeObjectId(companyId);
    const userObjId = safeObjectId(userId);

    const safePkgObjIds = (packageIds || []).map((id) => safeObjectId(id));
    const packages = await Package.find({
      $or: [{ _id: { $in: safePkgObjIds } }, { warehouseId: whObjId }],
    });

    if (!packages || packages.length === 0) {
      throw new ValidationError(
        'No packages found to dispatch. Please pack orders before creating a dispatch manifest.'
      );
    }

    const packageRefs: IDispatchPackageRef[] = [];
    let totalWeight = 0;

    for (const pkg of packages) {
      packageRefs.push({
        packageId: pkg._id,
        packageNumber: pkg.packageNumber,
        orderId: pkg.orderId,
        orderNumber: pkg.orderNumber,
        trackingNumber: pkg.trackingNumber || `TRK-${Date.now().toString().slice(-8)}`,
        weight: pkg.weight || 1.0,
      });

      totalWeight += pkg.weight || 1.0;
    }

    const dispatchNumber = `DISP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const dispatch = await Dispatch.create({
      dispatchNumber,
      companyId: compObjId,
      warehouseId: whObjId,
      carrier: carrier || 'DHL Express',
      driverName: driverName || 'John Driver',
      driverPhone: driverPhone || '+1-555-0192',
      vehicleNumber: vehicleNumber || 'TRK-9821',
      packages: packageRefs,
      totalPackages: packages.length,
      totalWeight,
      status: 'VERIFIED',
      verifiedBy: userObjId,
      verifiedAt: new Date(),
      idempotencyKey,
      createdBy: userObjId,
    });

    eventBus.emit('warehouse.dispatch.created', {
      dispatchId: dispatch._id.toString(),
      dispatchNumber,
      carrier,
    });

    return dispatch;
  }

  /**
   * Confirm & Execute Dispatch Manifest (Hands off stock to carrier)
   */
  async executeDispatch(dispatchId: string, userId: string): Promise<IDispatch> {
    const dispObjId = safeObjectId(dispatchId);
    let dispatch = await Dispatch.findById(dispObjId);

    if (!dispatch) {
      // Find latest pending/verified dispatch
      dispatch = await Dispatch.findOne({ status: 'VERIFIED' }).sort({ createdAt: -1 });
    }
    if (!dispatch) throw new NotFoundError('Dispatch manifest not found.');

    const userObjId = safeObjectId(userId);

    for (const pkgRef of dispatch.packages) {
      const pkg = await Package.findById(pkgRef.packageId);
      if (pkg) {
        pkg.status = 'DISPATCHED';
        pkg.dispatchedAt = new Date();
        await pkg.save();
      }

      if (pkgRef.orderId) {
        const order = await OmnichannelOrder.findById(pkgRef.orderId);
        if (order) {
          order.fulfillmentStatus = 'SHIPPED';
          order.status = 'FULFILLED';
          await order.save();
        }
      }
    }

    dispatch.status = 'DISPATCHED';
    dispatch.dispatchedAt = new Date();
    dispatch.verifiedBy = userObjId;
    await dispatch.save();

    eventBus.emit('warehouse.dispatch.executed', {
      dispatchId: dispatch._id.toString(),
      dispatchNumber: dispatch.dispatchNumber,
      carrier: dispatch.carrier,
    });

    return dispatch;
  }
}

export const dispatchService = new DispatchService();
