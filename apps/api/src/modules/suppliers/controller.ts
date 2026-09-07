import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Supplier, PurchaseOrder, GoodsReceivedNote, Product } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class SupplierController {
  static async listSuppliers(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { search, status } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const suppliers = await dbStore.collection<Supplier>('suppliers').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let data = suppliers.data;
    if (search) {
      const q = (search as string).toLowerCase();
      data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
      );
    }

    // Attach order count & total spend
    const enriched = await Promise.all(
      data.map(async sup => {
        const poQuery = await dbStore.collection<PurchaseOrder>('purchaseOrders').query({
          where: [{ field: 'supplierId', op: '==', value: sup.id }],
        });
        const totalSpend = poQuery.data
          .filter(p => p.status !== 'cancelled')
          .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

        return {
          ...sup,
          purchaseOrderCount: poQuery.data.length,
          totalSpend,
        };
      })
    );

    return sendSuccess(res, enriched);
  }

  static async getSupplier(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const supplier = await dbStore.collection<Supplier>('suppliers').get(id);
    if (!supplier || (req.user?.role !== 'super_admin' && supplier.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Supplier not found', 404);
    }

    const [pos, grns, products] = await Promise.all([
      dbStore.collection<PurchaseOrder>('purchaseOrders').query({
        where: [{ field: 'supplierId', op: '==', value: id }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      }),
      dbStore.collection<GoodsReceivedNote>('grns').query({
        where: [{ field: 'supplierId', op: '==', value: id }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      }),
      dbStore.collection<Product>('products').query({
        where: [{ field: 'supplierId', op: '==', value: id }],
      }),
    ]);

    const totalSpend = pos.data
      .filter(p => p.status !== 'cancelled')
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    return sendSuccess(res, {
      supplier,
      purchaseOrders: pos.data,
      grns: grns.data,
      products: products.data,
      totalSpend,
    });
  }

  static async createSupplier(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { name, contactPerson, email, phone, address, taxId, paymentTerms, productsSupplied } = req.body;
    const supplier = await dbStore.collection<Supplier>('suppliers').create({
      shopId,
      name,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      paymentTerms: paymentTerms || 'Net 30',
      productsSupplied: productsSupplied || [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_SUPPLIER',
      entity: 'supplier',
      entityId: supplier.id,
      shopId,
      after: { name, contactPerson, email },
    });

    return sendSuccess(res, supplier, undefined, 201);
  }

  static async updateSupplier(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const supplier = await dbStore.collection<Supplier>('suppliers').get(id);
    if (!supplier || (req.user?.role !== 'super_admin' && supplier.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Supplier not found', 404);
    }

    const updated = await dbStore.collection<Supplier>('suppliers').update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SUPPLIER',
      entity: 'supplier',
      entityId: id,
      shopId: supplier.shopId,
      before: supplier,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteSupplier(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const supplier = await dbStore.collection<Supplier>('suppliers').get(id);
    if (!supplier || (req.user?.role !== 'super_admin' && supplier.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Supplier not found', 404);
    }

    // Check if supplier has POs
    const pos = await dbStore.collection<PurchaseOrder>('purchaseOrders').query({
      where: [{ field: 'supplierId', op: '==', value: id }],
    });

    if (pos.data.length > 0) {
      return sendError(res, 'BAD_REQUEST', 'Cannot delete supplier with existing purchase orders. Deactivate instead.', 400);
    }

    await dbStore.collection<Supplier>('suppliers').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_SUPPLIER',
      entity: 'supplier',
      entityId: id,
      shopId: supplier.shopId,
      before: supplier,
    });

    return sendSuccess(res, { message: 'Supplier deleted successfully' });
  }
}
