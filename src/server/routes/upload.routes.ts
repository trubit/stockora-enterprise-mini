import { Router } from 'express';
import { fileUploader } from '../storage/uploader.js';
import { UploadService } from '../services/upload.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { ValidationError } from '../errors/AppError.js';

export const uploadRouter = Router();

uploadRouter.use(authMiddleware);

uploadRouter.post('/image', fileUploader.single('file'), async (req: any, res, next) => {
  if (!req.file) {
    return next(new ValidationError('Please upload an image file.'));
  }
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const url = await UploadService.processAndSaveImage(
      req.file,
      tenantId ? String(tenantId) : undefined
    );
    res.json({ url });
  } catch (err: unknown) {
    next(err);
  }
});
