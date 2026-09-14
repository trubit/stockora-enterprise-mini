import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { config } from '../../config/environment.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { Transaction } from '../models/Transaction.js';
import { ERPSyncService } from '../services/integration/erpSync.service.js';
import { verifyPaystackSignature } from '../utils/paystack.js';
import crypto from 'crypto';

describe('Phases 19 - 22 Enterprise Capabilities', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodbUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Phase 19: Multi-Currency & Localized Tax Compliance', () => {
    it('should save and retrieve active exchange rates', async () => {
      await ExchangeRate.deleteMany({});
      const rate = await ExchangeRate.create({
        code: 'EUR',
        symbol: '€',
        rate: 0.92,
        isActive: true,
      });

      expect(rate.code).toBe('EUR');
      expect(rate.rate).toBe(0.92);

      const found = await ExchangeRate.findOne({ code: 'EUR' });
      expect(found).toBeDefined();
      expect(found?.symbol).toBe('€');
    });

    it('should apply and modify system localized tax settings', async () => {
      let sysConfig = await SystemConfig.findOne();
      if (!sysConfig) {
        sysConfig = new SystemConfig();
      }
      sysConfig.taxRate = 12.5;
      sysConfig.taxType = 'VAT';
      await sysConfig.save();

      const updated = await SystemConfig.findOne();
      expect(updated?.taxRate).toBe(12.5);
      expect(updated?.taxType).toBe('VAT');
    });
  });

  describe('Phase 21: ERP Double-Entry Ledger mapping', () => {
    it('should construct double-entry journal credits and debits from transaction details', async () => {
      await Transaction.deleteMany({});
      const tx = await Transaction.create({
        transactionNumber: 'TX-ERP-99',
        type: 'SALE',
        status: 'COMPLETED',
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            productName: 'Gaming Laptop Pro',
            sku: 'LT-PRO-99',
            quantity: 1,
            price: 1000,
            discount: 0,
            total: 1000,
          },
        ],
        subtotal: 1000,
        tax: 80,
        discount: 0,
        total: 1080,
        paymentMethod: 'CASH',
        cashierId: 'cashier-99',
        cashierName: 'Agent Cooper',
        branchId: 'branch-99',
        branchName: 'Sheriff Office Branch',
      });

      const journal = await ERPSyncService.buildJournalEntry(tx._id.toString());
      expect(journal.reference).toBe('TX-ERP-99');
      expect(journal.lines.length).toBe(3);

      const debitLine = journal.lines.find((l) => l.type === 'DEBIT');
      const creditRevenueLine = journal.lines.find((l) => l.accountCode === '4000-REVENUE');
      const creditTaxLine = journal.lines.find((l) => l.accountCode === '2200-TAX-LIABILITY');

      expect(debitLine?.amount).toBe(1080);
      expect(debitLine?.accountCode).toBe('1000-CASH');

      expect(creditRevenueLine?.amount).toBe(1000);
      expect(creditRevenueLine?.type).toBe('CREDIT');

      expect(creditTaxLine?.amount).toBe(80);
      expect(creditTaxLine?.type).toBe('CREDIT');
    });
  });

  describe('Phase 23: Paystack Webhook verification', () => {
    it('should verify signature successfully using HMAC SHA512 math', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'TX-101' } });
      const secret = 'test-secret-key';
      const validSignature = crypto.createHmac('sha512', secret).update(payload).digest('hex');

      const isValid = verifyPaystackSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);

      const isInvalid = verifyPaystackSignature(payload, 'wrong-signature', secret);
      expect(isInvalid).toBe(false);
    });
  });
});
