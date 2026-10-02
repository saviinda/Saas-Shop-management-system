import { Router } from 'express';
import { ServiceCategoryController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createServiceCategorySchema, updateServiceCategorySchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, ServiceCategoryController.listServiceCategories);
router.get('/:id', isShopStaff, ServiceCategoryController.getServiceCategory);
router.post('/', isShopOwnerOrAbove, validateBody(createServiceCategorySchema), ServiceCategoryController.createServiceCategory);
router.put('/:id', isShopOwnerOrAbove, validateBody(updateServiceCategorySchema), ServiceCategoryController.updateServiceCategory);
router.patch('/:id', isShopOwnerOrAbove, validateBody(updateServiceCategorySchema), ServiceCategoryController.updateServiceCategory);
router.delete('/:id', isShopOwnerOrAbove, ServiceCategoryController.deleteServiceCategory);

export default router;
