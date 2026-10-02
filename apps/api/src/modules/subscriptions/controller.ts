import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Subscription, SubscriptionPackage, Shop } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';
import { EmailService } from '../../services/email.service';

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

  static async downgradeSubscription(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'No shop assigned to your account', 400);

    const { packageId } = req.body;
    if (!packageId) return sendError(res, 'BAD_REQUEST', 'Target package ID is required', 400);

    const targetPkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
    if (!targetPkg) return sendError(res, 'NOT_FOUND', 'Target subscription package not found', 404);

    const shop = await dbStore.collection<Shop>('shops').get(shopId);
    if (!shop) return sendError(res, 'NOT_FOUND', 'Shop not found', 404);

    if (!shop.subscriptionId) {
      return sendError(res, 'NOT_FOUND', 'Active subscription not found for this shop', 404);
    }

    const currentSub = await dbStore.collection<Subscription>('subscriptions').get(shop.subscriptionId);
    if (!currentSub) return sendError(res, 'NOT_FOUND', 'Current subscription not found', 404);

    // Verify it is a downgrade or free plan switch
    const isDowngradeOrFree = targetPkg.price <= currentSub.price || targetPkg.price === 0;
    if (!isDowngradeOrFree) {
      return sendError(
        res,
        'UPGRADE_REQUIRED',
        `Selected package "${targetPkg.name}" ($${targetPkg.price}) is higher tier than your current plan ($${currentSub.price}). Please proceed through the standard payment upgrade process.`,
        400
      );
    }

    // CRITICAL REQUIREMENT:
    // When a plan is downgraded, the existing subscription expiry date should remain unchanged.
    // The expiry date should not be reset or extended because of the downgrade.
    // The new/downgraded plan should take effect according to the existing subscription period and expiry date.
    const preservedExpiryAt = currentSub.expiryAt;

    const updatedSub = await dbStore.collection<Subscription>('subscriptions').update(currentSub.id, {
      packageId: targetPkg.id,
      packageName: targetPkg.name,
      limits: targetPkg.limits,
      price: targetPkg.price,
      expiryAt: preservedExpiryAt, // STRICTLY PRESERVED AND UNCHANGED!
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    // Synchronize shop package details
    await dbStore.collection<Shop>('shops').update(shopId, {
      packageId: targetPkg.id,
      packageName: targetPkg.name,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'DOWNGRADE_SUBSCRIPTION',
      entity: 'subscriptions',
      entityId: currentSub.id,
      shopId,
      before: {
        packageId: currentSub.packageId,
        packageName: currentSub.packageName,
        price: currentSub.price,
        expiryAt: currentSub.expiryAt,
      },
      after: {
        packageId: targetPkg.id,
        packageName: targetPkg.name,
        price: targetPkg.price,
        expiryAt: preservedExpiryAt,
      },
    });

    // Dispatch plan downgrade confirmation email
    const ownerEmail = shop.ownerEmail || shop.email;
    if (ownerEmail) {
      await EmailService.sendDowngradeConfirmationEmail({
        email: ownerEmail,
        name: shop.ownerName || req.user?.name || 'Shop Owner',
        shopName: shop.name,
        oldPackageName: currentSub.packageName || 'Previous Plan',
        newPackageName: targetPkg.name,
        expiryDate: new Date(preservedExpiryAt).toLocaleDateString(),
        shopId,
        userId: shop.ownerId,
      });
    }

    return sendSuccess(res, updatedSub, {
      message: `Your subscription has been successfully downgraded to ${targetPkg.name}. Your active billing cycle and expiry date (${new Date(preservedExpiryAt).toLocaleDateString()}) remain unchanged.`,
    });
  }

  static async checkExpiringSubscriptions(req: AuthenticatedRequest, res: Response) {
    const allSubs = await dbStore.collection<Subscription>('subscriptions').query({
      where: [{ field: 'status', op: '==', value: 'active' }],
    });

    let notifiedCount = 0;
    const now = Date.now();

    for (const sub of allSubs.data) {
      const expiryTime = new Date(sub.expiryAt).getTime();
      const diffMs = expiryTime - now;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // If expiring within 7 days or already expired
      if (daysRemaining <= 7) {
        const shop = await dbStore.collection<Shop>('shops').get(sub.shopId);
        const ownerEmail = shop?.ownerEmail || shop?.email;

        if (ownerEmail && shop) {
          await EmailService.sendPlanExpiryReminderEmail({
            email: ownerEmail,
            name: shop.ownerName || 'Shop Owner',
            shopName: shop.name,
            packageName: sub.packageName || 'Standard Tier',
            daysRemaining,
            expiryDate: new Date(sub.expiryAt).toLocaleDateString(),
            isExpired: daysRemaining <= 0,
            shopId: sub.shopId,
            userId: shop.ownerId,
          });
          notifiedCount++;
        }
      }
    }

    return sendSuccess(res, {
      scannedCount: allSubs.data.length,
      notifiedCount,
      timestamp: new Date().toISOString(),
    });
  }
}
