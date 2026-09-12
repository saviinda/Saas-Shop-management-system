import { Router } from 'express';
import { RoleController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isSuperAdmin } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', RoleController.listRoles);
router.get('/:id', RoleController.getRole);
router.post('/', isSuperAdmin, RoleController.createRole);
router.patch('/:id', isSuperAdmin, RoleController.updateRole);
router.put('/:id', isSuperAdmin, RoleController.updateRole);
router.delete('/:id', isSuperAdmin, RoleController.deleteRole);

export default router;
