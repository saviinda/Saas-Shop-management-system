import { Response } from 'express';
import { dbStore } from '../../db/store';
import { GoodsReceivedNote, GRNItem, PurchaseOrder, InventoryItem, StockMovement, Product } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class GRNController {
  static async listGRNs(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }

    const grns = await dbStore.collection<GoodsReceivedNote>('grns').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, grns.data);
  }

  static async getGRN(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const grn = await dbStore.collection<GoodsReceivedNote>('grns').get(id);
    if (!grn || (req.user?.role !== 'super_admin' && grn.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'GRN not found', 404);
    }
    return sendSuccess(res, grn);
  }

  static async createGRN(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { purchaseOrderId, receivedItems, notes, documentUrl } = req.body;

    const po = await dbStore.collection<PurchaseOrder>('purchaseOrders').get(purchaseOrderId);
    if (!po || po.shopId !== shopId) {
      return sendError(res, 'BAD_REQUEST', 'Purchase order not found', 404);
    }

    let totalValue = 0;
    const enrichedReceivedItems: GRNItem[] = [];

    for (const item of receivedItems) {
      const prod = await dbStore.collection<Product>('products').get(item.productId);
      const productName = prod?.name || 'Product';
      const itemVal = item.receivedQty * item.unitCost;
      totalValue += itemVal;

      enrichedReceivedItems.push({
        productId: item.productId,
        productName,
        receivedQty: item.receivedQty,
        damagedQty: item.damagedQty || 0,
        unitCost: item.unitCost,
      });

      // Update branch inventory
      const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'shopId', op: '==', value: shopId },
          { field: 'branchId', op: '==', value: po.branchId },
          { field: 'productId', op: '==', value: item.productId },
        ],
      });

      let newQty = item.receivedQty;
      if (invQuery.data.length > 0) {
        const inv = invQuery.data[0];
        newQty = inv.quantity + item.receivedQty;
        await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
          quantity: newQty,
          costPrice: item.unitCost,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await dbStore.collection<InventoryItem>('inventory').create({
          shopId,
          branchId: po.branchId,
          productId: item.productId,
          productName,
          sku: prod?.sku || 'SKU',
          quantity: newQty,
          minimumStockLevel: prod?.minimumStockLevel || 5,
          costPrice: item.unitCost,
          sellingPrice: prod?.sellingPrice || item.unitCost * 1.5,
          updatedAt: new Date().toISOString(),
        });
      }

      // Record Stock Movement
      await dbStore.collection<StockMovement>('stockMovements').create({
        shopId,
        branchId: po.branchId,
        productId: item.productId,
        type: 'po_receive',
        quantityDelta: item.receivedQty,
        newQuantity: newQty,
        reason: `GRN from PO #${po.poNumber}`,
        referenceId: po.id,
        performedBy: req.user!.name,
        createdAt: new Date().toISOString(),
      });
    }

    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const grn = await dbStore.collection<GoodsReceivedNote>('grns').create({
      grnNumber,
      shopId,
      branchId: po.branchId,
      purchaseOrderId,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      receivedItems: enrichedReceivedItems,
      totalValue,
      notes,
      documentUrl,
      receivedBy: req.user!.name,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    // Update PO status to fully_received
    await dbStore.collection<PurchaseOrder>('purchaseOrders').update(po.id, {
      status: 'fully_received',
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_GRN',
      entity: 'grns',
      entityId: grn.id,
      shopId,
      after: grn,
    });

    return sendSuccess(res, grn, undefined, 201);
  }
}
