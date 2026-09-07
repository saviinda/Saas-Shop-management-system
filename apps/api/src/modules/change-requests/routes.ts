import { Router } from 'express';
import { ChangeRequestController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createChangeRequestSchema, reviewChangeRequestSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', ChangeRequestController.listRequests);
router.post('/', isShopOwnerOrAbove, validateBody(createChangeRequestSchema), ChangeRequestController.createRequest);
router.patch('/:id/review', isSuperAdmin, validateBody(reviewChangeRequestSchema), ChangeRequestController.reviewRequest);

export default router;
