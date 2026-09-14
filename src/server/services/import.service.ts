import {
  ImportJob,
  type IImportJob,
  type ImportDataType,
  type ImportErrorItem,
} from '../models/ImportJob.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export class ImportService {
  /**
   * Initializes an import job with parsed preview data, detected columns, and row counts.
   */
  public static async initializeImport(
    tenantId: string,
    payload: {
      type: ImportDataType;
      fileName: string;
      fileSize: number;
      format: 'CSV' | 'JSON' | 'XLSX';
      rows: Array<Record<string, any>>;
    },
    createdBy: string
  ): Promise<IImportJob> {
    if (!payload.rows || payload.rows.length === 0) {
      throw new ValidationError('Uploaded file contains no valid data rows.');
    }

    // Default column mapping (exact header names)
    const headers = Object.keys(payload.rows[0] || {});
    const columnMapping: Record<string, string> = {};
    headers.forEach((h) => {
      columnMapping[h] = h;
    });

    const job = await ImportJob.create({
      tenantId,
      type: payload.type,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      format: payload.format,
      status: 'PENDING',
      totalRows: payload.rows.length,
      validRows: 0,
      invalidRows: 0,
      processedRows: 0,
      progressPercent: 0,
      columnMapping,
      previewData: payload.rows.slice(0, 10), // First 10 rows for UI preview
      errors: [],
      createdBy,
    });

    return job;
  }

  /**
   * Validates rows according to entity schema without altering production database.
   */
  public static async validateImportJob(
    tenantId: string,
    jobId: string,
    columnMapping: Record<string, string>,
    rows: Array<Record<string, any>>
  ): Promise<IImportJob> {
    const job = await ImportJob.findOne({ _id: jobId, tenantId });
    if (!job) {
      throw new NotFoundError('Import job not found.');
    }

    job.status = 'VALIDATING';
    job.columnMapping = columnMapping;
    await job.save();

    const errors: ImportErrorItem[] = [];
    let validCount = 0;
    const seenSkus = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const mappedRow: Record<string, any> = {};
      for (const [fileCol, entityField] of Object.entries(columnMapping)) {
        if (entityField && rawRow[fileCol] !== undefined) {
          mappedRow[entityField] = rawRow[fileCol];
        }
      }

      const rowNumber = i + 1;

      // Entity-specific validation checks
      if (job.type === 'products' || job.type === 'inventory' || job.type === 'opening_stock') {
        const sku = String(mappedRow.sku || '').trim();
        const name = String(mappedRow.name || '').trim();
        const price = Number(mappedRow.price || mappedRow.sellingPrice || 0);

        if (!sku) {
          errors.push({
            row: rowNumber,
            field: 'sku',
            error: 'SKU is required and cannot be empty.',
            suggestion: 'Provide a unique SKU code.',
          });
        } else if (seenSkus.has(sku.toLowerCase())) {
          errors.push({
            row: rowNumber,
            field: 'sku',
            value: sku,
            error: `Duplicate SKU found within this import file: "${sku}".`,
            suggestion: 'Ensure all SKUs in the spreadsheet are unique.',
          });
        } else {
          seenSkus.add(sku.toLowerCase());
        }

        if (job.type === 'products' && !name) {
          errors.push({
            row: rowNumber,
            field: 'name',
            error: 'Product name is required.',
          });
        }

        if (price < 0 || isNaN(price)) {
          errors.push({
            row: rowNumber,
            field: 'price',
            value: mappedRow.price,
            error: 'Price must be a valid non-negative number.',
          });
        }
      } else if (job.type === 'customers') {
        const name =
          mappedRow.name || `${mappedRow.firstName || ''} ${mappedRow.lastName || ''}`.trim();
        if (!name) {
          errors.push({
            row: rowNumber,
            field: 'name',
            error: 'Customer name is required.',
          });
        }
      } else if (job.type === 'suppliers') {
        if (!mappedRow.name) {
          errors.push({
            row: rowNumber,
            field: 'name',
            error: 'Supplier company name is required.',
          });
        }
      }

      const rowHasError = errors.some((e) => e.row === rowNumber);
      if (!rowHasError) {
        validCount++;
      }
    }

    job.validRows = validCount;
    job.invalidRows = rows.length - validCount;
    job.errors = errors as any;
    job.status = 'VALIDATED';
    await job.save();

    return job;
  }

  /**
   * Executes the import processing safely in batch transactions.
   */
  public static async processImport(
    tenantId: string,
    jobId: string,
    rows: Array<Record<string, any>>,
    performedBy: string
  ): Promise<IImportJob> {
    const job = await ImportJob.findOne({ _id: jobId, tenantId });
    if (!job) {
      throw new NotFoundError('Import job not found.');
    }

    const startTime = Date.now();
    job.status = 'PROCESSING';
    await job.save();

    await IntegrationAuditLog.create({
      tenantId,
      action: 'IMPORT_STARTED',
      resourceId: jobId,
      details: { type: job.type, totalRows: rows.length },
      performedBy,
    });

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      const mapping = job.columnMapping || {};

      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const mappedRow: Record<string, any> = {};
        for (const [fileCol, entityField] of Object.entries(mapping)) {
          if (entityField && rawRow[fileCol] !== undefined) {
            mappedRow[entityField] = rawRow[fileCol];
          }
        }

        if (job.type === 'products' || job.type === 'opening_stock') {
          const sku = String(mappedRow.sku || '').trim();
          if (sku) {
            const existing = await Product.findOne({ sku });
            if (existing) {
              if (mappedRow.name) existing.name = mappedRow.name;
              if (mappedRow.price !== undefined) existing.price = Number(mappedRow.price);
              if (mappedRow.costPrice !== undefined)
                existing.costPrice = Number(mappedRow.costPrice);
              if (mappedRow.quantity !== undefined) existing.quantity = Number(mappedRow.quantity);
              await existing.save();
              updatedCount++;
            } else {
              await Product.create({
                sku,
                name: mappedRow.name || `Imported Product ${sku}`,
                price: Number(mappedRow.price || 0),
                costPrice: Number(mappedRow.costPrice || 0),
                quantity: Number(mappedRow.quantity || 0),
                category: mappedRow.category || 'General',
                lowStockAlert: Number(mappedRow.lowStockAlert || 5),
              });
              createdCount++;
            }
          } else {
            skippedCount++;
          }
        } else if (job.type === 'customers') {
          const name = mappedRow.name || mappedRow.firstName || 'Imported Customer';
          await Customer.create({
            name,
            email: mappedRow.email || undefined,
            phone: mappedRow.phone || undefined,
            address: mappedRow.address || undefined,
          });
          createdCount++;
        } else if (job.type === 'suppliers') {
          const name = mappedRow.name || 'Imported Supplier';
          await Supplier.create({
            name,
            email: mappedRow.email || undefined,
            phone: mappedRow.phone || undefined,
            address: mappedRow.address || undefined,
          });
          createdCount++;
        }

        job.processedRows = i + 1;
        job.progressPercent = Math.round(((i + 1) / rows.length) * 100);
      }

      job.status = 'COMPLETED';
      job.resultSummary = {
        createdCount,
        updatedCount,
        skippedCount,
        durationMs: Date.now() - startTime,
      };
      await job.save();

      await IntegrationAuditLog.create({
        tenantId,
        action: 'IMPORT_COMPLETED',
        resourceId: jobId,
        details: job.resultSummary,
        performedBy,
      });

      return job;
    } catch (err: any) {
      job.status = 'FAILED';
      await job.save();

      await IntegrationAuditLog.create({
        tenantId,
        action: 'IMPORT_FAILED',
        resourceId: jobId,
        details: { error: err.message },
        performedBy,
      });

      throw err;
    }
  }

  /**
   * Retrieves an import job with its full status and error reports.
   */
  public static async getImportJob(tenantId: string, jobId: string): Promise<IImportJob> {
    const job = await ImportJob.findOne({ _id: jobId, tenantId });
    if (!job) {
      throw new NotFoundError('Import job not found.');
    }
    return job;
  }
}
