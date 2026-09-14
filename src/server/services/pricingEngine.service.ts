import { PriceList } from '../models/PriceList.js';
import { PriceListItem } from '../models/PriceListItem.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { SalesAssignment } from '../models/SalesAssignment.js';
import { Promotion } from '../models/Promotion.js';
import { Coupon } from '../models/Coupon.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface EvaluatedItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  itemSubtotal: number;
  itemDiscount: number;
  itemTax: number;
  itemTotal: number;
  appliedPriceListType?: string;
}

export interface CartEvaluationResult {
  items: EvaluatedItem[];
  subtotal: number;
  productDiscountsTotal: number;
  promotionDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  appliedPromotions: string[];
  appliedCouponCode?: string;
}

export class PricingEngineService {
  public static async evaluatePriceForItem(
    productId: string,
    quantity: number,
    customerId?: string,
    channelId?: string,
    customerGroup?: string
  ): Promise<{ unitPrice: number; originalPrice: number; priceListType: string }> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }

    const originalPrice =
      product.retailPrice && product.retailPrice > 0
        ? product.retailPrice
        : product.sellingPrice || product.price || 0;

    let targetPriceListId: string | null = null;
    let priceListType = 'STANDARD';

    if (customerId) {
      const assignment = await SalesAssignment.findOne({ customerId });
      if (assignment?.priceListId) {
        const itemRule = await PriceListItem.findOne({
          priceListId: assignment.priceListId,
          productId,
          minQuantity: { $lte: quantity },
          $or: [
            { maxQuantity: { $gte: quantity } },
            { maxQuantity: { $exists: false } },
            { maxQuantity: null },
          ],
        }).sort({ minQuantity: -1 });

        if (itemRule) {
          return {
            unitPrice: itemRule.unitPrice,
            originalPrice,
            priceListType: 'CUSTOMER_SPECIFIC',
          };
        }
      }
    }

    if (customerGroup || customerId) {
      let groupName = customerGroup;
      if (!groupName && customerId) {
        const customer = await Customer.findById(customerId);
        if (customer) groupName = customer.group;
      }

      if (groupName) {
        const groupPriceLists = await PriceList.find({
          $or: [{ customerGroupId: groupName }, { type: groupName }],
          isActive: true,
        }).sort({ createdAt: -1 });

        for (const pl of groupPriceLists) {
          const itemRule = await PriceListItem.findOne({
            priceListId: pl._id,
            productId,
            minQuantity: { $lte: quantity },
            $or: [
              { maxQuantity: { $gte: quantity } },
              { maxQuantity: { $exists: false } },
              { maxQuantity: null },
            ],
          }).sort({ minQuantity: -1 });

          if (itemRule) {
            return {
              unitPrice: itemRule.unitPrice,
              originalPrice,
              priceListType: `GROUP_${groupName}`,
            };
          }
        }
      }
    }

    if (channelId) {
      const channelPriceLists = await PriceList.find({ channelId, isActive: true }).sort({
        createdAt: -1,
      });
      for (const pl of channelPriceLists) {
        const itemRule = await PriceListItem.findOne({
          priceListId: pl._id,
          productId,
          minQuantity: { $lte: quantity },
          $or: [
            { maxQuantity: { $gte: quantity } },
            { maxQuantity: { $exists: false } },
            { maxQuantity: null },
          ],
        }).sort({ minQuantity: -1 });

        if (itemRule) {
          return { unitPrice: itemRule.unitPrice, originalPrice, priceListType: 'CHANNEL' };
        }
      }
    }

    const defaultPriceLists = await PriceList.find({ isDefault: true, isActive: true }).sort({
      createdAt: -1,
    });
    for (const pl of defaultPriceLists) {
      const itemRule = await PriceListItem.findOne({
        priceListId: pl._id,
        productId,
        minQuantity: { $lte: quantity },
        $or: [
          { maxQuantity: { $gte: quantity } },
          { maxQuantity: { $exists: false } },
          { maxQuantity: null },
        ],
      }).sort({ minQuantity: -1 });

      if (itemRule) {
        return {
          unitPrice: itemRule.unitPrice,
          originalPrice,
          priceListType: 'DEFAULT_PRICE_LIST',
        };
      }
    }

    return {
      unitPrice: originalPrice,
      originalPrice,
      priceListType: 'STANDARD',
    };
  }

  public static async evaluateCart(
    cartItems: CartItemInput[],
    options: {
      customerId?: string;
      channelId?: string;
      customerGroup?: string;
      couponCode?: string;
      promotionCode?: string;
      taxRate?: number;
      currency?: string;
    } = {}
  ): Promise<CartEvaluationResult> {
    const taxRate = options.taxRate ?? 0;
    const evaluatedItems: EvaluatedItem[] = [];
    let subtotal = 0;

    for (const itemInput of cartItems) {
      const product = await Product.findById(itemInput.productId);
      if (!product) {
        throw new NotFoundError(`Product ${itemInput.productId} not found`);
      }

      const { unitPrice, originalPrice, priceListType } = await this.evaluatePriceForItem(
        itemInput.productId,
        itemInput.quantity,
        options.customerId,
        options.channelId,
        options.customerGroup
      );

      const itemSubtotal = unitPrice * itemInput.quantity;
      const itemDiscount = Math.max(0, (originalPrice - unitPrice) * itemInput.quantity);
      const itemTax = 0;
      const itemTotal = itemSubtotal;

      subtotal += itemSubtotal;

      evaluatedItems.push({
        productId: product._id.toString(),
        sku: product.sku,
        name: product.name,
        quantity: itemInput.quantity,
        unitPrice,
        originalPrice,
        itemSubtotal,
        itemDiscount,
        itemTax,
        itemTotal,
        appliedPriceListType: priceListType,
      });
    }

    let promotionDiscount = 0;
    const appliedPromotions: string[] = [];

    if (options.promotionCode) {
      const promo = await Promotion.findOne({
        code: options.promotionCode.toUpperCase(),
        isActive: true,
        expiresAt: { $gte: new Date() },
      });

      if (promo && subtotal >= promo.minPurchase) {
        if (promo.type === 'PERCENTAGE') {
          promotionDiscount = (subtotal * promo.value) / 100;
        } else if (promo.type === 'FIXED') {
          promotionDiscount = Math.min(subtotal, promo.value);
        }
        appliedPromotions.push(promo.code);
      }
    }

    let couponDiscount = 0;
    let appliedCouponCode: string | undefined;

    if (options.couponCode) {
      const coupon = await Coupon.findOne({
        code: options.couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      });

      if (coupon && subtotal >= coupon.minPurchaseAmount) {
        if (coupon.usageLimit && coupon.currentUsageCount >= coupon.usageLimit) {
          throw new ValidationError(`Coupon "${coupon.code}" has reached its maximum usage limit.`);
        }

        if (coupon.discountType === 'PERCENTAGE') {
          couponDiscount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount) {
            couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
          }
        } else {
          couponDiscount = Math.min(subtotal, coupon.discountValue);
        }

        appliedCouponCode = coupon.code;
      }
    }

    const productDiscountsTotal = evaluatedItems.reduce((acc, item) => acc + item.itemDiscount, 0);
    const totalDiscount = productDiscountsTotal + promotionDiscount + couponDiscount;
    const taxableSubtotal = Math.max(0, subtotal - promotionDiscount - couponDiscount);
    const taxTotal = 0;
    const grandTotal = taxableSubtotal;

    return {
      items: evaluatedItems,
      subtotal,
      productDiscountsTotal,
      promotionDiscount,
      couponDiscount,
      totalDiscount,
      taxTotal,
      grandTotal,
      currency: options.currency || 'USD',
      appliedPromotions,
      appliedCouponCode,
    };
  }
}
