import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const transferRouter = Router();

transferRouter.use(authMiddleware);

transferRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  TransferController.listTransfers
);
transferRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  TransferController.createTransfer
);
transferRouter.put(
  '/:id/status',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  TransferController.updateTransferStatus
);
