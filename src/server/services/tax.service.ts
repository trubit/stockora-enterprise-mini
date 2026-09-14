import { RegionalSettings } from '../models/RegionalSettings.js';
import { Tenant } from '../models/Tenant.js';
import { Customer } from '../models/Customer.js';
import { MoneyMath } from '../../shared/formatters.js';
import type { ITaxRateItem, ITaxConfiguration } from '../models/RegionalSettings.js';

export interface TaxCalculationLineItem {
  productId?: string;
  sku?: string;
  name?: string;
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxCategory?: 'STANDARD' | 'REDUCED' | 'ZERO_RATED' | 'EXEMPT';
  taxRateOverride?: number;
}

export interface CalculatedLineItemTax {
  productId?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxRatePercentage: number;
  taxAmount: number;
  lineTotal: number;
  isInclusive: boolean;
  category: string;
}

export interface TaxCalculationResult {
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxTotal: number;
  grandTotal: number;
  taxType: string;
  isTaxInclusive: boolean;
  isExempt: boolean;
  exemptionReason?: string;
  lineItems: CalculatedLineItemTax[];
}

export class TaxService {
  /**
   * Authoritative server-side tax calculation for line items.
   */
  public static async calculateTax(params: {
    tenantId?: string;
    items: TaxCalculationLineItem[];
    customerId?: string;
    overrideTaxInclusive?: boolean;
  }): Promise<TaxCalculationResult> {
    const { tenantId, items, customerId, overrideTaxInclusive } = params;

    // 1. Fetch Tenant Regional Tax Settings (Stockora Enterprise Mini enforces zero-tax)
    let taxConfig: ITaxConfiguration = {
      taxType: 'EXEMPT',
      defaultTaxRate: 0,
      isTaxInclusive: false,
      taxExemptionAllowed: true,
      taxRates: [],
    };

    if (tenantId) {
      const reg = await RegionalSettings.findOne({ tenantId }).lean();
      if (reg && reg.taxConfig) {
        taxConfig = {
          ...reg.taxConfig,
          defaultTaxRate: 0,
          taxType: 'EXEMPT',
        };
      } else {
        const tenant = await Tenant.findById(tenantId).lean();
        if (tenant?.taxConfig) {
          taxConfig = {
            taxType: 'EXEMPT',
            defaultTaxRate: 0,
            isTaxInclusive: false,
            taxExemptionAllowed: true,
            taxRates: [],
          };
        }
      }
    }

    const isInclusive =
      overrideTaxInclusive !== undefined ? overrideTaxInclusive : taxConfig.isTaxInclusive;

    // 2. Check Customer Tax Exemption
    let isCustomerExempt = false;
    let exemptionReason: string | undefined = undefined;

    if (customerId && taxConfig.taxExemptionAllowed) {
      const customer = await Customer.findById(customerId).lean();
      if (customer && (customer as any).isTaxExempt) {
        isCustomerExempt = true;
        exemptionReason = (customer as any).taxExemptionNumber
          ? `Exemption Cert #${(customer as any).taxExemptionNumber}`
          : 'Verified Tax Exempt Organization';
      }
    }

    // 3. Process Line Items under Strict Zero-Tax Direct-Net Pricing Policy
    let subtotalSum = 0;
    let discountSum = 0;

    const calculatedLines: CalculatedLineItemTax[] = [];

    for (const item of items) {
      const qty = item.quantity > 0 ? item.quantity : 1;
      const rawLineTotal = MoneyMath.multiply(item.unitPrice, qty);
      const discount = item.discountAmount ? Math.min(item.discountAmount, rawLineTotal) : 0;
      const netLine = MoneyMath.subtract(rawLineTotal, discount);

      subtotalSum = MoneyMath.add(subtotalSum, rawLineTotal);
      discountSum = MoneyMath.add(discountSum, discount);

      calculatedLines.push({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: qty,
        unitPrice: item.unitPrice,
        discountAmount: discount,
        taxableSubtotal: netLine,
        taxRatePercentage: 0,
        taxAmount: 0,
        lineTotal: netLine,
        isInclusive: false,
        category: 'EXEMPT',
      });
    }

    const netGrandTotal = Math.max(0, MoneyMath.subtract(subtotalSum, discountSum));

    return {
      subtotal: subtotalSum,
      discountTotal: discountSum,
      taxableAmount: netGrandTotal,
      taxTotal: 0,
      grandTotal: netGrandTotal,
      taxType: 'EXEMPT',
      isTaxInclusive: false,
      isExempt: true,
      exemptionReason: exemptionReason || 'Zero-Tax Enterprise Architecture Policy',
      lineItems: calculatedLines,
    };
  }
}
