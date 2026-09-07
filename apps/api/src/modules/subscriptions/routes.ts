import { Router } from 'express';
import { SubscriptionController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/my', SubscriptionController.getMySubscription);
router.get('/', isSuperAdmin, SubscriptionController.listSubscriptions);
router.patch('/:id', isSuperAdmin, SubscriptionController.updateSubscription);
router.patch('/:id/status', isSuperAdmin, SubscriptionController.updateSubscriptionStatus);

export default router;
