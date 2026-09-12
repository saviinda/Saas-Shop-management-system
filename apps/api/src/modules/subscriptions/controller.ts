import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Subscription, SubscriptionPackage, Shop } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';

export class SubscriptionController {
  static async getMySubscription(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'No shop assigned', 400);

    const usageInfo = await PackageLimitService.getPackageUsage(shopId);
    return sendSuccess(res, usageInfo);
  }

  static async listSubscriptions(req: AuthenticatedRequest, res: Response) {
    const { status, search, page = '1', limit = '50' } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [];
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const subscriptions = await dbStore.collection<Subscription>('subscriptions').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let enriched = await Promise.all(
      subscriptions.data.map(async sub => {
        const shop = await dbStore.collection<Shop>('shops').get(sub.shopId);
        return {
          ...sub,
          shop: shop || null,
          shopName: shop?.name || 'Unknown',
          ownerName: shop?.ownerName || 'Unknown',
          ownerEmail: shop?.ownerEmail || shop?.email || '',
        };
      })
    );

    if (search) {
      const q = (search as string).toLowerCase();
      enriched = enriched.filter(
        s =>
          s.shopName.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q) ||
          s.packageName?.toLowerCase().includes(q)
      );
    }

    return sendSuccess(res, enriched, { total: enriched.length });
  }

  static async updateSubscription(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const existing = await dbStore.collection<Subscription>('subscriptions').get(id);
    if (!existing) return sendError(res, 'NOT_FOUND', 'Subscription not found', 404);

    const {
      packageId,
      packageName,
      price,
      limits,
      expiryAt,
      startAt,
      status,
      autoRenew,
    } = req.body;

    let updatedLimits = limits || existing.limits;
    let finalPackageName = packageName || existing.packageName;

    // If packageId changed, load package details if limits not explicitly provided
    if (packageId && packageId !== existing.packageId) {
      const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
      if (pkg) {
        finalPackageName = pkg.name;
        if (!limits) {
          updatedLimits = pkg.limits;
        }
      }
    }

    const updated = await dbStore.collection<Subscription>('subscriptions').update(id, {
      ...(packageId && { packageId }),
      packageName: finalPackageName,
      ...(price !== undefined && { price: Number(price) }),
      ...(updatedLimits && { limits: updatedLimits }),
      ...(expiryAt && { expiryAt }),
      ...(startAt && { startAt }),
      ...(status && { status }),
      ...(autoRenew !== undefined && { autoRenew: Boolean(autoRenew) }),
      updatedAt: new Date().toISOString(),
    });

    // Synchronize package on the associated Shop
    if (existing.shopId) {
      await dbStore.collection<Shop>('shops').update(existing.shopId, {
        ...(packageId && { packageId }),
        ...(finalPackageName && { packageName: finalPackageName }),
        updatedAt: new Date().toISOString(),
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SUBSCRIPTION',
      entity: 'subscriptions',
      entityId: id,
      shopId: existing.shopId,
      before: existing,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async updateSubscriptionStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    const existing = await dbStore.collection<Subscription>('subscriptions').get(id);
    if (!existing) return sendError(res, 'NOT_FOUND', 'Subscription not found', 404);

    const updated = await dbStore.collection<Subscription>('subscriptions').update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: `SUBSCRIPTION_STATUS_${status.toUpperCase()}`,
      entity: 'subscriptions',
      entityId: id,
      shopId: existing.shopId,
      before: { status: existing.status },
      after: { status },
    });

    return sendSuccess(res, updated);
  }
}
