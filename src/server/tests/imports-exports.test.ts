import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { ImportService } from '../services/import.service.js';
import { ExportService } from '../services/export.service.js';
import { ImportJob } from '../models/ImportJob.js';
import { ExportJob } from '../models/ExportJob.js';
import { Product } from '../models/Product.js';

describe('Phase 45 — Import Wizard & Export Center Tests', () => {
  const tenantId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_import_export');
    }
    await ImportJob.deleteMany({});
    await ExportJob.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await ImportJob.deleteMany({});
    await ExportJob.deleteMany({});
    await Product.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('1. Import Wizard Lifecycle', () => {
    it('initializes, validates with preview breakdown, and ingests products', async () => {
      const rawRows = [
        { sku: 'IMPORT-SKU-001', name: 'Imported Widget A', price: '4500', quantity: '20' },
        { sku: 'IMPORT-SKU-002', name: 'Imported Widget B', price: '8500', quantity: '15' },
        { sku: '', name: 'Invalid No SKU Item', price: '1000', quantity: '5' }, // Invalid row
      ];

      // 1. Initialize
      const initJob = await ImportService.initializeImport(
        tenantId,
        {
          type: 'products',
          fileName: 'inventory_batch.csv',
          fileSize: 1024,
          format: 'CSV',
          rows: rawRows,
        },
        'admin@tenant.com'
      );

      expect(initJob.status).toBe('PENDING');
      expect(initJob.totalRows).toBe(3);

      // 2. Validate
      const validatedJob = await ImportService.validateImportJob(
        tenantId,
        initJob._id.toString(),
        { sku: 'sku', name: 'name', price: 'price', quantity: 'quantity' },
        rawRows
      );

      expect(validatedJob.validRows).toBe(2);
      expect(validatedJob.invalidRows).toBe(1);
      expect(validatedJob.errors.length).toBe(1);
      expect(validatedJob.errors[0].field).toBe('sku');

      // 3. Process
      const processedJob = await ImportService.processImport(
        tenantId,
        initJob._id.toString(),
        rawRows,
        'admin@tenant.com'
      );

      expect(processedJob.status).toBe('COMPLETED');
      expect(processedJob.resultSummary?.createdCount).toBe(2);

      const savedProduct = await Product.findOne({ sku: 'IMPORT-SKU-001' });
      expect(savedProduct).toBeDefined();
      expect(savedProduct?.price).toBe(4500);
    });
  });

  describe('2. Export Center Lifecycle & Token Expiry', () => {
    it('generates an asynchronous export and retrieves download with token', async () => {
      const exportJob = await ExportService.requestExport(
        tenantId,
        {
          resourceType: 'products',
          format: 'CSV',
        },
        'admin@tenant.com'
      );

      expect(exportJob.downloadToken).toBeDefined();

      // Wait a moment for generation
      await ExportService.generateExportData(exportJob);

      const downloadResult = await ExportService.getExportDownload(exportJob.downloadToken!);
      expect(downloadResult.contentType).toBe('text/csv');
      expect(downloadResult.content).toContain('IMPORT-SKU-001');
      expect(downloadResult.filename).toContain('stockora-products');
    });

    it('rejects expired export tokens', async () => {
      const expiredJob = await ExportJob.create({
        tenantId,
        resourceType: 'products',
        format: 'CSV',
        status: 'COMPLETED',
        downloadToken: 'dl_expired_test_token',
        expiresAt: new Date(Date.now() - 10000), // In the past
        requestedBy: 'admin@tenant.com',
      });

      await expect(ExportService.getExportDownload(expiredJob.downloadToken!)).rejects.toThrow(
        'Export download file has expired.'
      );
    });
  });
});
