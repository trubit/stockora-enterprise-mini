import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ExportService } from '../services/export.service.js';
import { AuthorizationError } from '../errors/AppError.js';

export class ExportController {
  /**
   * POST /api/v1/integrations/exports/request
   * Requests an asynchronous export for a dataset.
   */
  public static async requestExport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { resourceType, format, filters } = req.body;
      const requestedBy = req.user?.email || req.user?.username || 'Unknown User';

      const job = await ExportService.requestExport(
        tenantId,
        { resourceType, format, filters },
        requestedBy
      );

      res.status(202).json({
        success: true,
        message: 'Export generation requested. Download token will be ready momentarily.',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/exports
   * Lists export history and status for the tenant.
   */
  public static async listExports(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const jobs = await ExportService.listExports(tenantId);
      res.json({ success: true, data: jobs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/exports/download/:downloadToken
   * Downloads the generated export file using a secure, expiring token.
   */
  public static async downloadExport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { downloadToken } = req.params;
      const { content, filename, contentType } = await ExportService.getExportDownload(
        String(downloadToken)
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (err) {
      next(err);
    }
  }
}
