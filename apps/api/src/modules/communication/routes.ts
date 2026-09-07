import { Router } from 'express';
import { CommunicationController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopOwnerOrAbove, isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createTicketSchema, replyTicketSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, CommunicationController.listTickets);
router.get('/:id', isShopStaff, CommunicationController.getTicket);
router.post('/', isShopOwnerOrAbove, validateBody(createTicketSchema), CommunicationController.createTicket);
router.post('/:id/reply', isShopStaff, validateBody(replyTicketSchema), CommunicationController.replyTicket);

export default router;
