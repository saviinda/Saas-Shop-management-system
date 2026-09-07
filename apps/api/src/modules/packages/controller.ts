import { Request, Response } from 'express';
import { dbStore } from '../../db/store';
import { SubscriptionPackage } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class PackageController {
  static async listPackages(req: Request, res: Response) {
    const packages = await dbStore.collection<SubscriptionPackage>('packages').query({
      orderBy: { field: 'price', direction: 'asc' },
    });
    return sendSuccess(res, packages.data);
  }

  static async getPackage(req: Request, res: Response) {
    const { id } = req.params;
    const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(id);
    if (!pkg) return sendError(res, 'NOT_FOUND', 'Package not found', 404);
    return sendSuccess(res, pkg);
  }

  static async createPackage(req: AuthenticatedRequest, res: Response) {
    const { name, description, price, durationDays, limits, features, status } = req.body;

    const pkg = await dbStore.collection<SubscriptionPackage>('packages').create({
      name,
      description,
      price,
      durationDays: durationDays || 30,
      limits,
      features,
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_PACKAGE',
      entity: 'packages',
      entityId: pkg.id,
      after: pkg,
    });

    return sendSuccess(res, pkg, undefined, 201);
  }

  static async updatePackage(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const existing = await dbStore.collection<SubscriptionPackage>('packages').get(id);
    if (!existing) return sendError(res, 'NOT_FOUND', 'Package not found', 404);

    const updated = await dbStore.collection<SubscriptionPackage>('packages').update(id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_PACKAGE',
      entity: 'packages',
      entityId: id,
      before: existing,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async deletePackage(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const existing = await dbStore.collection<SubscriptionPackage>('packages').get(id);
    if (!existing) return sendError(res, 'NOT_FOUND', 'Package not found', 404);

    await dbStore.collection<SubscriptionPackage>('packages').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_PACKAGE',
      entity: 'packages',
      entityId: id,
      before: existing,
    });

    return sendSuccess(res, { message: 'Package successfully deleted', id });
  }
}
