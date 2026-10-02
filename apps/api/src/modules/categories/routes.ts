import { Router } from 'express';
import { CategoryController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, CategoryController.listCategories);
router.get('/:id', isShopStaff, CategoryController.getCategory);
router.post('/', isShopStaff, validateBody(createCategorySchema), CategoryController.createCategory);
router.patch('/:id', isShopStaff, validateBody(updateCategorySchema), CategoryController.updateCategory);
router.delete('/:id', isShopStaff, CategoryController.deleteCategory);

export default router;
