import { Router } from 'express';
import { PurchaseOrderController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createPOSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, PurchaseOrderController.listPOs);
router.get('/:id', isShopStaff, PurchaseOrderController.getPO);
router.post('/', isShopStaff, validateBody(createPOSchema), PurchaseOrderController.createPO);
router.patch('/:id/status', isShopStaff, PurchaseOrderController.updatePOStatus);

export default router;
