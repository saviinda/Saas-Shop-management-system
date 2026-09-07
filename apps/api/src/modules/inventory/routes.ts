import { Router } from 'express';
import { InventoryController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { stockAdjustmentSchema, stockTransferSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, InventoryController.listInventory);
router.get('/movements', isShopStaff, InventoryController.listStockMovements);
router.post('/adjust', isShopStaff, validateBody(stockAdjustmentSchema), InventoryController.adjustStock);
router.post('/transfer', isShopStaff, validateBody(stockTransferSchema), InventoryController.transferStock);
router.post('/:id/adjust', isShopStaff, InventoryController.adjustStockById);

export default router;
