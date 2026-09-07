import { Router } from 'express';
import { ProductController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createProductSchema, updateProductSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, ProductController.listProducts);
router.get('/:id', isShopStaff, ProductController.getProduct);
router.post('/', isShopStaff, validateBody(createProductSchema), ProductController.createProduct);
router.patch('/:id', isShopStaff, validateBody(updateProductSchema), ProductController.updateProduct);
router.delete('/:id', isShopStaff, ProductController.deleteProduct);

export default router;
