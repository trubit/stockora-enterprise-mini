import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ResiliencyRegistry } from '../utils/resiliency/index.js';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError } from '../errors/AppError.js';

export const resiliencyRouter = Router();

// Secure all resiliency operations to authenticated requests
resiliencyRouter.use(authMiddleware);

// GET /api/v1/resiliency/metrics
resiliencyRouter.get(
  '/metrics',
  (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const registry = ResiliencyRegistry.getInstance();
      res.json(registry.getMetricsList());
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/resiliency/reset
resiliencyRouter.post('/reset', (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const registry = ResiliencyRegistry.getInstance();
    registry.resetAll();
    res.json({ success: true, message: 'All resilience metrics and circuit breakers reset.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/resiliency/breaker/:name/reset
resiliencyRouter.post(
  '/breaker/:name/reset',
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const name = String(req.params.name);
    try {
      const registry = ResiliencyRegistry.getInstance();
      const breaker = registry.getBreaker(name);
      if (!breaker) {
        return next(new NotFoundError(`Circuit breaker [${name}] not found.`));
      }
      breaker.forceReset();
      res.json({
        success: true,
        message: `Circuit breaker [${name}] forced back to CLOSED state.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/resiliency/breaker/:name/open
resiliencyRouter.post(
  '/breaker/:name/open',
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const name = String(req.params.name);
    try {
      const registry = ResiliencyRegistry.getInstance();
      const breaker = registry.getBreaker(name);
      if (!breaker) {
        return next(new NotFoundError(`Circuit breaker [${name}] not found.`));
      }
      breaker.forceOpen();
      res.json({ success: true, message: `Circuit breaker [${name}] forced to OPEN state.` });
    } catch (err) {
      next(err);
    }
  }
);
