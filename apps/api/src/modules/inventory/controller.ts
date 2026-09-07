import { Response } from 'express';
import { dbStore } from '../../db/store';
import { InventoryItem, StockMovement, Branch } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class InventoryController {
  static async listInventory(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, lowStock, search } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }

    const items = await dbStore.collection<InventoryItem>('inventory').query({
      where,
      orderBy: { field: 'updatedAt', direction: 'desc' },
    });

    let data = items.data;

    if (lowStock === 'true') {
      data = data.filter(item => item.quantity <= item.minimumStockLevel);
    }

    if (search) {
      const q = (search as string).toLowerCase();
      data = data.filter(item => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
    }

    // Attach branch details
    const enriched = await Promise.all(
      data.map(async item => {
        const branch = await dbStore.collection<Branch>('branches').get(item.branchId);
        return {
          ...item,
          branchName: branch?.name || 'Main Branch',
        };
      })
    );

    return sendSuccess(res, enriched);
  }

  static async adjustStock(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { branchId, productId, quantityDelta, reason, type } = req.body;

    const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
      where: [
        { field: 'shopId', op: '==', value: shopId },
        { field: 'branchId', op: '==', value: branchId },
        { field: 'productId', op: '==', value: productId },
      ],
    });

    if (invQuery.data.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Inventory record not found for this branch', 404);
    }

    const inv = invQuery.data[0];
    const newQty = Math.max(0, inv.quantity + quantityDelta);

    const updated = await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
      quantity: newQty,
      updatedAt: new Date().toISOString(),
    });

    const movement = await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId,
      productId,
      type,
      quantityDelta,
      newQuantity: newQty,
      reason,
      performedBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: `STOCK_ADJUSTMENT_${type.toUpperCase()}`,
      entity: 'inventory',
      entityId: inv.id,
      shopId,
      before: { quantity: inv.quantity },
      after: { quantity: newQty, reason, delta: quantityDelta },
    });

    return sendSuccess(res, { inventory: updated, movement });
  }

  static async adjustStockById(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { id } = req.params;
    const inv = await dbStore.collection<InventoryItem>('inventory').get(id);
    if (!inv || (req.user?.role !== 'super_admin' && inv.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Inventory record not found', 404);
    }

    const { quantityDelta, quantity, reason = 'Stock adjustment', type = 'adjustment' } = req.body;
    let delta = typeof quantityDelta === 'number' ? quantityDelta : 0;
    let adjType = type;

    if (type === 'add' && typeof quantity === 'number') {
      delta = quantity;
      adjType = 'adjustment';
    } else if (type === 'subtract' && typeof quantity === 'number') {
      delta = -quantity;
      adjType = 'damaged';
    } else if (type === 'set' && typeof quantity === 'number') {
      delta = quantity - inv.quantity;
      adjType = 'adjustment';
    }

    const newQty = Math.max(0, inv.quantity + delta);

    const updated = await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
      quantity: newQty,
      updatedAt: new Date().toISOString(),
    });

    const movement = await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId: inv.branchId,
      productId: inv.productId,
      type: (adjType as any) || 'adjustment',
      quantityDelta: delta,
      newQuantity: newQty,
      reason,
      performedBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: `STOCK_ADJUSTMENT_${String(adjType).toUpperCase()}`,
      entity: 'inventory',
      entityId: inv.id,
      shopId,
      before: { quantity: inv.quantity },
      after: { quantity: newQty, reason, delta },
    });

    return sendSuccess(res, { inventory: updated, movement });
  }

  static async transferStock(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { sourceBranchId, destinationBranchId, productId, quantity, reason } = req.body;

    if (sourceBranchId === destinationBranchId) {
      return sendError(res, 'BAD_REQUEST', 'Source and destination branches must be different', 400);
    }

    // 1. Check source inventory
    const srcInvQuery = await dbStore.collection<InventoryItem>('inventory').query({
      where: [
        { field: 'shopId', op: '==', value: shopId },
        { field: 'branchId', op: '==', value: sourceBranchId },
        { field: 'productId', op: '==', value: productId },
      ],
    });

    if (srcInvQuery.data.length === 0 || srcInvQuery.data[0].quantity < quantity) {
      return sendError(res, 'INSUFFICIENT_STOCK', 'Source branch does not have enough stock for this transfer', 400);
    }

    const srcInv = srcInvQuery.data[0];

    // 2. Check or create destination inventory
    const destInvQuery = await dbStore.collection<InventoryItem>('inventory').query({
      where: [
        { field: 'shopId', op: '==', value: shopId },
        { field: 'branchId', op: '==', value: destinationBranchId },
        { field: 'productId', op: '==', value: productId },
      ],
    });

    let destInv: InventoryItem;
    if (destInvQuery.data.length > 0) {
      destInv = destInvQuery.data[0];
    } else {
      destInv = await dbStore.collection<InventoryItem>('inventory').create({
        shopId,
        branchId: destinationBranchId,
        productId,
        productName: srcInv.productName,
        sku: srcInv.sku,
        quantity: 0,
        minimumStockLevel: srcInv.minimumStockLevel,
        costPrice: srcInv.costPrice,
        sellingPrice: srcInv.sellingPrice,
        updatedAt: new Date().toISOString(),
      });
    }

    // Deduct from source
    const newSrcQty = srcInv.quantity - quantity;
    await dbStore.collection<InventoryItem>('inventory').update(srcInv.id, {
      quantity: newSrcQty,
      updatedAt: new Date().toISOString(),
    });

    // Add to destination
    const newDestQty = destInv.quantity + quantity;
    await dbStore.collection<InventoryItem>('inventory').update(destInv.id, {
      quantity: newDestQty,
      updatedAt: new Date().toISOString(),
    });

    // Log stock movements for both branches
    const sourceBranch = await dbStore.collection<Branch>('branches').get(sourceBranchId);
    const destBranch = await dbStore.collection<Branch>('branches').get(destinationBranchId);

    await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId: sourceBranchId,
      productId,
      type: 'transfer',
      quantityDelta: -quantity,
      newQuantity: newSrcQty,
      reason: `Transfer out to ${destBranch?.name || destinationBranchId}: ${reason}`,
      performedBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId: destinationBranchId,
      productId,
      type: 'transfer',
      quantityDelta: quantity,
      newQuantity: newDestQty,
      reason: `Transfer in from ${sourceBranch?.name || sourceBranchId}: ${reason}`,
      performedBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'TRANSFER_STOCK',
      entity: 'inventory',
      entityId: productId,
      shopId,
      after: { sourceBranchId, destinationBranchId, quantity, reason },
    });

    return sendSuccess(res, {
      message: 'Stock transferred successfully',
      sourceQuantity: newSrcQty,
      destinationQuantity: newDestQty,
    });
  }

  static async listStockMovements(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, productId } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }
    if (productId && productId !== 'all') {
      where.push({ field: 'productId', op: '==', value: productId });
    }

    const movements = await dbStore.collection<StockMovement>('stockMovements').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 100,
    });

    return sendSuccess(res, movements.data);
  }
}
