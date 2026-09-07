import { Router } from 'express';
import { AuthController } from './controller';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  loginSchema,
  registerShopOwnerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@saas/validation';

const router = Router();

router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/register', validateBody(registerShopOwnerSchema), AuthController.registerShopOwner);
router.post('/logout', authenticate, AuthController.logout);
router.post('/forgot-password', validateBody(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), AuthController.resetPassword);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), AuthController.changePassword);
router.get('/me', authenticate, AuthController.getMe);

export default router;
