import { Router } from 'express';
import { ReportController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin, isShopStaff } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/super-admin', isSuperAdmin, ReportController.getSuperAdminDashboard);
router.get('/shop-owner', isShopStaff, ReportController.getShopOwnerDashboard);
router.get('/shop', isShopStaff, ReportController.getShopReports);

export default router;
