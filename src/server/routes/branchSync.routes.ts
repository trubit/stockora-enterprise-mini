import { Router } from 'express';
import { BranchSyncController } from '../controllers/branchSync.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/sync', authenticate, BranchSyncController.syncTransactions);
router.get('/status', authenticate, BranchSyncController.getSyncStatus);
router.post('/retry/:jobId', authenticate, BranchSyncController.retryFailedSync);
router.get('/lookup', authenticate, BranchSyncController.crossBranchLookup);

export { router as branchSyncRouter };
