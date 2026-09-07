import { Router } from 'express';
import { SupplierController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createSupplierSchema, updateSupplierSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, SupplierController.listSuppliers);
router.get('/:id', isShopStaff, SupplierController.getSupplier);
router.post('/', isShopOwnerOrAbove, validateBody(createSupplierSchema), SupplierController.createSupplier);
router.patch('/:id', isShopOwnerOrAbove, validateBody(updateSupplierSchema), SupplierController.updateSupplier);
router.delete('/:id', isShopOwnerOrAbove, SupplierController.deleteSupplier);

export default router;

