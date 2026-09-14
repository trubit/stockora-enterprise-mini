import { Router } from 'express';
import { OrderManagementController } from '../controllers/order-management.controller.js';
import { authenticate } from '../middleware/auth.js';

export const orderManagementRouter = Router();

orderManagementRouter.use(authenticate);

orderManagementRouter.post('/', OrderManagementController.createOrder);
orderManagementRouter.get('/', OrderManagementController.getOrders);
orderManagementRouter.get('/:orderNumber', OrderManagementController.getOrderByNumber);
orderManagementRouter.patch('/:orderNumber/status', OrderManagementController.updateStatus);
orderManagementRouter.post('/:orderNumber/return', OrderManagementController.processReturn);
orderManagementRouter.get('/:orderNumber/timeline', OrderManagementController.getTimeline);
orderManagementRouter.post('/:orderNumber/picking', OrderManagementController.createPickingTask);
orderManagementRouter.post(
  '/fulfillment/pickup-verify',
  OrderManagementController.verifyStorePickup
);
