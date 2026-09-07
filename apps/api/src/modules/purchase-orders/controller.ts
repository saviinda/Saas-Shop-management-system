import { Response } from 'express';
import { dbStore } from '../../db/store';
import { PurchaseOrder, PurchaseOrderItem, Product, Supplier, Branch } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class PurchaseOrderController {
  static async listPOs(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, status, supplierId } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }
    if (supplierId && supplierId !== 'all') {
      where.push({ field: 'supplierId', op: '==', value: supplierId });
    }

    const pos = await dbStore.collection<PurchaseOrder>('purchaseOrders').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, pos.data);
  }

  static async getPO(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const po = await dbStore.collection<PurchaseOrder>('purchaseOrders').get(id);
    if (!po || (req.user?.role !== 'super_admin' && po.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Purchase Order not found', 404);
    }
    return sendSuccess(res, po);
  }

  static async createPO(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { branchId, supplierId, items, expectedDate, notes } = req.body;

    const supplier = await dbStore.collection<Supplier>('suppliers').get(supplierId);
    if (!supplier || supplier.shopId !== shopId) return sendError(res, 'BAD_REQUEST', 'Invalid supplier', 400);

    let totalAmount = 0;
    const resolvedItems: PurchaseOrderItem[] = [];

    for (const it of items) {
      const prod = await dbStore.collection<Product>('products').get(it.productId);
      if (!prod || prod.shopId !== shopId) return sendError(res, 'BAD_REQUEST', `Product ${it.productId} not found`, 400);

      const cost = it.unitCost !== undefined ? it.unitCost : prod.costPrice;
      const totalCost = cost * it.orderedQty;
      totalAmount += totalCost;

      resolvedItems.push({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        orderedQty: it.orderedQty,
        receivedQty: 0,
        unitCost: cost,
        totalCost,
      });
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const po = await dbStore.collection<PurchaseOrder>('purchaseOrders').create({
      poNumber,
      shopId,
      branchId,
      supplierId,
      supplierName: supplier.name,
      items: resolvedItems,
      totalAmount,
      expectedDate,
      notes,
      status: 'submitted',
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_PURCHASE_ORDER',
      entity: 'purchaseOrders',
      entityId: po.id,
      shopId,
      after: po,
    });

    return sendSuccess(res, po, undefined, 201);
  }

  static async updatePOStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    const po = await dbStore.collection<PurchaseOrder>('purchaseOrders').get(id);
    if (!po || (req.user?.role !== 'super_admin' && po.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'PO not found', 404);
    }

    const updated = await dbStore.collection<PurchaseOrder>('purchaseOrders').update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_PO_STATUS',
      entity: 'purchaseOrders',
      entityId: id,
      shopId: po.shopId,
      before: { status: po.status },
      after: { status },
    });

    return sendSuccess(res, updated);
  }
}
