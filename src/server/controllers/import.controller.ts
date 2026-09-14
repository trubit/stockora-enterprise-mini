import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ImportService } from '../services/import.service.js';
import { AuthorizationError, ValidationError } from '../errors/AppError.js';

export class ImportController {
  /**
   * POST /api/v1/integrations/imports/initialize
   * Receives uploaded dataset, stores job record, and provides preview rows.
   */
  public static async initializeImport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { type, fileName, fileSize, format, rows } = req.body;
      const createdBy = req.user?.email || req.user?.username || 'Unknown User';

      const job = await ImportService.initializeImport(
        tenantId,
        { type, fileName, fileSize: fileSize || 0, format: format || 'CSV', rows },
        createdBy
      );

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/imports/:jobId/validate
   * Validates dataset against column mappings and returns validation preview.
   */
  public static async validateImport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { jobId } = req.params;
      const { columnMapping, rows } = req.body;

      if (!columnMapping || !rows) {
        return next(
          new ValidationError('Column mapping and data rows are required for validation.')
        );
      }

      const validatedJob = await ImportService.validateImportJob(
        tenantId,
        String(jobId),
        columnMapping,
        rows
      );
      res.json({ success: true, data: validatedJob });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/imports/:jobId/process
   * Confirms and applies import to master records.
   */
  public static async processImport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { jobId } = req.params;
      const { rows } = req.body;
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      const completedJob = await ImportService.processImport(
        tenantId,
        String(jobId),
        rows,
        performedBy
      );
      res.json({ success: true, data: completedJob });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/imports/:jobId
   * Retrieves import job status, progress, and errors.
   */
  public static async getImportJob(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { jobId } = req.params;
      const job = await ImportService.getImportJob(tenantId, String(jobId));
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
}
