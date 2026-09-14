import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { geminiService } from '../services/ai/gemini/gemini.service.js';
import { validateGeminiModel } from '../services/ai/gemini/gemini.config.js';
import { ForecastingEngine } from '../services/ai/forecasting.js';
import mongoose from 'mongoose';
import { config } from '../../config/environment.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';

describe('Phase 18 AI Business Intelligence & Forecasting', () => {
  beforeAll(async () => {
    // Connect to test database pool
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodbUri);
    }
  });

  afterAll(async () => {
    // Clean up connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Gemini Model & Service Validation', () => {
    it('validates supported Gemini production models', () => {
      expect(validateGeminiModel('gemini-1.5-flash')).toBe('gemini-1.5-flash');
      expect(validateGeminiModel('gemini-1.5-pro')).toBe('gemini-1.5-pro');
      expect(validateGeminiModel('gemini-2.0-flash')).toBe('gemini-2.0-flash');
      expect(() => validateGeminiModel('gpt-fake-model-xyz')).toThrow();
    });

    it('identifies Gemini configuration status accurately', () => {
      const isConfigured = geminiService.isConfigured();
      expect(typeof isConfigured).toBe('boolean');
      expect(geminiService.getModelName()).toBeDefined();
    });
  });

  describe('BI Forecasting Engine Data Analyzer', () => {
    it('should compile structured metrics matching inventory databases', async () => {
      // Clean up pre-existing seed data first
      await Product.deleteOne({ sku: 'AI-TEST-99' });
      await Transaction.deleteOne({ transactionNumber: 'TX-AI-TEST-999' });

      // Seed temporary product/transaction for verification
      const testTenant = 'tenant_forecast_test';
      const p = await Product.create({
        tenantId: testTenant,
        name: 'AI Test Unit Scanner',
        sku: 'AI-TEST-99',
        price: 150,
        cost: 60,
        sellingPrice: 150,
        costPrice: 60,
        quantity: 1,
        lowStockAlert: 5,
        category: 'Electronics',
        currency: 'USD',
        isActive: true,
      });

      const t = await Transaction.create({
        tenantId: testTenant,
        transactionNumber: 'TX-AI-TEST-999',
        type: 'SALE',
        status: 'COMPLETED',
        cashierId: new mongoose.Types.ObjectId().toString(),
        branchId: new mongoose.Types.ObjectId().toString(),
        items: [
          {
            productId: p._id,
            productName: 'AI Test Unit Scanner',
            sku: 'AI-TEST-99',
            quantity: 2,
            price: 150,
            discount: 0,
            total: 300,
          },
        ],
        subtotal: 300,
        tax: 24,
        discount: 0,
        total: 324,
        paymentMethod: 'CASH',
        cashierName: 'System Test',
        branchName: 'Toronto HQ',
      });

      const stats = await ForecastingEngine.generateReport(testTenant);
      expect(stats.totalSalesRevenue).toBeGreaterThan(0);
      expect(stats.reorderProposals.some((item) => item.name === 'AI Test Unit Scanner')).toBe(
        true
      );

      // Clean up seed data
      await Product.deleteOne({ _id: p._id });
      await Transaction.deleteOne({ _id: t._id });
    });
  });
});
