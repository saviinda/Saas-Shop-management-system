import { Router } from 'express';
import { NotificationController } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', NotificationController.listNotifications);
router.patch('/:id/read', NotificationController.markAsRead);

export default router;
