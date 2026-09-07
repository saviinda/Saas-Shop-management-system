import { Router } from 'express';
import { OrderController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createOrderSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, OrderController.listOrders);
router.get('/:id', isShopStaff, OrderController.getOrder);
router.post('/', isShopStaff, validateBody(createOrderSchema), OrderController.createOrder);
router.patch('/:id/status', isShopStaff, OrderController.updateOrderStatus);

export default router;
