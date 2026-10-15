import { Response } from 'express';
import { dbStore } from '../../db/store';
import { InventoryItem, StockMovement, Branch, User, StockTransferRequest, ProductBatch, Product } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { EmailService } from '../../services/email.service';

export class InventoryController {
  static async listInventory(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, lowStock, search, page, limit } = req.query;

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

    // Deduplicate any duplicate inventory records by branchId & productId
    const seen = new Set<string>();
    const uniqueItems: InventoryItem[] = [];
    for (const item of data) {
      const key = `${item.branchId}_${item.productId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }
    data = uniqueItems;

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

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 10);
      const offset = (pageNum - 1) * limitNum;
      const paginated = enriched.slice(offset, offset + limitNum);

      return sendSuccess(res, paginated, {
        total: enriched.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(enriched.length / limitNum),
      });
    }

    return sendSuccess(res, enriched, { total: enriched.length });
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

    if (newQty <= inv.minimumStockLevel) {
      const branch = await dbStore.collection<Branch>('branches').get(branchId);
      const owners = await dbStore.collection<User>('users').query({
        where: [
          { field: 'shopId', op: '==', value: shopId },
          { field: 'role', op: '==', value: 'shop_owner' },
        ],
      });
      for (const owner of owners.data) {
        if (owner.email) {
          await EmailService.sendLowStockReminderEmail({
            email: owner.email,
            name: owner.name,
            shopName: branch?.name || 'Store Branch',
            productName: inv.productName,
            sku: inv.sku || 'N/A',
            currentStock: newQty,
            minimumStockLevel: inv.minimumStockLevel,
            branchName: branch?.name || 'Main Branch',
            shopId,
            userId: owner.id,
          });
        }
      }
    }

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

  /**
   * Direct Instant Transfer (combining dispatch & receipt immediately)
   */
  static async transferStock(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { sourceBranchId, destinationBranchId, productId, batchId, quantity, reason, notes } = req.body;

    if (!sourceBranchId || !destinationBranchId) {
      return sendError(res, 'BAD_REQUEST', 'Source and destination branches are required', 400);
    }
    if (sourceBranchId === destinationBranchId) {
      return sendError(res, 'BAD_REQUEST', 'Source and destination branches must be different', 400);
    }
    if (!quantity || quantity <= 0) {
      return sendError(res, 'BAD_REQUEST', 'Valid transfer quantity is required', 400);
    }

    const sourceBranch = await dbStore.collection<Branch>('branches').get(sourceBranchId);
    const destBranch = await dbStore.collection<Branch>('branches').get(destinationBranchId);
    if (!sourceBranch || !destBranch) {
      return sendError(res, 'BAD_REQUEST', 'Invalid source or destination branch', 400);
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

    // 2. If batch is specified, check source batch quantity
    let sourceBatch: ProductBatch | null = null;
    if (batchId) {
      sourceBatch = await dbStore.collection<ProductBatch>('productBatches').get(batchId);
      if (!sourceBatch || sourceBatch.branchId !== sourceBranchId || sourceBatch.quantity < quantity) {
        return sendError(res, 'INSUFFICIENT_BATCH_STOCK', `Selected batch #${sourceBatch?.batchNumber || batchId} has insufficient stock in source branch`, 400);
      }
    }

    const now = new Date().toISOString();

    // 3. Deduct from source inventory
    const newSrcQty = srcInv.quantity - quantity;
    await dbStore.collection<InventoryItem>('inventory').update(srcInv.id, {
      quantity: newSrcQty,
      updatedAt: now,
    });

    // 4. Deduct from source batch if specified
    if (sourceBatch) {
      const newSrcBatchQty = sourceBatch.quantity - quantity;
      await dbStore.collection<ProductBatch>('productBatches').update(sourceBatch.id, {
        quantity: newSrcBatchQty,
        status: newSrcBatchQty === 0 ? 'depleted' : sourceBatch.status,
        updatedAt: now,
      });
    }

    // 5. Check or create destination inventory
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
      const newDestQty = destInv.quantity + quantity;
      await dbStore.collection<InventoryItem>('inventory').update(destInv.id, {
        quantity: newDestQty,
        updatedAt: now,
      });
    } else {
      destInv = await dbStore.collection<InventoryItem>('inventory').create({
        shopId,
        branchId: destinationBranchId,
        productId,
        productName: srcInv.productName,
        sku: srcInv.sku,
        quantity,
        minimumStockLevel: srcInv.minimumStockLevel,
        costPrice: srcInv.costPrice,
        sellingPrice: srcInv.sellingPrice,
        updatedAt: now,
      });
    }

    // 6. Transfer batch to destination if sourceBatch was selected
    let destBatch: ProductBatch | null = null;
    if (sourceBatch) {
      const destBatchQuery = await dbStore.collection<ProductBatch>('productBatches').query({
        where: [
          { field: 'shopId', op: '==', value: shopId },
          { field: 'branchId', op: '==', value: destinationBranchId },
          { field: 'productId', op: '==', value: productId },
          { field: 'batchNumber', op: '==', value: sourceBatch.batchNumber },
        ],
      });

      if (destBatchQuery.data.length > 0) {
        destBatch = destBatchQuery.data[0];
        await dbStore.collection<ProductBatch>('productBatches').update(destBatch.id, {
          quantity: destBatch.quantity + quantity,
          status: 'active',
          updatedAt: now,
        });
      } else {
        destBatch = await dbStore.collection<ProductBatch>('productBatches').create({
          shopId,
          productId,
          branchId: destinationBranchId,
          branchName: destBranch.name,
          batchNumber: sourceBatch.batchNumber,
          costPrice: sourceBatch.costPrice,
          sellingPrice: sourceBatch.sellingPrice,
          quantity,
          initialQuantity: quantity,
          manufacturingDate: sourceBatch.manufacturingDate,
          expiryDate: sourceBatch.expiryDate,
          supplierId: sourceBatch.supplierId,
          supplierName: sourceBatch.supplierName,
          status: 'active',
          notes: `Transferred from ${sourceBranch.name}`,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 7. Log stock movements for both branches
    const transferNum = `TRF-${Date.now().toString().slice(-6)}`;

    await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId: sourceBranchId,
      productId,
      type: 'transfer',
      quantityDelta: -quantity,
      newQuantity: newSrcQty,
      reason: `Transfer out to ${destBranch.name} (#${transferNum}): ${reason || 'Inter-branch transfer'}${sourceBatch ? ` [Batch: ${sourceBatch.batchNumber}]` : ''}`,
      referenceId: transferNum,
      performedBy: req.user!.name,
      createdAt: now,
    });

    const finalDestQty = destInvQuery.data.length > 0 ? destInv.quantity + quantity : quantity;
    await dbStore.collection<StockMovement>('stockMovements').create({
      shopId,
      branchId: destinationBranchId,
      productId,
      type: 'transfer',
      quantityDelta: quantity,
      newQuantity: finalDestQty,
      reason: `Transfer in from ${sourceBranch.name} (#${transferNum}): ${reason || 'Inter-branch transfer'}${sourceBatch ? ` [Batch: ${sourceBatch.batchNumber}]` : ''}`,
      referenceId: transferNum,
      performedBy: req.user!.name,
      createdAt: now,
    });

    // 8. Record completed transfer request
    const transferRecord = await dbStore.collection<StockTransferRequest>('transferRequests').create({
      transferNumber: transferNum,
      shopId,
      sourceBranchId,
      sourceBranchName: sourceBranch.name,
      destinationBranchId,
      destinationBranchName: destBranch.name,
      items: [
        {
          productId,
          productName: srcInv.productName,
          sku: srcInv.sku,
          batchId: sourceBatch?.id,
          batchNumber: sourceBatch?.batchNumber,
          quantity,
          receivedQuantity: quantity,
          costPrice: srcInv.costPrice,
          sellingPrice: srcInv.sellingPrice,
        },
      ],
      productId,
      productName: srcInv.productName,
      sku: srcInv.sku,
      batchId: sourceBatch?.id,
      batchNumber: sourceBatch?.batchNumber,
      quantity,
      receivedQuantity: quantity,
      status: 'completed',
      reason: reason || 'Direct inter-branch transfer',
      notes,
      requestedBy: req.user!.name,
      requesterId: req.user!.id,
      approvedBy: req.user!.name,
      approvedAt: now,
      dispatchedBy: req.user!.name,
      dispatchedAt: now,
      receivedBy: req.user!.name,
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'TRANSFER_STOCK_COMPLETED',
      entity: 'inventory',
      entityId: productId,
      shopId,
      after: transferRecord,
    });

    return sendSuccess(res, {
      message: 'Stock transferred successfully',
      transfer: transferRecord,
      sourceQuantity: newSrcQty,
      destinationQuantity: finalDestQty,
    });
  }

  /**
   * List Transfer Requests
   */
  static async listTransferRequests(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, status, type, search, page, limit } = req.query;
    const targetBranchId = (branchId as string) || req.branchId || (req.headers['x-branch-id'] as string);

    const transfers = await dbStore.collection<StockTransferRequest>('transferRequests').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let results = transfers.data;

    // Filter by branch
    if (targetBranchId && targetBranchId !== 'all') {
      if (type === 'incoming') {
        results = results.filter(t => t.destinationBranchId === targetBranchId);
      } else if (type === 'outgoing') {
        results = results.filter(t => t.sourceBranchId === targetBranchId);
      } else {
        results = results.filter(t => t.sourceBranchId === targetBranchId || t.destinationBranchId === targetBranchId);
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      results = results.filter(t => t.status === status);
    }

    // Search filter
    if (search) {
      const q = (search as string).toLowerCase();
      results = results.filter(t =>
        t.transferNumber.toLowerCase().includes(q) ||
        (t.sourceBranchName && t.sourceBranchName.toLowerCase().includes(q)) ||
        (t.destinationBranchName && t.destinationBranchName.toLowerCase().includes(q)) ||
        (t.productName && t.productName.toLowerCase().includes(q)) ||
        (t.reason && t.reason.toLowerCase().includes(q)) ||
        (t.items && t.items.some(i => i.productName.toLowerCase().includes(q) || (i.batchNumber && i.batchNumber.toLowerCase().includes(q))))
      );
    }

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 10);
      const offset = (pageNum - 1) * limitNum;
      const paginated = results.slice(offset, offset + limitNum);

      return sendSuccess(res, paginated, {
        total: results.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(results.length / limitNum),
      });
    }

    return sendSuccess(res, results, { total: results.length });
  }

  /**
   * Get single Transfer Request
   */
  static async getTransferRequest(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const transfer = await dbStore.collection<StockTransferRequest>('transferRequests').get(id);
    if (!transfer || (req.user?.role !== 'super_admin' && transfer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Transfer request not found', 404);
    }
    return sendSuccess(res, transfer);
  }

  /**
   * Create New Transfer Request (status: pending)
   */
  static async createTransferRequest(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { sourceBranchId, destinationBranchId, productId, batchId, quantity, items, reason, notes } = req.body;

    if (!sourceBranchId || !destinationBranchId) {
      return sendError(res, 'BAD_REQUEST', 'Source and destination branches are required', 400);
    }
    if (sourceBranchId === destinationBranchId) {
      return sendError(res, 'BAD_REQUEST', 'Source and destination branches must be different', 400);
    }

    const sourceBranch = await dbStore.collection<Branch>('branches').get(sourceBranchId);
    const destBranch = await dbStore.collection<Branch>('branches').get(destinationBranchId);
    if (!sourceBranch || !destBranch) {
      return sendError(res, 'BAD_REQUEST', 'Invalid source or destination branch', 400);
    }

    // Prepare items list
    let transferItems: any[] = [];
    if (Array.isArray(items) && items.length > 0) {
      transferItems = items;
    } else if (productId && quantity) {
      const prod = await dbStore.collection<Product>('products').get(productId);
      let batchNumber: string | undefined;
      if (batchId) {
        const batch = await dbStore.collection<ProductBatch>('productBatches').get(batchId);
        batchNumber = batch?.batchNumber;
      }
      transferItems = [
        {
          productId,
          productName: prod?.name || 'Product',
          sku: prod?.sku,
          batchId,
          batchNumber,
          quantity: Number(quantity),
          costPrice: prod?.costPrice,
          sellingPrice: prod?.sellingPrice,
        },
      ];
    } else {
      return sendError(res, 'BAD_REQUEST', 'Product and quantity or items list required', 400);
    }

    // Validate available stock in source branch
    for (const it of transferItems) {
      const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'shopId', op: '==', value: shopId },
          { field: 'branchId', op: '==', value: sourceBranchId },
          { field: 'productId', op: '==', value: it.productId },
        ],
      });

      if (invQuery.data.length === 0 || invQuery.data[0].quantity < it.quantity) {
        return sendError(res, 'INSUFFICIENT_STOCK', `Source branch "${sourceBranch.name}" only has ${invQuery.data[0]?.quantity || 0} units of "${it.productName || it.productId}" available. Cannot transfer ${it.quantity}.`, 400);
      }

      if (it.batchId) {
        const batch = await dbStore.collection<ProductBatch>('productBatches').get(it.batchId);
        if (!batch || batch.branchId !== sourceBranchId || batch.quantity < it.quantity) {
          return sendError(res, 'INSUFFICIENT_BATCH_STOCK', `Batch #${batch?.batchNumber || it.batchId} only has ${batch?.quantity || 0} units available in source branch.`, 400);
        }
      }
    }

    const now = new Date().toISOString();
    const transferNum = `TRF-${Date.now().toString().slice(-6)}`;

    const primaryItem = transferItems[0];
    const newTransfer = await dbStore.collection<StockTransferRequest>('transferRequests').create({
      transferNumber: transferNum,
      shopId,
      sourceBranchId,
      sourceBranchName: sourceBranch.name,
      destinationBranchId,
      destinationBranchName: destBranch.name,
      items: transferItems,
      productId: primaryItem.productId,
      productName: primaryItem.productName,
      sku: primaryItem.sku,
      batchId: primaryItem.batchId,
      batchNumber: primaryItem.batchNumber,
      quantity: primaryItem.quantity,
      status: 'pending',
      reason: reason || 'Stock transfer request',
      notes,
      requestedBy: req.user!.name,
      requesterId: req.user!.id,
      createdAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_TRANSFER_REQUEST',
      entity: 'transferRequests',
      entityId: newTransfer.id,
      shopId,
      after: newTransfer,
    });

    return sendSuccess(res, newTransfer, { message: 'Transfer request created successfully' }, 201);
  }

  /**
   * Approve Transfer Request (status: approved)
   */
  static async approveTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const transfer = await dbStore.collection<StockTransferRequest>('transferRequests').get(id);
    if (!transfer || (req.user?.role !== 'super_admin' && transfer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Transfer request not found', 404);
    }

    if (transfer.status !== 'pending') {
      return sendError(res, 'INVALID_STATE', `Only pending transfers can be approved. Current status: ${transfer.status}`, 400);
    }

    const now = new Date().toISOString();
    const updated = await dbStore.collection<StockTransferRequest>('transferRequests').update(id, {
      status: 'approved',
      approvedBy: req.user!.name,
      approvedAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'APPROVE_TRANSFER_REQUEST',
      entity: 'transferRequests',
      entityId: id,
      shopId: transfer.shopId,
      after: updated,
    });

    return sendSuccess(res, updated, { message: 'Transfer request approved' });
  }

  /**
   * Reject Transfer Request (status: rejected)
   */
  static async rejectTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const transfer = await dbStore.collection<StockTransferRequest>('transferRequests').get(id);
    if (!transfer || (req.user?.role !== 'super_admin' && transfer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Transfer request not found', 404);
    }

    if (transfer.status !== 'pending' && transfer.status !== 'approved') {
      return sendError(res, 'INVALID_STATE', `Cannot reject transfer in ${transfer.status} state`, 400);
    }

    const now = new Date().toISOString();
    const updated = await dbStore.collection<StockTransferRequest>('transferRequests').update(id, {
      status: 'rejected',
      rejectedBy: req.user!.name,
      rejectedAt: now,
      rejectionReason: rejectionReason || 'Rejected by branch manager',
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'REJECT_TRANSFER_REQUEST',
      entity: 'transferRequests',
      entityId: id,
      shopId: transfer.shopId,
      after: updated,
    });

    return sendSuccess(res, updated, { message: 'Transfer request rejected' });
  }

  /**
   * Dispatch Transfer (deducts stock from source branch, status: dispatched)
   */
  static async dispatchTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const transfer = await dbStore.collection<StockTransferRequest>('transferRequests').get(id);
    if (!transfer || (req.user?.role !== 'super_admin' && transfer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Transfer request not found', 404);
    }

    if (transfer.status !== 'approved' && transfer.status !== 'pending') {
      return sendError(res, 'INVALID_STATE', `Transfer cannot be dispatched in "${transfer.status}" status`, 400);
    }

    const now = new Date().toISOString();
    const itemsToDispatch = transfer.items && transfer.items.length > 0
      ? transfer.items
      : [{
          productId: transfer.productId!,
          productName: transfer.productName || 'Product',
          batchId: transfer.batchId,
          batchNumber: transfer.batchNumber,
          quantity: transfer.quantity || 1,
        }];

    // Validate and deduct from source branch
    for (const it of itemsToDispatch) {
      const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'shopId', op: '==', value: transfer.shopId },
          { field: 'branchId', op: '==', value: transfer.sourceBranchId },
          { field: 'productId', op: '==', value: it.productId },
        ],
      });

      if (invQuery.data.length === 0 || invQuery.data[0].quantity < it.quantity) {
        return sendError(res, 'INSUFFICIENT_STOCK', `Source branch has insufficient stock to dispatch "${it.productName}"`, 400);
      }

      const srcInv = invQuery.data[0];
      const newSrcQty = srcInv.quantity - it.quantity;

      await dbStore.collection<InventoryItem>('inventory').update(srcInv.id, {
        quantity: newSrcQty,
        updatedAt: now,
      });

      if (it.batchId) {
        const batch = await dbStore.collection<ProductBatch>('productBatches').get(it.batchId);
        if (batch && batch.quantity >= it.quantity) {
          const newBatchQty = batch.quantity - it.quantity;
          await dbStore.collection<ProductBatch>('productBatches').update(batch.id, {
            quantity: newBatchQty,
            status: newBatchQty === 0 ? 'depleted' : batch.status,
            updatedAt: now,
          });
        }
      }

      await dbStore.collection<StockMovement>('stockMovements').create({
        shopId: transfer.shopId,
        branchId: transfer.sourceBranchId,
        productId: it.productId,
        type: 'transfer',
        quantityDelta: -it.quantity,
        newQuantity: newSrcQty,
        reason: `Dispatched to ${transfer.destinationBranchName || transfer.destinationBranchId} (#${transfer.transferNumber})${it.batchNumber ? ` [Batch: ${it.batchNumber}]` : ''}`,
        referenceId: transfer.transferNumber,
        performedBy: req.user!.name,
        createdAt: now,
      });
    }

    const updated = await dbStore.collection<StockTransferRequest>('transferRequests').update(id, {
      status: 'dispatched',
      dispatchedBy: req.user!.name,
      dispatchedAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'DISPATCH_TRANSFER',
      entity: 'transferRequests',
      entityId: id,
      shopId: transfer.shopId,
      after: updated,
    });

    return sendSuccess(res, updated, { message: 'Stock dispatched successfully. In-transit to destination branch.' });
  }

  /**
   * Receive Transfer into Destination Branch (adds stock to destination branch, status: completed)
   */
  static async receiveTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { receivedQuantity, receivedItems, notes } = req.body;

    const transfer = await dbStore.collection<StockTransferRequest>('transferRequests').get(id);
    if (!transfer || (req.user?.role !== 'super_admin' && transfer.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Transfer request not found', 404);
    }

    if (transfer.status !== 'dispatched') {
      return sendError(res, 'INVALID_STATE', `Only dispatched transfers can be received. Current status: "${transfer.status}"`, 400);
    }

    const now = new Date().toISOString();
    const sourceBranch = await dbStore.collection<Branch>('branches').get(transfer.sourceBranchId);
    const destBranch = await dbStore.collection<Branch>('branches').get(transfer.destinationBranchId);

    const itemsToProcess = transfer.items && transfer.items.length > 0
      ? transfer.items
      : [{
          productId: transfer.productId!,
          productName: transfer.productName || 'Product',
          sku: transfer.sku,
          batchId: transfer.batchId,
          batchNumber: transfer.batchNumber,
          quantity: transfer.quantity || 1,
        }];

    let totalDispatched = 0;
    let totalReceived = 0;

    for (const it of itemsToProcess) {
      const itemReceivedQty = typeof receivedQuantity === 'number' && itemsToProcess.length === 1
        ? receivedQuantity
        : (receivedItems?.find((ri: any) => ri.productId === it.productId)?.quantity ?? it.quantity);

      totalDispatched += it.quantity;
      totalReceived += itemReceivedQty;

      // Add to destination inventory
      const destInvQuery = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'shopId', op: '==', value: transfer.shopId },
          { field: 'branchId', op: '==', value: transfer.destinationBranchId },
          { field: 'productId', op: '==', value: it.productId },
        ],
      });

      let finalDestQty = itemReceivedQty;
      if (destInvQuery.data.length > 0) {
        const destInv = destInvQuery.data[0];
        finalDestQty = destInv.quantity + itemReceivedQty;
        await dbStore.collection<InventoryItem>('inventory').update(destInv.id, {
          quantity: finalDestQty,
          updatedAt: now,
        });
      } else {
        await dbStore.collection<InventoryItem>('inventory').create({
          shopId: transfer.shopId,
          branchId: transfer.destinationBranchId,
          productId: it.productId,
          productName: it.productName,
          sku: it.sku || 'N/A',
          quantity: itemReceivedQty,
          minimumStockLevel: 5,
          costPrice: it.costPrice || 0,
          sellingPrice: it.sellingPrice || 0,
          updatedAt: now,
        });
      }

      // Replicate batch in destination branch if batch was transferred
      if (it.batchNumber) {
        const destBatchQuery = await dbStore.collection<ProductBatch>('productBatches').query({
          where: [
            { field: 'shopId', op: '==', value: transfer.shopId },
            { field: 'branchId', op: '==', value: transfer.destinationBranchId },
            { field: 'productId', op: '==', value: it.productId },
            { field: 'batchNumber', op: '==', value: it.batchNumber },
          ],
        });

        if (destBatchQuery.data.length > 0) {
          const destBatch = destBatchQuery.data[0];
          await dbStore.collection<ProductBatch>('productBatches').update(destBatch.id, {
            quantity: destBatch.quantity + itemReceivedQty,
            status: 'active',
            updatedAt: now,
          });
        } else {
          // Look up original batch for dates & supplier
          let origBatch: ProductBatch | null = null;
          if (it.batchId) {
            origBatch = await dbStore.collection<ProductBatch>('productBatches').get(it.batchId);
          }

          await dbStore.collection<ProductBatch>('productBatches').create({
            shopId: transfer.shopId,
            productId: it.productId,
            branchId: transfer.destinationBranchId,
            branchName: destBranch?.name || 'Destination Branch',
            batchNumber: it.batchNumber,
            costPrice: it.costPrice || origBatch?.costPrice || 0,
            sellingPrice: it.sellingPrice || origBatch?.sellingPrice || 0,
            quantity: itemReceivedQty,
            initialQuantity: itemReceivedQty,
            manufacturingDate: origBatch?.manufacturingDate,
            expiryDate: origBatch?.expiryDate,
            supplierId: origBatch?.supplierId,
            supplierName: origBatch?.supplierName,
            status: 'active',
            notes: `Received from ${sourceBranch?.name || transfer.sourceBranchId} (Transfer #${transfer.transferNumber})`,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Log StockMovement for destination branch
      await dbStore.collection<StockMovement>('stockMovements').create({
        shopId: transfer.shopId,
        branchId: transfer.destinationBranchId,
        productId: it.productId,
        type: 'transfer',
        quantityDelta: itemReceivedQty,
        newQuantity: finalDestQty,
        reason: `Received from ${sourceBranch?.name || transfer.sourceBranchId} (#${transfer.transferNumber})${it.batchNumber ? ` [Batch: ${it.batchNumber}]` : ''}`,
        referenceId: transfer.transferNumber,
        performedBy: req.user!.name,
        createdAt: now,
      });
    }

    const finalStatus = totalReceived < totalDispatched ? 'partially_received' : 'completed';

    const updated = await dbStore.collection<StockTransferRequest>('transferRequests').update(id, {
      status: finalStatus,
      receivedQuantity: totalReceived,
      receivedBy: req.user!.name,
      receivedAt: now,
      notes: notes || transfer.notes,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'RECEIVE_TRANSFER',
      entity: 'transferRequests',
      entityId: id,
      shopId: transfer.shopId,
      after: updated,
    });

    return sendSuccess(res, updated, { message: `Stock received successfully into ${destBranch?.name || 'destination branch'}.` });
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
