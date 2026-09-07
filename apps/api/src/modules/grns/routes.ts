import { Router } from 'express';
import { GRNController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createGRNSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, GRNController.listGRNs);
router.get('/:id', isShopStaff, GRNController.getGRN);
router.post('/', isShopStaff, validateBody(createGRNSchema), GRNController.createGRN);

export default router;
