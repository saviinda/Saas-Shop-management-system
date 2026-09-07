import { Router } from 'express';
import { BranchController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createBranchSchema, updateBranchSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', BranchController.listBranches);
router.post('/', isShopOwnerOrAbove, validateBody(createBranchSchema), BranchController.createBranch);
router.patch('/:id', isShopOwnerOrAbove, validateBody(updateBranchSchema), BranchController.updateBranch);
router.patch('/:id/status', isShopOwnerOrAbove, BranchController.updateBranchStatus);
router.delete('/:id', isShopOwnerOrAbove, BranchController.deleteBranch);

export default router;
