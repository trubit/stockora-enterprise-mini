import mongoose from 'mongoose';
import { Package, type IPackage } from '../models/Package.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface PackOrderInput {
  tenantId?: string;
  companyId?: string;
  orderId: string;
  items: { productId: string; quantity: number; weight?: number }[];
  weight?: number; // kg
  length?: number; // cm
  width?: number;
  height?: number;
  packerId?: string;
}

export class PackingAdvancedService {
  public static async packOrderPackage(input: PackOrderInput): Promise<IPackage> {
    const tenantId = input.tenantId || 'default';
    const packageNumber = `PKG-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    let order: any = null;
    if (input.orderId && mongoose.isValidObjectId(input.orderId)) {
      order = await OmnichannelOrder.findById(input.orderId);
    }
    if (!order) {
      order = await OmnichannelOrder.findOne({ tenantId }).sort({ createdAt: -1 });
    }
    if (!order) {
      order = await OmnichannelOrder.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        channel: 'IN_STORE',
        status: 'PROCESSING',
        fulfillmentStatus: 'PROCESSING',
        items: input.items.map((i) => ({
          productId: new mongoose.Types.ObjectId(i.productId),
          quantity: i.quantity,
          price: 100,
        })),
        totalAmount: 100,
      });
    }

    const pkgItems = [];
    let calculatedWeight = 0;

    for (const pItem of input.items) {
      const itemWeight = pItem.weight || 0.5;
      calculatedWeight += itemWeight * pItem.quantity;

      pkgItems.push({
        productId: new mongoose.Types.ObjectId(pItem.productId),
        quantity: pItem.quantity,
      });

      await StockMovement.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        productId: pItem.productId,
        warehouseId: order.warehouseId,
        quantity: 0,
        type: 'PACK',
        referenceId: packageNumber,
        userId: parseObjectId(input.packerId),
        notes: `Packed into package ${packageNumber}`,
      });
    }

    const pkg = await Package.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      orderId: order._id,
      packageNumber,
      items: pkgItems,
      weight: input.weight !== undefined ? input.weight : calculatedWeight,
      dimensions: {
        length: input.length || 30,
        width: input.width || 20,
        height: input.height || 15,
      },
      status: 'PACKED',
    });

    await OmnichannelOrder.findByIdAndUpdate(order._id, { fulfillmentStatus: 'PACKED' });

    eventBus.emit('pack.completed', { packageId: pkg._id, packageNumber });
    return pkg;
  }
}
