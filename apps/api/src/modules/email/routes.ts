import { Router } from 'express';
import { EmailController } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/status', EmailController.getProviderStatus);
router.post('/test', EmailController.sendTestEmail);
router.post('/trigger-expiry-check', EmailController.triggerExpiryCheck);

export default router;
