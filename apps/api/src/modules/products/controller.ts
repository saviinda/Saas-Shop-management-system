import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Product, ProductBatch, InventoryItem, StockMovement, Branch } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';

export class ProductController {
  static async listProducts(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { category, search, status } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (category && category !== 'all') {
      where.push({ field: 'category', op: '==', value: category });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const result = await dbStore.collection<Product>('products').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let products = result.data;
    if (search) {
      const q = (search as string).toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    // Attach current aggregated inventory count across branches and batch data
    const enriched = await Promise.all(
      products.map(async p => {
        const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
          where: [{ field: 'productId', op: '==', value: p.id }],
        });
        const batchesQuery = await dbStore.collection<ProductBatch>('productBatches').query({
          where: [{ field: 'productId', op: '==', value: p.id }],
        });

        const totalStockFromBatches = batchesQuery.data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const totalStockFromInv = invQuery.data.reduce((acc, curr) => acc + curr.quantity, 0);
        const totalStock = batchesQuery.data.length > 0 ? totalStockFromBatches : totalStockFromInv;

        const activeBatches = batchesQuery.data.filter(b => b.status === 'active' && b.quantity > 0);
        const latestBatch = activeBatches.length > 0 ? activeBatches[activeBatches.length - 1] : batchesQuery.data[batchesQuery.data.length - 1];

        return {
          ...p,
          sellingPrice: latestBatch ? latestBatch.sellingPrice : p.sellingPrice,
          costPrice: latestBatch ? latestBatch.costPrice : p.costPrice,
          currentStock: totalStock,
          batchesCount: batchesQuery.data.length,
          batches: batchesQuery.data,
        };
      })
    );

    return sendSuccess(res, enriched);
  }

