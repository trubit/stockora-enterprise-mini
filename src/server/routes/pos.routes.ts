import { Router } from 'express';
import { POSController } from '../controllers/pos.controller.js';
import { authenticate } from '../middleware/auth.js';

export const posRouter = Router();

posRouter.use(authenticate);

posRouter.post('/checkout', POSController.checkout);
posRouter.post('/hold', POSController.holdSale);
posRouter.post('/resume/:holdId', POSController.resumeSale);
posRouter.get('/held/:branchId', POSController.getHeldSales);
posRouter.get('/receipt/:orderNumber', POSController.getReceipt);
posRouter.post('/sync-offline', POSController.syncOffline);

// Register Session endpoints
posRouter.post('/register/open', POSController.openRegister);
posRouter.post('/register/cash-movement', POSController.cashMovement);
posRouter.post('/register/close', POSController.closeRegister);
posRouter.get('/register/shift-summary', POSController.getShiftSummary);
posRouter.get('/register/active/:registerId', POSController.getActiveRegister);
