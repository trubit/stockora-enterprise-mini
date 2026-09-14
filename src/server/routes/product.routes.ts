import { Router } from 'express';
import { ProductController } from '../controllers/product.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { requirePlanLimit } from '../middleware/billing.middleware.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const productRouter = Router();

productRouter.use(authMiddleware);

productRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProductController.getProducts
);
productRouter.get(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProductController.getProduct
);
productRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  requirePlanLimit('products'),
  ProductController.createProduct
);
productRouter.put(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProductController.updateProduct
);
productRouter.post(
  '/:id/stock',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProductController.restockProduct
);
productRouter.delete(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProductController.deleteProduct
);
