import { dbStore } from '../db/store';
import { Shop, Subscription, SubscriptionPackage } from '@saas/types';

export class PackageLimitExceededError extends Error {
  public code = 'PACKAGE_LIMIT_EXCEEDED';
  public statusCode = 403;
  constructor(public resource: string, public current: number, public limit: number, message?: string) {
    super(message || `Your current package limit for ${resource} has been reached (${current}/${limit}). Please contact the Super Admin to upgrade your package.`);
  }
}

export class PackageLimitService {
  static async getActiveSubscription(shopId: string): Promise<{ subscription: Subscription; pkg: SubscriptionPackage } | null> {
    const shop = await dbStore.collection<Shop>('shops').get(shopId);
    if (!shop) return null;

    let sub: Subscription | null = null;
    if (shop.subscriptionId) {
      sub = await dbStore.collection<Subscription>('subscriptions').get(shop.subscriptionId);
    }

    if (!sub) {
      const subs = await dbStore.collection<Subscription>('subscriptions').query({
        where: [{ field: 'shopId', op: '==', value: shopId }],
      });
      sub = subs.data.find(s => s.status === 'active') || subs.data[0] || null;
    }

    let pkg: SubscriptionPackage | null = null;
    if (sub?.packageId) {
      pkg = await dbStore.collection<SubscriptionPackage>('packages').get(sub.packageId);
    } else if (shop.packageId) {
      pkg = await dbStore.collection<SubscriptionPackage>('packages').get(shop.packageId);
    }

    if (!pkg) {
      // Fallback default package
      pkg = {
        id: 'default-basic',
        name: 'Basic Plan',
        description: 'Starter plan',
        price: 0,
        durationDays: 30,
        limits: { shops: 1, branches: 1, users: 5, products: 100, services: 20, storageMb: 250 },
        features: ['basic_reports'],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (!sub) {
      sub = {
        id: 'sub-' + shopId,
        shopId,
        packageId: pkg.id,
        packageName: pkg.name,
        limits: pkg.limits,
        price: pkg.price,
        startAt: new Date().toISOString(),
        expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        autoRenew: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return { subscription: sub, pkg };
  }

  static async checkBranchLimit(shopId: string): Promise<void> {
    const planInfo = await this.getActiveSubscription(shopId);
    if (!planInfo) return;

    const currentBranches = await dbStore.collection('branches').count({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    const limit = planInfo.subscription.limits.branches || planInfo.pkg.limits.branches;
    if (currentBranches >= limit) {
      throw new PackageLimitExceededError('Branches', currentBranches, limit, 'Branch limit reached. You cannot create a new branch under your current plan.');
    }
  }

  static async checkUserLimit(shopId: string): Promise<void> {
    const planInfo = await this.getActiveSubscription(shopId);
    if (!planInfo) return;

    const currentUsers = await dbStore.collection('users').count({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    const limit = planInfo.subscription.limits.users || planInfo.pkg.limits.users;
    if (currentUsers >= limit) {
      throw new PackageLimitExceededError('Staff Users', currentUsers, limit, 'Staff user limit reached. You cannot add a new staff member under your current plan.');
    }
  }

  static async checkProductLimit(shopId: string): Promise<void> {
    const planInfo = await this.getActiveSubscription(shopId);
    if (!planInfo) return;

    const currentProducts = await dbStore.collection('products').count({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    const limit = planInfo.subscription.limits.products || planInfo.pkg.limits.products;
    if (currentProducts >= limit) {
      throw new PackageLimitExceededError('Products', currentProducts, limit, 'Product limit reached. You cannot create a new product under your current plan.');
    }
  }

  static async checkServiceLimit(shopId: string): Promise<void> {
    const planInfo = await this.getActiveSubscription(shopId);
    if (!planInfo) return;

    const currentServices = await dbStore.collection('services').count({
      where: [{ field: 'shopId', op: '==', value: shopId }],
    });

    const limit = planInfo.subscription.limits.services || planInfo.pkg.limits.services;
    if (currentServices >= limit) {
      throw new PackageLimitExceededError('Services', currentServices, limit, 'Service limit reached. You cannot create a new service under your current plan.');
    }
  }

  static async getPackageUsage(shopId: string) {
    const planInfo = await this.getActiveSubscription(shopId);
    const limits = planInfo?.subscription.limits || {
      shops: 1,
      branches: 1,
      users: 5,
      products: 100,
      services: 20,
      storageMb: 250,
    };

    const [branchesCount, usersCount, productsCount, servicesCount] = await Promise.all([
      dbStore.collection('branches').count({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection('users').count({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection('products').count({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection('services').count({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
    ]);

    return {
      package: planInfo?.pkg,
      subscription: planInfo?.subscription,
      usage: {
        branches: { current: branchesCount, limit: limits.branches, percent: Math.min(100, Math.round((branchesCount / limits.branches) * 100)) },
        users: { current: usersCount, limit: limits.users, percent: Math.min(100, Math.round((usersCount / limits.users) * 100)) },
        products: { current: productsCount, limit: limits.products, percent: Math.min(100, Math.round((productsCount / limits.products) * 100)) },
        services: { current: servicesCount, limit: limits.services, percent: Math.min(100, Math.round((servicesCount / limits.services) * 100)) },
      },
    };
  }
}
