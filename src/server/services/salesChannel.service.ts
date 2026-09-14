import { SalesChannel, type ISalesChannel, type SalesChannelType } from '../models/SalesChannel.js';
import { PriceList } from '../models/PriceList.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export interface CreateSalesChannelInput {
  tenantId?: string;
  companyId?: string;
  code: string;
  name: string;
  type: SalesChannelType;
  currency?: string;
  defaultWarehouseId?: string;
  allowedWarehouseIds?: string[];
  priceListId?: string;
  taxConfig?: {
    taxInclusive?: boolean;
    defaultTaxRate?: number;
    taxRegion?: string;
  };
  allowedPaymentMethods?: string[];
  fulfillmentStrategy?: 'DEFAULT_WAREHOUSE' | 'NEAREST' | 'SPLIT_AVAILABLE' | 'MANUAL';
  apiConfig?: {
    webhookUrl?: string;
    secretKey?: string;
    syncIntervalMinutes?: number;
  };
}

export class SalesChannelService {
  public static async createChannel(input: CreateSalesChannelInput): Promise<ISalesChannel> {
    const tenantId = input.tenantId || 'default';
    const companyId = input.companyId || 'default';

    const existing = await SalesChannel.findOne({
      tenantId,
      companyId,
      code: input.code.toUpperCase(),
    });
    if (existing) {
      throw new ValidationError(`Sales channel with code "${input.code}" already exists.`);
    }

    if (input.priceListId) {
      const priceList = await PriceList.findById(input.priceListId);
      if (!priceList) {
        throw new NotFoundError(`Specified price list not found.`);
      }
    }

    const channel = await SalesChannel.create({
      tenantId,
      companyId,
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      currency: input.currency || 'USD',
      defaultWarehouseId: input.defaultWarehouseId,
      allowedWarehouseIds: input.allowedWarehouseIds || [],
      priceListId: input.priceListId,
      taxConfig: {
        taxInclusive: input.taxConfig?.taxInclusive ?? false,
        defaultTaxRate: input.taxConfig?.defaultTaxRate ?? 0,
        taxRegion: input.taxConfig?.taxRegion,
      },
      allowedPaymentMethods: input.allowedPaymentMethods || [
        'CASH',
        'CARD',
        'BANK_TRANSFER',
        'STORE_CREDIT',
      ],
      fulfillmentStrategy: input.fulfillmentStrategy || 'DEFAULT_WAREHOUSE',
      apiConfig: input.apiConfig,
    });

    return channel;
  }

  public static async getChannels(tenantId = 'default', companyId = 'default'): Promise<any[]> {
    return SalesChannel.find({ tenantId, companyId }).sort({ name: 1 }).lean();
  }

  public static async getChannelById(id: string): Promise<ISalesChannel> {
    const channel = await SalesChannel.findById(id);
    if (!channel) {
      throw new NotFoundError('Sales channel not found');
    }
    return channel;
  }

  public static async getChannelByCode(
    code: string,
    tenantId = 'default',
    companyId = 'default'
  ): Promise<ISalesChannel> {
    const channel = await SalesChannel.findOne({ tenantId, companyId, code: code.toUpperCase() });
    if (!channel) {
      throw new NotFoundError(`Sales channel "${code}" not found`);
    }
    return channel;
  }

  public static async updateChannel(
    id: string,
    input: Partial<CreateSalesChannelInput>
  ): Promise<ISalesChannel> {
    const channel = await SalesChannel.findById(id);
    if (!channel) {
      throw new NotFoundError('Sales channel not found');
    }

    if (input.name) channel.name = input.name;
    if (input.currency) channel.currency = input.currency.toUpperCase();
    if (input.defaultWarehouseId !== undefined)
      channel.defaultWarehouseId = input.defaultWarehouseId as any;
    if (input.allowedWarehouseIds) channel.allowedWarehouseIds = input.allowedWarehouseIds as any;
    if (input.priceListId !== undefined) channel.priceListId = input.priceListId as any;
    if (input.taxConfig) {
      channel.taxConfig = {
        taxInclusive: input.taxConfig.taxInclusive ?? channel.taxConfig.taxInclusive,
        defaultTaxRate: input.taxConfig.defaultTaxRate ?? channel.taxConfig.defaultTaxRate,
        taxRegion: input.taxConfig.taxRegion ?? channel.taxConfig.taxRegion,
      };
    }
    if (input.allowedPaymentMethods) channel.allowedPaymentMethods = input.allowedPaymentMethods;
    if (input.fulfillmentStrategy) channel.fulfillmentStrategy = input.fulfillmentStrategy;
    if (input.apiConfig) channel.apiConfig = { ...channel.apiConfig, ...input.apiConfig };

    await channel.save();
    return channel;
  }
}
