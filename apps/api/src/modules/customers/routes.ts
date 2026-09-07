import { Router } from 'express';
import { CustomerController } from './controller';
import { authenticate } from '../../middleware/auth';
import { isShopStaff } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createCustomerSchema, updateCustomerSchema } from '@saas/validation';

const router = Router();

router.use(authenticate);

router.get('/', isShopStaff, CustomerController.listCustomers);
router.get('/:id', isShopStaff, CustomerController.getCustomer);
router.post('/', isShopStaff, validateBody(createCustomerSchema), CustomerController.createCustomer);
router.patch('/:id', isShopStaff, validateBody(updateCustomerSchema), CustomerController.updateCustomer);
router.delete('/:id', isShopStaff, CustomerController.deleteCustomer);

export default router;
