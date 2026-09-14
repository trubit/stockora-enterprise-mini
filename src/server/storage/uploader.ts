import multer from 'multer';
import { resolve, join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import { ValidationError } from '../errors/AppError.js';
import { config } from '../../config/environment.js';

export const BASE_UPLOADS_DIR = resolve(process.cwd(), config.uploadDir || 'uploads');

if (!existsSync(BASE_UPLOADS_DIR)) {
  mkdirSync(BASE_UPLOADS_DIR, { recursive: true });
}

/**
 * Sanitizes a path segment to allow only safe alphanumeric characters and hyphens/underscores.
 * Strictly prevents path traversal attacks like '../' or directory injection.
 */
export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Resolves a safe tenant-scoped upload directory inside the runtime uploads root.
 */
export function getTenantUploadsDir(tenantId?: string): string {
  if (!tenantId) {
    return BASE_UPLOADS_DIR;
  }
  const safeTenantId = sanitizePathSegment(tenantId);
  const targetDir = resolve(BASE_UPLOADS_DIR, safeTenantId);

  // Strict path traversal defense: verify targetDir starts with BASE_UPLOADS_DIR
  if (!targetDir.startsWith(BASE_UPLOADS_DIR)) {
    throw new ValidationError('Invalid upload storage destination path.');
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

const storage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const targetDir = getTenantUploadsDir(tenantId ? String(tenantId) : undefined);
      cb(null, targetDir);
    } catch (err: any) {
      cb(err, BASE_UPLOADS_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const rawExt = extname(file.originalname).toLowerCase().slice(1);
    const safeExt = sanitizePathSegment(rawExt) || 'bin';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const safeField = sanitizePathSegment(file.fieldname) || 'upload';
    cb(null, `${safeField}-${uniqueSuffix}.${safeExt}`);
  },
});

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        'Unallowed file format. Only JPEG, PNG, WEBP, GIF, SVG, and PDF are accepted.'
      )
    );
  }
};

export const fileUploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploadMaxSize,
  },
});
