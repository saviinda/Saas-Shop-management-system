import { Response } from 'express';
import { dbStore } from '../../db/store';
import { ServiceItem } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';

export class ServiceController {
  static async listServices(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { category, status } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (category && category !== 'all') {
      where.push({ field: 'category', op: '==', value: category });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const services = await dbStore.collection<ServiceItem>('services').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, services.data);
  }

  static async createService(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    // Package limit check
    await PackageLimitService.checkServiceLimit(shopId);

    const { name, description, category, price, durationMinutes, assignedStaffIds, status } = req.body;

    const service = await dbStore.collection<ServiceItem>('services').create({
      shopId,
      name,
      description,
      category,
      price,
      durationMinutes,
      assignedStaffIds: assignedStaffIds || [],
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_SERVICE',
      entity: 'services',
      entityId: service.id,
      shopId,
      after: service,
    });

    return sendSuccess(res, service, undefined, 201);
  }

  static async updateService(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const service = await dbStore.collection<ServiceItem>('services').get(id);
    if (!service || (req.user?.role !== 'super_admin' && service.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Service not found', 404);
    }

    const updated = await dbStore.collection<ServiceItem>('services').update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SERVICE',
      entity: 'services',
      entityId: id,
      shopId: service.shopId,
      before: service,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deleteService(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const service = await dbStore.collection<ServiceItem>('services').get(id);
    if (!service || (req.user?.role !== 'super_admin' && service.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Service not found', 404);
    }

    await dbStore.collection<ServiceItem>('services').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_SERVICE',
      entity: 'services',
      entityId: id,
      shopId: service.shopId,
      before: service,
    });

    return sendSuccess(res, { deleted: true, id });
  }
}
