import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);

// Verification Service & OTP Routes
authRouter.post('/verify-email', AuthController.verifyEmail);
authRouter.post('/resend-verification-otp', AuthController.resendVerificationOtp);
authRouter.post('/forgot-password', AuthController.forgotPassword);
authRouter.post('/verify-reset-otp', AuthController.verifyResetOtp);
authRouter.post('/reset-password', AuthController.resetPassword);

// Protected auth routes (require valid JWT)
authRouter.post('/change-password', authMiddleware, AuthController.changePassword);
authRouter.post('/logout', optionalAuth, AuthController.logout);
authRouter.get('/me', authMiddleware, AuthController.me);
