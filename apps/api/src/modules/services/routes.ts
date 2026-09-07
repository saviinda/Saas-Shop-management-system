import { Router } from 'express';
import { ServiceController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createServiceSchema, updateServiceSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, ServiceController.listServices);
router.post('/', isShopStaff, validateBody(createServiceSchema), ServiceController.createService);
router.patch('/:id', isShopStaff, validateBody(updateServiceSchema), ServiceController.updateService);
router.delete('/:id', isShopStaff, ServiceController.deleteService);

export default router;
