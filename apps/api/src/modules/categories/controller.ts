import { Response } from 'express';
import { dbStore } from '../../db/store';
import { ProductCategory, Product } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class CategoryController {
  static async listCategories(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { search, status } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const categoriesQuery = await dbStore.collection<ProductCategory>('categories').query({
      where,
      orderBy: { field: 'name', direction: 'asc' },
    });

    // Query products to compute real-time product count per category
    const productsQuery = await dbStore.collection<Product>('products').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    let categories = categoriesQuery.data;

    // Automatic migration / seed: If there are existing products with categories not yet in the categories collection, auto-create them!
    const existingCategoryNames = new Set(categories.map(c => c.name.toLowerCase()));
    const productCategoryNames = new Set(productsQuery.data.map(p => p.category).filter(Boolean));

    for (const catName of productCategoryNames) {
      if (!existingCategoryNames.has(catName.toLowerCase())) {
        const now = new Date().toISOString();
        const created = await dbStore.collection<ProductCategory>('categories').create({
          shopId,
          name: catName,
          description: `Category auto-synced from catalog products`,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        categories.push(created);
        existingCategoryNames.add(catName.toLowerCase());
      }
    }

    // Default categories if shop has no categories at all
    if (categories.length === 0) {
      const defaultCategories = ['Papers', 'Printing Supplies', 'Merchandise', 'Packaging'];
      const now = new Date().toISOString();
      for (const defCat of defaultCategories) {
        const created = await dbStore.collection<ProductCategory>('categories').create({
          shopId,
          name: defCat,
          description: `Standard category for print & shop management`,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        categories.push(created);
      }
    }

    // Attach real-time product count
    const enriched = categories.map(cat => {
      const count = productsQuery.data.filter(
        p => p.category && p.category.toLowerCase() === cat.name.toLowerCase()
      ).length;
      return {
        ...cat,
        productCount: count,
      };
    });

    let results = enriched;
    if (search) {
      const q = (search as string).toLowerCase();
      results = results.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return sendSuccess(res, results);
  }

  static async getCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const category = await dbStore.collection<ProductCategory>('categories').get(id);
    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Category not found', 404);
    }

    const productsQuery = await dbStore.collection<Product>('products').query({
      where: [
        { field: 'shopId', op: '==', value: category.shopId },
        { field: 'category', op: '==', value: category.name },
      ],
    });

    return sendSuccess(res, {
      ...category,
      productCount: productsQuery.data.length,
      products: productsQuery.data,
    });
  }

  static async createCategory(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { name, description, status = 'active' } = req.body;
    const trimmedName = name.trim();

    // Check duplicate name in shop
    const existing = await dbStore.collection<ProductCategory>('categories').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    if (existing.data.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      return sendError(res, 'DUPLICATE_CATEGORY', `Category "${trimmedName}" already exists in your shop.`, 400);
    }

    const now = new Date().toISOString();
    const category = await dbStore.collection<ProductCategory>('categories').create({
      shopId,
      name: trimmedName,
      description: description?.trim() || '',
      status: status || 'active',
      createdAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_CATEGORY',
      entity: 'categories',
      entityId: category.id,
      shopId,
      after: category,
    });

    return sendSuccess(res, { ...category, productCount: 0 }, undefined, 201);
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shopId = req.shopId;
    const category = await dbStore.collection<ProductCategory>('categories').get(id);
    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Category not found', 404);
    }

    const { name, description, status } = req.body;
    const trimmedName = name ? name.trim() : category.name;
    const oldName = category.name;

    // Check duplicate name if renaming
    if (trimmedName.toLowerCase() !== oldName.toLowerCase()) {
      const existing = await dbStore.collection<ProductCategory>('categories').query({
        where: [{ field: 'shopId', op: '==', value: category.shopId }],
      });
      if (existing.data.some(c => c.id !== id && c.name.toLowerCase() === trimmedName.toLowerCase())) {
        return sendError(res, 'DUPLICATE_CATEGORY', `Another category named "${trimmedName}" already exists.`, 400);
      }
    }

    const now = new Date().toISOString();
    const updated = await dbStore.collection<ProductCategory>('categories').update(id, {
      name: trimmedName,
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(status !== undefined ? { status } : {}),
      updatedAt: now,
    });

    // If category name was renamed, cascade rename to all products using the old name
    if (trimmedName !== oldName) {
      const productsToUpdate = await dbStore.collection<Product>('products').query({
        where: [
          { field: 'shopId', op: '==', value: category.shopId },
          { field: 'category', op: '==', value: oldName },
        ],
      });

      for (const p of productsToUpdate.data) {
        await dbStore.collection<Product>('products').update(p.id, {
          category: trimmedName,
          updatedAt: now,
        });
      }
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_CATEGORY',
      entity: 'categories',
      entityId: id,
      shopId: category.shopId,
      before: category,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shopId = req.shopId;
    const category = await dbStore.collection<ProductCategory>('categories').get(id);
    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Category not found', 404);
    }

    // Check if products currently use this category
    const productsUsingCategory = await dbStore.collection<Product>('products').query({
      where: [
        { field: 'shopId', op: '==', value: category.shopId },
        { field: 'category', op: '==', value: category.name },
      ],
    });

    if (productsUsingCategory.data.length > 0) {
      return sendError(
        res,
        'CATEGORY_IN_USE',
        `Cannot delete "${category.name}" because ${productsUsingCategory.data.length} product(s) are currently assigned to it. Please reassign or delete these products first.`,
        400
      );
    }

    await dbStore.collection<ProductCategory>('categories').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_CATEGORY',
      entity: 'categories',
      entityId: id,
      shopId: category.shopId,
      before: category,
    });

    return sendSuccess(res, { deleted: true, id });
  }
}
