import { Router } from 'express';
import { ShopController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { updateShopSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', ShopController.listShops);
router.get('/:id', ShopController.getShop);
router.post('/', isSuperAdmin, ShopController.createShop);
router.patch('/:id', isSuperAdmin, ShopController.updateShopAdmin);
router.patch('/:id/status', isSuperAdmin, ShopController.updateShopStatus);
router.post('/:id/approve', isSuperAdmin, ShopController.approveShopRegistration);
router.patch('/:id/profile', isShopOwnerOrAbove, validateBody(updateShopSchema), ShopController.updateShopProfile);
router.delete('/:id', isSuperAdmin, ShopController.deleteShop);

export default router;
