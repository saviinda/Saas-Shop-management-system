import { Router } from 'express';
import { ProductController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createProductSchema, updateProductSchema, createProductBatchSchema, updateProductBatchSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, ProductController.listProducts);
router.get('/:id', isShopStaff, ProductController.getProduct);
router.post('/', isShopStaff, validateBody(createProductSchema), ProductController.createProduct);
router.patch('/:id', isShopStaff, validateBody(updateProductSchema), ProductController.updateProduct);
router.delete('/:id', isShopStaff, ProductController.deleteProduct);

// Batch endpoints
router.get('/:id/batches', isShopStaff, ProductController.listBatches);
router.post('/:id/batches', isShopStaff, validateBody(createProductBatchSchema), ProductController.createBatch);
router.patch('/:id/batches/:batchId', isShopStaff, validateBody(updateProductBatchSchema), ProductController.updateBatch);
router.delete('/:id/batches/:batchId', isShopStaff, ProductController.deleteBatch);

export default router;