  static async getProduct(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const product = await dbStore.collection<Product>('products').get(id);
    if (!product || (req.user?.role !== 'super_admin' && product.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    const inv = await dbStore.collection<InventoryItem>('inventory').query({
      where: [{ field: 'productId', op: '==', value: id }],
    });

    const batches = await dbStore.collection<ProductBatch>('productBatches').query({
      where: [{ field: 'productId', op: '==', value: id }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    const totalStock = batches.data.length > 0
      ? batches.data.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
      : inv.data.reduce((acc, curr) => acc + curr.quantity, 0);

    const activeBatches = batches.data.filter(b => b.status === 'active' && b.quantity > 0);
    const latestBatch = activeBatches.length > 0 ? activeBatches[activeBatches.length - 1] : batches.data[batches.data.length - 1];

    const enrichedProduct = {
      ...product,
      sellingPrice: latestBatch ? latestBatch.sellingPrice : product.sellingPrice,
      costPrice: latestBatch ? latestBatch.costPrice : product.costPrice,
      currentStock: totalStock,
      batchesCount: batches.data.length,
      batches: batches.data,
    };

    return sendSuccess(res, { product: enrichedProduct, branchStock: inv.data, batches: batches.data });
  }

  static async createProduct(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    // Package limit check (BR-03, BR-10)
    try {
      await PackageLimitService.checkProductLimit(shopId);
    } catch (err: any) {
      return sendError(
        res,
        'PACKAGE_LIMIT_EXCEEDED',
        err.message || 'Product limit reached. You cannot create a new product under your current plan.',
        403
      );
    }

    const {
      sku,
      name,
      description,
      category,
      imageUrl,
      costPrice = 0,
      sellingPrice = 0,
      minimumStockLevel = 5,
      supplierId,
      supplierName,
      initialStock = 0,
      isPublic,
      isFeatured,
      tags,
      variants,
    } = req.body;

    const existingSku = await dbStore.collection<Product>('products').query({
      where: [
        { field: 'shopId', op: '==', value: shopId },
        { field: 'sku', op: '==', value: sku },
      ],
    });

    if (existingSku.data.length > 0) {
      return sendError(res, 'SKU_EXISTS', 'Product SKU already exists in your shop', 400);
    }

    const now = new Date().toISOString();
    const product = await dbStore.collection<Product>('products').create({
      shopId,
      sku,
      name,
      description,
      category,
      imageUrl,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minimumStockLevel: Number(minimumStockLevel) || 5,
      supplierId,
      supplierName,
      isPublic,
      isFeatured,
      tags,
      variants,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create inventory record in branches
    const branches = await dbStore.collection<Branch>('branches').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    for (const b of branches.data) {
      const branchQty = b.isDefault ? Number(initialStock) || 0 : 0;
      await dbStore.collection<InventoryItem>('inventory').create({
        shopId,
        branchId: b.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: branchQty,
        minimumStockLevel: Number(minimumStockLevel) || 5,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        updatedAt: now,
      });

      if (branchQty > 0) {
        await dbStore.collection<StockMovement>('stockMovements').create({
          shopId,
          branchId: b.id,
          productId: product.id,
          type: 'opening',
          quantityDelta: branchQty,
          newQuantity: branchQty,
          reason: 'Initial stock on product creation',
          performedBy: req.user!.name,
          createdAt: now,
        });
      }
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_PRODUCT',
      entity: 'products',
      entityId: product.id,
      shopId,
      after: product,
    });

    return sendSuccess(res, product, undefined, 201);
  }

  static async updateProduct(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const product = await dbStore.collection<Product>('products').get(id);
    if (!product || (req.user?.role !== 'super_admin' && product.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    const updated = await dbStore.collection<Product>('products').update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    // Sync product name / sku to inventory items
    if (req.body.name || req.body.sku || req.body.sellingPrice !== undefined || req.body.costPrice !== undefined) {
      const invItems = await dbStore.collection<InventoryItem>('inventory').query({
        where: [{ field: 'productId', op: '==', value: id }],
      });
      for (const item of invItems.data) {
        await dbStore.collection<InventoryItem>('inventory').update(item.id, {
          productName: req.body.name || item.productName,
          sku: req.body.sku || item.sku,
          sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : item.sellingPrice,
          costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : item.costPrice,
        });
      }
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_PRODUCT',
      entity: 'products',
      entityId: id,
      shopId: product.shopId,
      before: product,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteProduct(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const product = await dbStore.collection<Product>('products').get(id);
    if (!product || (req.user?.role !== 'super_admin' && product.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    await dbStore.collection<Product>('products').delete(id);

    // Clean up branch inventory items for this product
    const invItems = await dbStore.collection<InventoryItem>('inventory').query({
      where: [{ field: 'productId', op: '==', value: id }],
    });
    for (const item of invItems.data) {
      await dbStore.collection<InventoryItem>('inventory').delete(item.id);
    }

    // Clean up product batches
    const batches = await dbStore.collection<ProductBatch>('productBatches').query({
      where: [{ field: 'productId', op: '==', value: id }],
    });
    for (const b of batches.data) {
      await dbStore.collection<ProductBatch>('productBatches').delete(b.id);
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_PRODUCT',
      entity: 'products',
      entityId: id,
      shopId: product.shopId,
      before: product,
    });

    return sendSuccess(res, { deleted: true, id });
  }

  // ==================== BATCH MANAGEMENT ====================

  static async listBatches(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const product = await dbStore.collection<Product>('products').get(id);
    if (!product || (req.user?.role !== 'super_admin' && product.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    const batches = await dbStore.collection<ProductBatch>('productBatches').query({
      where: [{ field: 'productId', op: '==', value: id }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, batches.data);
  }

  static async createBatch(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const product = await dbStore.collection<Product>('products').get(id);
    if (!product || (req.user?.role !== 'super_admin' && product.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    const {
      batchNumber,
      branchId: reqBranchId,
      branchName: reqBranchName,
      costPrice,
      sellingPrice,
      quantity,
      manufacturingDate,
      expiryDate,
      supplierId,
      supplierName,
      status = 'active',
      notes,
    } = req.body;

    if (!batchNumber) {
      return sendError(res, 'BAD_REQUEST', 'Batch number is required', 400);
    }
    if (quantity === undefined || Number(quantity) < 0) {
      return sendError(res, 'BAD_REQUEST', 'Valid quantity is required', 400);
    }

    // Determine target branch
    let targetBranchId = reqBranchId;
    let branchName = reqBranchName;

    if (!targetBranchId) {
      const branches = await dbStore.collection<Branch>('branches').query({
        where: [{ field: 'shopId', op: '==', value: shopId }],
      });
      const defBranch = branches.data.find(b => b.isDefault) || branches.data[0];
      if (defBranch) {
        targetBranchId = defBranch.id;
        branchName = branchName || defBranch.name;
      }
    } else if (!branchName) {
      const b = await dbStore.collection<Branch>('branches').get(targetBranchId);
      if (b) branchName = b.name;
    }

    const now = new Date().toISOString();
    const batch = await dbStore.collection<ProductBatch>('productBatches').create({
      shopId,
      productId: id,
      branchId: targetBranchId,
      branchName: branchName || 'Default Branch',
      batchNumber,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      quantity: Number(quantity) || 0,
      initialQuantity: Number(quantity) || 0,
      manufacturingDate,
      expiryDate,
      supplierId: supplierId || product.supplierId,
      supplierName: supplierName || product.supplierName,
      status,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    // Update branch inventory if targetBranchId exists
    if (targetBranchId) {
      const invItems = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'productId', op: '==', value: id },
          { field: 'branchId', op: '==', value: targetBranchId },
        ],
      });

      let currentBranchQty = 0;
      if (invItems.data.length > 0) {
        const inv = invItems.data[0];
        currentBranchQty = inv.quantity + Number(quantity);
        await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
          quantity: currentBranchQty,
          costPrice: Number(costPrice) || inv.costPrice,
          sellingPrice: Number(sellingPrice) || inv.sellingPrice,
          updatedAt: now,
        });
      } else {
        currentBranchQty = Number(quantity);
        await dbStore.collection<InventoryItem>('inventory').create({
          shopId,
          branchId: targetBranchId,
          productId: id,
          productName: product.name,
          sku: product.sku,
          quantity: currentBranchQty,
          minimumStockLevel: product.minimumStockLevel || 5,
          costPrice: Number(costPrice) || 0,
          sellingPrice: Number(sellingPrice) || 0,
          updatedAt: now,
        });
      }

      if (Number(quantity) > 0) {
        await dbStore.collection<StockMovement>('stockMovements').create({
          shopId,
          branchId: targetBranchId,
          productId: id,
          type: 'adjustment',
          quantityDelta: Number(quantity),
          newQuantity: currentBranchQty,
          reason: `Batch ${batchNumber} added`,
          performedBy: req.user?.name || 'Shop Staff',
          createdAt: now,
        });
      }
    }

    // Update product pricing
    await dbStore.collection<Product>('products').update(id, {
      sellingPrice: Number(sellingPrice) || product.sellingPrice,
      costPrice: Number(costPrice) || product.costPrice,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_PRODUCT_BATCH',
      entity: 'productBatches',
      entityId: batch.id,
      shopId,
      after: batch,
    });

    return sendSuccess(res, batch, undefined, 201);
  }

  static async updateBatch(req: AuthenticatedRequest, res: Response) {
    const { id, batchId } = req.params;
    const shopId = req.shopId;
    const batch = await dbStore.collection<ProductBatch>('productBatches').get(batchId);
    if (!batch || batch.productId !== id || (req.user?.role !== 'super_admin' && batch.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Batch not found', 404);
    }

    const now = new Date().toISOString();
    const oldQty = batch.quantity;
    const newQty = req.body.quantity !== undefined ? Number(req.body.quantity) : oldQty;
    const qtyDelta = newQty - oldQty;

    const updated = await dbStore.collection<ProductBatch>('productBatches').update(batchId, {
      ...req.body,
      quantity: newQty,
      costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : batch.costPrice,
      sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : batch.sellingPrice,
      updatedAt: now,
    });

    // If quantity changed and branch exists, update inventory
    if (qtyDelta !== 0 && batch.branchId) {
      const invItems = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'productId', op: '==', value: id },
          { field: 'branchId', op: '==', value: batch.branchId },
        ],
      });

      if (invItems.data.length > 0) {
        const inv = invItems.data[0];
        const newBranchQty = Math.max(0, inv.quantity + qtyDelta);
        await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
          quantity: newBranchQty,
          updatedAt: now,
        });

        await dbStore.collection<StockMovement>('stockMovements').create({
          shopId: batch.shopId,
          branchId: batch.branchId,
          productId: id,
          type: 'adjustment',
          quantityDelta: qtyDelta,
          newQuantity: newBranchQty,
          reason: `Batch ${batch.batchNumber} updated`,
          performedBy: req.user?.name || 'Shop Staff',
          createdAt: now,
        });
      }
    }

    if (req.body.sellingPrice !== undefined || req.body.costPrice !== undefined) {
      await dbStore.collection<Product>('products').update(id, {
        ...(req.body.sellingPrice !== undefined ? { sellingPrice: Number(req.body.sellingPrice) } : {}),
        ...(req.body.costPrice !== undefined ? { costPrice: Number(req.body.costPrice) } : {}),
        updatedAt: now,
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_PRODUCT_BATCH',
      entity: 'productBatches',
      entityId: batchId,
      shopId: batch.shopId,
      before: batch,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteBatch(req: AuthenticatedRequest, res: Response) {
    const { id, batchId } = req.params;
    const shopId = req.shopId;
    const batch = await dbStore.collection<ProductBatch>('productBatches').get(batchId);
    if (!batch || batch.productId !== id || (req.user?.role !== 'super_admin' && batch.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Batch not found', 404);
    }

    // Deduct remaining batch quantity from branch inventory
    if (batch.quantity > 0 && batch.branchId) {
      const invItems = await dbStore.collection<InventoryItem>('inventory').query({
        where: [
          { field: 'productId', op: '==', value: id },
          { field: 'branchId', op: '==', value: batch.branchId },
        ],
      });
      if (invItems.data.length > 0) {
        const inv = invItems.data[0];
        const newBranchQty = Math.max(0, inv.quantity - batch.quantity);
        await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
          quantity: newBranchQty,
          updatedAt: new Date().toISOString(),
        });

        await dbStore.collection<StockMovement>('stockMovements').create({
          shopId: batch.shopId,
          branchId: batch.branchId,
          productId: id,
          type: 'adjustment',
          quantityDelta: -batch.quantity,
          newQuantity: newBranchQty,
          reason: `Batch ${batch.batchNumber} deleted`,
          performedBy: req.user?.name || 'Shop Staff',
          createdAt: new Date().toISOString(),
        });
      }
    }

    await dbStore.collection<ProductBatch>('productBatches').delete(batchId);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_PRODUCT_BATCH',
      entity: 'productBatches',
      entityId: batchId,
      shopId: batch.shopId,
      before: batch,
    });

    return sendSuccess(res, { deleted: true, id: batchId });
  }
}
