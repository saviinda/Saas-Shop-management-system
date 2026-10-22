import { Router } from 'express';
import { SettingsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin } from '../../middleware/rbac';

const router = Router();

// Public route for login and unauthenticated inquiries
router.get('/support', SettingsController.getPublicSupportSettings);

// Super Admin protected routes
router.get('/', authenticate, isSuperAdmin, SettingsController.getAdminSettings);
router.put('/', authenticate, isSuperAdmin, SettingsController.updateAdminSettings);
router.patch('/', authenticate, isSuperAdmin, SettingsController.updateAdminSettings);

export default router;
