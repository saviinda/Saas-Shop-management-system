import { Router } from 'express';
import { AuditLogController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopOwnerOrAbove } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', isShopOwnerOrAbove, AuditLogController.listLogs);

export default router;
