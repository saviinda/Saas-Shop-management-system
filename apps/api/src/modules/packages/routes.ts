import { Router } from 'express';
import { PackageController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createPackageSchema } from '@saas/validation';

const router = Router();

router.get('/', PackageController.listPackages);
router.get('/:id', PackageController.getPackage);
router.post('/', authenticate, isSuperAdmin, validateBody(createPackageSchema), PackageController.createPackage);
router.patch('/:id', authenticate, isSuperAdmin, PackageController.updatePackage);
router.delete('/:id', authenticate, isSuperAdmin, PackageController.deletePackage);

export default router;
