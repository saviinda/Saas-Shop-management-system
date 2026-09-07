import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Product, InventoryItem, StockMovement, Branch } from '@saas/types';
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

    // Attach current aggregated inventory count across branches
    const enriched = await Promise.all(
      products.map(async p => {
        const invQuery = await dbStore.collection<InventoryItem>('inventory').query({
          where: [{ field: 'productId', op: '==', value: p.id }],
        });
        const totalStock = invQuery.data.reduce((acc, curr) => acc + curr.quantity, 0);
        return {
          ...p,
          currentStock: totalStock,
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

    return sendSuccess(res, { product, branchStock: inv.data });
  }

  static async createProduct(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    // Package limit check (BR-03, BR-10)
    await PackageLimitService.checkProductLimit(shopId);

    const {
      sku,
      name,
      description,
      category,
      imageUrl,
      costPrice,
      sellingPrice,
      minimumStockLevel = 5,
      supplierId,
      initialStock = 0,
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

    const product = await dbStore.collection<Product>('products').create({
      shopId,
      sku,
      name,
      description,
      category,
      imageUrl,
      costPrice,
      sellingPrice,
      minimumStockLevel,
      supplierId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Auto-create inventory record in branches
    const branches = await dbStore.collection<Branch>('branches').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    for (const b of branches.data) {
      const branchQty = b.isDefault ? initialStock : 0;
      await dbStore.collection<InventoryItem>('inventory').create({
        shopId,
        branchId: b.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: branchQty,
        minimumStockLevel,
        costPrice,
        sellingPrice,
        updatedAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
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
    if (req.body.name || req.body.sku || req.body.sellingPrice || req.body.costPrice) {
      const invItems = await dbStore.collection<InventoryItem>('inventory').query({
        where: [{ field: 'productId', op: '==', value: id }],
      });
      for (const item of invItems.data) {
        await dbStore.collection<InventoryItem>('inventory').update(item.id, {
          productName: req.body.name || item.productName,
          sku: req.body.sku || item.sku,
          sellingPrice: req.body.sellingPrice !== undefined ? req.body.sellingPrice : item.sellingPrice,
          costPrice: req.body.costPrice !== undefined ? req.body.costPrice : item.costPrice,
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
}
