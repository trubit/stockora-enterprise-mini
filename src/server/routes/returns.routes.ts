import { Router } from 'express';
import { ReturnsController } from '../controllers/returns.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const returnsRouter = Router();

returnsRouter.use(authMiddleware);

// --- Warranties (must be declared before /:id to avoid param collision) ---
returnsRouter.get('/warranties', ReturnsController.listWarranties);
returnsRouter.post('/warranties', ReturnsController.registerWarranty);
returnsRouter.post('/warranties/:id/claims', ReturnsController.claimWarranty);

// --- Sales Returns & Exchanges ---
returnsRouter.get('/', ReturnsController.listReturns);
returnsRouter.post('/', ReturnsController.createReturn);
returnsRouter.get('/:id', ReturnsController.getReturn);
returnsRouter.patch('/:id/approve', ReturnsController.approveReturn);
