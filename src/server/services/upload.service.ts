import sharp from 'sharp';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import crypto from 'crypto';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';
import { BASE_UPLOADS_DIR, getTenantUploadsDir, sanitizePathSegment } from '../storage/uploader.js';

export class UploadService {
  /**
   * Processes and optimizes an uploaded image file with Sharp.
   * Stores the file in the tenant-isolated directory and returns the client-accessible public URL.
   */
  public static async processAndSaveImage(
    file: Express.Multer.File,
    tenantId?: string
  ): Promise<string> {
    const safeTenantId = tenantId ? sanitizePathSegment(tenantId) : '';
    const targetDir = getTenantUploadsDir(safeTenantId || undefined);

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const outputFilename = `optimized-${uniqueSuffix}.webp`;
    const outputPath = join(targetDir, outputFilename);

    try {
      await sharp(file.path)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(outputPath);

      logger.info(`Image processed successfully: ${outputFilename}`);

      // If sharp wrote to a new file, remove the raw unoptimized original upload
      if (file.path !== outputPath && existsSync(file.path)) {
        try {
          unlinkSync(file.path);
        } catch {
          // Non-fatal
        }
      }

      const relativeUrlPath = safeTenantId
        ? `/uploads/${safeTenantId}/${outputFilename}`
        : `/uploads/${outputFilename}`;

      return relativeUrlPath;
    } catch (err: unknown) {
      logger.error('Failed to optimize image with sharp, using original file upload details:', err);
      const relativeUrlPath = safeTenantId
        ? `/uploads/${safeTenantId}/${file.filename}`
        : `/uploads/${file.filename}`;
      return relativeUrlPath;
    }
  }
}
