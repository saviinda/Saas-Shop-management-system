import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Customer, Order } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class CustomerController {
  static async listCustomers(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { search } = req.query;
    const customers = await dbStore.collection<Customer>('customers').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let data = customers.data;
    if (search) {
      const q = (search as string).toLowerCase();
      data = data.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email?.toLowerCase().includes(q));
    }

    return sendSuccess(res, data);
  }

  static async getCustomer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const customer = await dbStore.collection<Customer>('customers').get(id);
    if (!customer || (req.user?.role !== 'super_admin' && customer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Customer not found', 404);
    }

    const orders = await dbStore.collection<Order>('orders').query({
      where: [{ field: 'customerId', op: '==', value: id }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, { customer, orders: orders.data });
  }

  static async createCustomer(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { name, email, phone, address, notes } = req.body;
    const customer = await dbStore.collection<Customer>('customers').create({
      shopId,
      name,
      email: email || undefined,
      phone,
      address,
      notes,
      totalOrdersCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_CUSTOMER',
      entity: 'customers',
      entityId: customer.id,
      shopId,
      after: customer,
    });

    return sendSuccess(res, customer, undefined, 201);
  }

  static async updateCustomer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const customer = await dbStore.collection<Customer>('customers').get(id);
    if (!customer || (req.user?.role !== 'super_admin' && customer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Customer not found', 404);
    }

    const updated = await dbStore.collection<Customer>('customers').update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_CUSTOMER',
      entity: 'customers',
      entityId: id,
      shopId: customer.shopId,
      before: customer,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteCustomer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const customer = await dbStore.collection<Customer>('customers').get(id);
    if (!customer || (req.user?.role !== 'super_admin' && customer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Customer not found', 404);
    }

    await dbStore.collection<Customer>('customers').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_CUSTOMER',
      entity: 'customers',
      entityId: id,
      shopId: customer.shopId,
      before: customer,
    });

    return sendSuccess(res, { deleted: true, id });
  }
}
