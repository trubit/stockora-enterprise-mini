import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { fileUploader } from '../storage/uploader.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/profile', UserController.getProfile);
userRouter.put('/profile', UserController.updateProfile);
userRouter.post('/profile/avatar', fileUploader.single('avatar'), UserController.uploadAvatar);

userRouter.get('/', rbacMiddleware([SYSTEM_PERMISSIONS.USERS_READ]), UserController.listUsers);
