import { Router } from 'express';
import { PaymentController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import {
  createPaymentRequestSchema,
  reviewPaymentSchema,
  restrictShopPaymentSchema,
} from '@saas/validation';

const router = Router();

// Public / Gateway Webhook Endpoint (Protected by HMAC Signature Verification)
router.post('/webhook', PaymentController.handleWebhook);

// Authenticated Routes
router.use(authenticate);

router.get('/', PaymentController.listPayments);
router.get('/report', isSuperAdmin, PaymentController.generatePaymentReport);
router.get('/:id', PaymentController.getPayment);
router.post('/request', isShopOwnerOrAbove, validateBody(createPaymentRequestSchema), PaymentController.createPaymentRequest);
router.patch('/:id/review', isSuperAdmin, validateBody(reviewPaymentSchema), PaymentController.reviewPayment);
router.patch('/shops/:shopId/restrict', isSuperAdmin, validateBody(restrictShopPaymentSchema), PaymentController.restrictShopPaymentAccess);

export default router;
