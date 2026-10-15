import { Router } from 'express';
import { InventoryController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { stockAdjustmentSchema, stockTransferSchema, createTransferRequestSchema, receiveTransferSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, InventoryController.listInventory);
router.get('/movements', isShopStaff, InventoryController.listStockMovements);
router.post('/adjust', isShopStaff, validateBody(stockAdjustmentSchema), InventoryController.adjustStock);
router.post('/transfer', isShopStaff, validateBody(stockTransferSchema), InventoryController.transferStock);
router.post('/:id/adjust', isShopStaff, InventoryController.adjustStockById);

// Stock Transfer Requests Endpoints
router.get('/transfers', isShopStaff, InventoryController.listTransferRequests);
router.get('/transfers/:id', isShopStaff, InventoryController.getTransferRequest);
router.post('/transfers', isShopStaff, validateBody(createTransferRequestSchema), InventoryController.createTransferRequest);
router.post('/transfers/direct', isShopStaff, validateBody(stockTransferSchema), InventoryController.transferStock);
router.post('/transfers/:id/approve', isShopStaff, InventoryController.approveTransfer);
router.post('/transfers/:id/reject', isShopStaff, InventoryController.rejectTransfer);
router.post('/transfers/:id/dispatch', isShopStaff, InventoryController.dispatchTransfer);
router.post('/transfers/:id/receive', isShopStaff, validateBody(receiveTransferSchema), InventoryController.receiveTransfer);

export default router;
