import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { InventoryForecast } from '../models/InventoryForecast.js';
import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { StockoutRisk } from '../models/StockoutRisk.js';
import { SupplierScore } from '../models/SupplierScore.js';
import { TransferRecommendation } from '../models/TransferRecommendation.js';
import { ForecastingService } from '../services/forecasting.service.js';
import { ReplenishmentService } from '../services/replenishment.service.js';
import { SupplierIntelligenceService } from '../services/supplier-intelligence.service.js';
import { InventoryOptimizationService } from '../services/inventory-optimization.service.js';

describe('Phase 29 — Inventory Intelligence & Forecasting Tests', () => {
  let sampleProduct: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri =
        process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }

    // Create a sample product for testing
    sampleProduct = await Product.create({
      sku: `SKU-TEST-${Date.now()}`,
      name: 'Test Wireless Keyboard',
      category: 'Electronics',
      costPrice: 45,
      sellingPrice: 89,
      price: 89,
      cost: 45,
      quantity: 15,
      lowStockAlert: 10,
    });
  });

  beforeEach(async () => {
    const exists = sampleProduct?._id ? await Product.findById(sampleProduct._id) : null;
    if (!exists) {
      sampleProduct = await Product.create({
        sku: `SKU-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: 'Test Wireless Keyboard',
        category: 'Electronics',
        costPrice: 45,
        sellingPrice: 89,
        price: 89,
        cost: 45,
        quantity: 15,
        lowStockAlert: 10,
      });
    }
  });

  afterAll(async () => {
    if (sampleProduct?._id) {
      await Product.deleteOne({ _id: sampleProduct._id });
      await InventoryForecast.deleteMany({ productId: sampleProduct._id });
      await ReorderRecommendation.deleteMany({ productId: sampleProduct._id });
      await StockoutRisk.deleteMany({ productId: sampleProduct._id });
    }
  });

  describe('Demand Forecasting Engine', () => {
    it('should generate product forecast using weighted moving average strategy', async () => {
      const forecast = await ForecastingService.generateProductForecast({
        productId: sampleProduct._id.toString(),
        method: 'WEIGHTED_MOVING_AVERAGE',
        period: 'MONTHLY',
      });

      expect(forecast).toBeDefined();
      expect(forecast.productId.toString()).toBe(sampleProduct._id.toString());
      expect(forecast.forecastedDemand).toBeGreaterThan(0);
      expect(forecast.confidenceScore).toBeGreaterThanOrEqual(60);
      expect(forecast.method).toBe('WEIGHTED_MOVING_AVERAGE');
    });
  });

  describe('Smart Replenishment & Safety Stock', () => {
    it('should calculate dynamic safety stock and reorder point', async () => {
      const recommendation = await ReplenishmentService.calculateReplenishment({
        productId: sampleProduct._id.toString(),
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.reorderPoint).toBeGreaterThan(0);
      expect(recommendation.safetyStock).toBeGreaterThan(0);
      expect(recommendation.status).toBe('RECOMMENDED');
    });

    it('should reject manual override when reason is insufficient', async () => {
      const recommendation = await ReplenishmentService.calculateReplenishment({
        productId: sampleProduct._id.toString(),
      });

      await expect(
        ReplenishmentService.overrideRecommendation(
          (recommendation._id as mongoose.Types.ObjectId).toString(),
          50,
          'bad',
          '000000000000000000000000'
        )
      ).rejects.toThrow('at least 5 characters');
    });

    it('should successfully apply manual override with audit reason', async () => {
      const recommendation = await ReplenishmentService.calculateReplenishment({
        productId: sampleProduct._id.toString(),
      });

      const updated = await ReplenishmentService.overrideRecommendation(
        (recommendation._id as mongoose.Types.ObjectId).toString(),
        100,
        'Valid override reason for promotional demand',
        '000000000000000000000000'
      );

      expect(updated.status).toBe('OVERRIDDEN');
      expect(updated.overrideQuantity).toBe(100);
      expect(updated.overrideReason).toBe('Valid override reason for promotional demand');
    });
  });

  describe('Inventory Optimization & Stockout Risk', () => {
    it('should scan and identify stockout risks across active catalog', async () => {
      const risks = await InventoryOptimizationService.scanStockoutRisks();
      expect(Array.isArray(risks)).toBe(true);
    });

    it('should identify overstock and dead stock items', async () => {
      const result = await InventoryOptimizationService.getOverstockAndDeadStock();
      expect(result).toHaveProperty('overstock');
      expect(result).toHaveProperty('deadStock');
    });
  });
});
