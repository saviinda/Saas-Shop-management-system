import { Router } from 'express';
import { TaskController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff, isShopOwnerOrAbove } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createTaskSchema, updateTaskStatusSchema, addTaskCommentSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, TaskController.listTasks);
router.get('/:id', isShopStaff, TaskController.getTask);
router.post('/', isShopOwnerOrAbove, validateBody(createTaskSchema), TaskController.createTask);
router.patch('/:id/status', isShopStaff, validateBody(updateTaskStatusSchema), TaskController.updateTaskStatus);
router.post('/:id/comments', isShopStaff, validateBody(addTaskCommentSchema), TaskController.addComment);
router.delete('/:id', isShopOwnerOrAbove, TaskController.deleteTask);

export default router;
