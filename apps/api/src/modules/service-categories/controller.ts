import { Response } from 'express';
import { dbStore } from '../../db/store';
import { ServiceCategory, ServiceItem } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class ServiceCategoryController {
  static async listServiceCategories(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { search, status } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const categoriesQuery = await dbStore.collection<ServiceCategory>('serviceCategories').query({
      where,
      orderBy: { field: 'name', direction: 'asc' },
    });

    // Query services to compute real-time service count per category
    const servicesQuery = await dbStore.collection<ServiceItem>('services').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    const categories = categoriesQuery.data || [];

    // Attach real-time service count (DO NOT seed any default categories; starts empty)
    const enriched = categories.map(cat => {
      const count = servicesQuery.data.filter(
        s => s.category && s.category.toLowerCase() === cat.name.toLowerCase()
      ).length;
      return {
        ...cat,
        serviceCount: count,
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

  static async getServiceCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const category = await dbStore.collection<ServiceCategory>('serviceCategories').get(id);

    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Service category not found', 404);
    }

    const services = await dbStore.collection<ServiceItem>('services').query({
      where: [
        { field: 'shopId', op: '==', value: category.shopId },
        { field: 'category', op: '==', value: category.name },
      ],
    });

    return sendSuccess(res, {
      ...category,
      serviceCount: services.data.length,
      services: services.data,
    });
  }

  static async createServiceCategory(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { name, description, status = 'active' } = req.body;

    // Check duplicate category name within this shop
    const existing = await dbStore.collection<ServiceCategory>('serviceCategories').query({
      where: [
        { field: 'shopId', op: '==', value: shopId },
        { field: 'name', op: '==', value: name.trim() },
      ],
    });

    if (existing.data.length > 0) {
      return sendError(res, 'CONFLICT', `Service Category "${name}" already exists.`, 409);
    }

    const now = new Date().toISOString();
    const category = await dbStore.collection<ServiceCategory>('serviceCategories').create({
      shopId,
      name: name.trim(),
      description: description?.trim() || undefined,
      status,
      createdAt: now,
      updatedAt: now,
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_SERVICE_CATEGORY',
      entity: 'serviceCategories',
      entityId: category.id,
      shopId,
      after: category,
    });

    return sendSuccess(res, category, undefined, 201);
  }

  static async updateServiceCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const category = await dbStore.collection<ServiceCategory>('serviceCategories').get(id);

    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Service category not found', 404);
    }

    const { name, description, status } = req.body;

    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const existing = await dbStore.collection<ServiceCategory>('serviceCategories').query({
        where: [
          { field: 'shopId', op: '==', value: category.shopId },
          { field: 'name', op: '==', value: name.trim() },
        ],
      });
      if (existing.data.some(c => c.id !== id)) {
        return sendError(res, 'CONFLICT', `Category name "${name}" is already in use`, 409);
      }
    }

    const oldName = category.name;
    const updated = await dbStore.collection<ServiceCategory>('serviceCategories').update(id, {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() || undefined }),
      ...(status && { status }),
      updatedAt: new Date().toISOString(),
    });

    // If category name was renamed, cascade update services in this shop
    if (name && name.trim() !== oldName) {
      const services = await dbStore.collection<ServiceItem>('services').query({
        where: [
          { field: 'shopId', op: '==', value: category.shopId },
          { field: 'category', op: '==', value: oldName },
        ],
      });
      for (const srv of services.data) {
        await dbStore.collection<ServiceItem>('services').update(srv.id, {
          category: name.trim(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SERVICE_CATEGORY',
      entity: 'serviceCategories',
      entityId: id,
      shopId: category.shopId,
      before: category,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteServiceCategory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const category = await dbStore.collection<ServiceCategory>('serviceCategories').get(id);

    if (!category || (req.user?.role !== 'super_admin' && category.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Service category not found', 404);
    }

    // Check if any services are currently assigned to this category
    const services = await dbStore.collection<ServiceItem>('services').query({
      where: [
        { field: 'shopId', op: '==', value: category.shopId },
        { field: 'category', op: '==', value: category.name },
      ],
    });

    if (services.data.length > 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        `Cannot delete category "${category.name}" because ${services.data.length} service(s) are assigned to it. Please reassign or delete them first.`,
        400
      );
    }

    await dbStore.collection<ServiceCategory>('serviceCategories').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_SERVICE_CATEGORY',
      entity: 'serviceCategories',
      entityId: id,
      shopId: category.shopId,
      before: category,
    });

    return sendSuccess(res, { deleted: true, id });
  }
}
