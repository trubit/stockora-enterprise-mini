import crypto from 'crypto';
import { ExportJob, type IExportJob, type ExportResourceType } from '../models/ExportJob.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { Transaction } from '../models/Transaction.js';
import { generateSafeCsv } from '../utils/csvSecurity.js';
import { NotFoundError } from '../errors/AppError.js';

export class ExportService {
  /**
   * Triggers an asynchronous export job with expiring download token.
   */
  public static async requestExport(
    tenantId: string,
    payload: {
      resourceType: ExportResourceType;
      format?: 'CSV' | 'JSON' | 'XLSX';
      filters?: Record<string, any>;
    },
    requestedBy: string
  ): Promise<IExportJob> {
    const downloadToken = `dl_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const job = await ExportJob.create({
      tenantId,
      resourceType: payload.resourceType,
      format: payload.format || 'CSV',
      status: 'PENDING',
      downloadToken,
      filters: payload.filters || {},
      expiresAt,
      requestedBy,
    });

    await IntegrationAuditLog.create({
      tenantId,
      action: 'EXPORT_REQUESTED',
      resourceId: job._id.toString(),
      details: { resourceType: payload.resourceType, format: job.format },
      performedBy: requestedBy,
    });

    // Execute generation asynchronously
    this.generateExportData(job).catch(() => {});

    return job;
  }

  /**
   * Generates the export dataset and produces safe sanitized CSV/JSON.
   */
  public static async generateExportData(job: IExportJob): Promise<void> {
    const currentJob = (await ExportJob.findById(job._id)) || job;
    if (currentJob.status === 'COMPLETED') {
      return;
    }

    try {
      currentJob.status = 'GENERATING';
      await currentJob.save();

      let records: any[] = [];
      let headers: string[] = [];

      switch (job.resourceType) {
        case 'products':
        case 'inventory': {
          const products = await Product.find().lean();
          records = products.map((p) => ({
            id: String(p._id),
            sku: p.sku,
            name: p.name,
            price: p.price,
            costPrice: p.costPrice || 0,
            quantity: p.quantity,
            category: p.category || '',
            lowStockAlert: p.lowStockAlert || 5,
            createdAt: p.createdAt?.toISOString() || '',
          }));
          headers = [
            'id',
            'sku',
            'name',
            'price',
            'costPrice',
            'quantity',
            'category',
            'lowStockAlert',
            'createdAt',
          ];
          break;
        }
        case 'customers': {
          const customers = await Customer.find().lean();
          records = customers.map((c) => ({
            id: String(c._id),
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            balance: c.balance || 0,
            loyaltyPoints: c.loyaltyPoints || 0,
            createdAt: c.createdAt?.toISOString() || '',
          }));
          headers = ['id', 'name', 'email', 'phone', 'balance', 'loyaltyPoints', 'createdAt'];
          break;
        }
        case 'suppliers': {
          const suppliers = await Supplier.find().lean();
          records = suppliers.map((s) => ({
            id: String(s._id),
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            taxNumber: s.taxNumber || '',
            address: s.address || '',
            createdAt: s.createdAt?.toISOString() || '',
          }));
          headers = ['id', 'name', 'email', 'phone', 'taxNumber', 'address', 'createdAt'];
          break;
        }
        case 'transactions':
        case 'orders': {
          const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(1000).lean();
          records = transactions.map((t) => ({
            id: t._id.toString(),
            transactionNumber: t.transactionNumber,
            total: t.total,
            tax: t.tax,
            discount: t.discount,
            paymentMethod: t.paymentMethod,
            cashierName: t.cashierName,
            status: t.status,
            createdAt: t.createdAt?.toISOString() || '',
          }));
          headers = [
            'id',
            'transactionNumber',
            'total',
            'tax',
            'discount',
            'paymentMethod',
            'cashierName',
            'status',
            'createdAt',
          ];
          break;
        }
        default:
          records = [];
          headers = ['id'];
      }

      job.recordCount = records.length;

      let fileContent = '';
      if (job.format === 'JSON') {
        fileContent = JSON.stringify(records, null, 2);
      } else {
        fileContent = generateSafeCsv(headers, records);
      }

      currentJob.recordCount = records.length;
      currentJob.fileSize = Buffer.byteLength(fileContent, 'utf8');
      currentJob.fileUrl = `/api/v1/integrations/exports/download/${currentJob.downloadToken}`;
      currentJob.status = 'COMPLETED';
      await currentJob.save();

      await IntegrationAuditLog.create({
        tenantId: currentJob.tenantId,
        action: 'EXPORT_COMPLETED',
        resourceId: currentJob._id.toString(),
        details: { recordCount: currentJob.recordCount, fileSize: currentJob.fileSize },
        performedBy: currentJob.requestedBy,
      });
    } catch (err: any) {
      currentJob.status = 'FAILED';
      currentJob.errorMessage = err.message;
      await currentJob.save().catch(() => {});
    }
  }

  /**
   * Retrieves export download content by download token with expiration verification.
   */
  public static async getExportDownload(
    downloadToken: string
  ): Promise<{ job: IExportJob; content: string; filename: string; contentType: string }> {
    const job = await ExportJob.findOne({ downloadToken });
    if (!job) {
      throw new NotFoundError('Export download link is invalid or expired.');
    }

    if (job.expiresAt < new Date()) {
      job.status = 'EXPIRED';
      await job.save();
      throw new NotFoundError('Export download file has expired.');
    }

    let records: any[] = [];
    let headers: string[] = [];

    switch (job.resourceType) {
      case 'products':
      case 'inventory': {
        const products = await Product.find().lean();
        records = products.map((p) => ({
          id: String(p._id),
          sku: p.sku,
          name: p.name,
          price: p.price,
          costPrice: p.costPrice || 0,
          quantity: p.quantity,
          category: p.category || '',
          lowStockAlert: p.lowStockAlert || 5,
        }));
        headers = [
          'id',
          'sku',
          'name',
          'price',
          'costPrice',
          'quantity',
          'category',
          'lowStockAlert',
        ];
        break;
      }
      case 'customers': {
        const customers = await Customer.find().lean();
        records = customers.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          balance: c.balance || 0,
        }));
        headers = ['id', 'name', 'email', 'phone', 'balance'];
        break;
      }
      default: {
        const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(1000).lean();
        records = transactions.map((t) => ({
          id: t._id.toString(),
          transactionNumber: t.transactionNumber,
          total: t.total,
          paymentMethod: t.paymentMethod,
        }));
        headers = ['id', 'transactionNumber', 'total', 'paymentMethod'];
      }
    }

    const filename = `stockora-${job.resourceType}-${Date.now()}.${job.format === 'JSON' ? 'json' : 'csv'}`;
    const contentType = job.format === 'JSON' ? 'application/json' : 'text/csv';
    const content =
      job.format === 'JSON' ? JSON.stringify(records, null, 2) : generateSafeCsv(headers, records);

    return { job, content, filename, contentType };
  }

  /**
   * Lists export history for a tenant.
   */
  public static async listExports(tenantId: string): Promise<IExportJob[]> {
    return ExportJob.find({ tenantId }).sort({ createdAt: -1 });
  }
}
