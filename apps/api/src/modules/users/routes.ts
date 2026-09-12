import { Router } from 'express';
import { UserController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createStaffUserSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', UserController.listUsers);
router.post('/', isSuperAdmin, UserController.createUser);
router.get('/owners', isSuperAdmin, UserController.listShopOwners);
router.get('/:id/activity', isShopOwnerOrAbove, UserController.getUserActivity);
router.post('/staff', isShopOwnerOrAbove, validateBody(createStaffUserSchema), UserController.createStaffUser);
router.post('/:id/reset-access', isShopOwnerOrAbove, UserController.resetAccess);
router.patch('/:id', isShopOwnerOrAbove, UserController.updateUserStatus);
router.delete('/:id', isShopOwnerOrAbove, UserController.deleteStaffUser);

export default router;
