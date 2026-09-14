import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SalesChannelService } from '../services/salesChannel.service.js';
import { PricingEngineService } from '../services/pricingEngine.service.js';
import { SalesQuoteService } from '../services/salesQuote.service.js';
import { OmnichannelSalesService } from '../services/omnichannelSales.service.js';
import { ChannelAdapterService } from '../services/channelAdapter.service.js';
import { SalesAnalyticsService } from '../services/salesAnalytics.service.js';
import { PriceList } from '../models/PriceList.js';
import { PriceListItem } from '../models/PriceListItem.js';
import { SalesTerritory } from '../models/SalesTerritory.js';

export class SalesController {
  // Sales Channels
  public static async listChannels(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const channels = await SalesChannelService.getChannels(user?.tenantId, user?.companyId);
      res.json(channels);
    } catch (err) {
      next(err);
    }
  }

  public static async createChannel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const channel = await SalesChannelService.createChannel({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }

  // Price Lists
  public static async listPriceLists(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const lists = await PriceList.find({
        tenantId: user?.tenantId || 'default',
        companyId: user?.companyId || 'default',
      })
        .sort({ name: 1 })
        .lean();
      res.json(lists);
    } catch (err) {
      next(err);
    }
  }

  public static async createPriceList(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const priceList = await PriceList.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId: user?.companyId || 'default',
      });
      res.status(201).json(priceList);
    } catch (err) {
      next(err);
    }
  }

  public static async addPriceListItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const item = await PriceListItem.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }

  public static async evaluateCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const cartResult = await PricingEngineService.evaluateCart(req.body.items || [], {
        customerId: req.body.customerId,
        channelId: req.body.channelId,
        customerGroup: req.body.customerGroup,
        couponCode: req.body.couponCode,
        promotionCode: req.body.promotionCode,
      });
      res.json(cartResult);
    } catch (err) {
      next(err);
    }
  }

  // Quotes
  public static async listQuotes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const quotes = await SalesQuoteService.getQuotes(user?.tenantId, user?.companyId);
      res.json(quotes);
    } catch (err) {
      next(err);
    }
  }

  public static async createQuote(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const quote = await SalesQuoteService.createQuote({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        salesRepId: user?.id,
        salesRepName: user?.username,
      });
      res.status(201).json(quote);
    } catch (err) {
      next(err);
    }
  }

  public static async convertQuoteToOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const headerKey = req.headers['x-idempotency-key'];
      const idempotencyKey =
        typeof headerKey === 'string'
          ? headerKey
          : Array.isArray(headerKey)
            ? headerKey[0]
            : undefined;
      const quoteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await SalesQuoteService.convertQuoteToOrder(quoteId, idempotencyKey);
      res.json(order);
    } catch (err) {
      next(err);
    }
  }

  // Orders
  public static async listOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const orders = await OmnichannelSalesService.getOrders(user?.tenantId, user?.companyId);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  }

  public static async createOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const headerKey = req.headers['x-idempotency-key'];
      const idempotencyKey =
        typeof headerKey === 'string'
          ? headerKey
          : Array.isArray(headerKey)
            ? headerKey[0]
            : req.body.idempotencyKey;
      const order = await OmnichannelSalesService.createOrder({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
        userName: user?.username,
        idempotencyKey,
      });
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }

  public static async releaseHold(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const holdId = Array.isArray(req.params.holdId) ? req.params.holdId[0] : req.params.holdId;
      const hold = await OmnichannelSalesService.releaseOrderHold(
        holdId,
        user?.id || 'admin',
        user?.username || 'Administrator'
      );
      res.json(hold);
    } catch (err) {
      next(err);
    }
  }

  public static async cancelOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await OmnichannelSalesService.cancelOrder(orderId, req.body.reason);
      res.json(order);
    } catch (err) {
      next(err);
    }
  }

  // Territories
  public static async listTerritories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const territories = await SalesTerritory.find({
        tenantId: user?.tenantId || 'default',
        companyId: user?.companyId || 'default',
      }).lean();
      res.json(territories);
    } catch (err) {
      next(err);
    }
  }

  public static async createTerritory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const territory = await SalesTerritory.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId: user?.companyId || 'default',
      });
      res.status(201).json(territory);
    } catch (err) {
      next(err);
    }
  }

  // Webhooks
  public static async handleExternalWebhook(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const channelCode = Array.isArray(req.params.channelCode)
        ? req.params.channelCode[0]
        : req.params.channelCode;
      const rawBody = JSON.stringify(req.body);
      const result = await ChannelAdapterService.processExternalOrderWebhook(
        channelCode,
        rawBody,
        req.body
      );
      res.json(result);
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
      const analytics = await SalesAnalyticsService.getAnalyticsOverview(
        user?.tenantId,
        user?.companyId
      );
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}
