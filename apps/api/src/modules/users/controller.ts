import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbStore } from '../../db/store';
import { User, Branch, Shop, Subscription, SubscriptionPackage } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';
import { EmailService } from '../../services/email.service';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  shop_owner: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'communication', 'subscription', 'change-requests', 'information'],
  manager: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'communication'],
  sales_staff: ['dashboard', 'products', 'services', 'customers', 'orders', 'tasks'],
  inventory_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  purchasing_staff: ['dashboard', 'inventory', 'procurement', 'tasks'],
  worker: ['dashboard', 'orders', 'tasks'],
};

export class UserController {
  static async listUsers(req: AuthenticatedRequest, res: Response) {
    const { role, status, branchId, shopId: queryShopId, search, groupBy } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];

    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    } else if (queryShopId && queryShopId !== 'all') {
      where.push({ field: 'shopId', op: '==', value: queryShopId });
    }

    if (role && role !== 'all') {
      where.push({ field: 'role', op: '==', value: role });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const result = await dbStore.collection<User>('users').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let users = result.data.map(({ passwordHash, ...safe }: any) => safe);

    if (branchId && branchId !== 'all') {
      users = users.filter(u => u.branchIds?.includes(branchId as string));
    }

    if (search) {
      const q = (search as string).toLowerCase();
      users = users.filter(
        u =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.toLowerCase().includes(q))
      );
    }

    // Enrich users with shop names and branch names
    const enrichedUsers = await Promise.all(
      users.map(async u => {
        let shopName = 'Platform Admin';
        let shopCategory = '';
        let shopStatus = '';
        let packageName = '';

        if (u.shopId) {
          const shop = await dbStore.collection<Shop>('shops').get(u.shopId);
          if (shop) {
            shopName = shop.name;
            shopCategory = shop.category || '';
            shopStatus = shop.status || '';
            packageName = shop.packageName || '';
          }
        }

        let branchNames: string[] = [];
        if (u.branchIds && u.branchIds.length > 0) {
          const branches = await Promise.all(u.branchIds.map((bid: string) => dbStore.collection<Branch>('branches').get(bid)));
          branchNames = branches.filter(Boolean).map(b => b!.name);
        }

        return {
          ...u,
          permissions: u.permissions || DEFAULT_ROLE_PERMISSIONS[u.role] || [],
          shopName,
          shopCategory,
          shopStatus,
          packageName,
          branchNames,
          isOwner: u.role === 'shop_owner',
          isWorker: u.role !== 'shop_owner' && u.role !== 'super_admin',
        };
      })
    );

    // If super admin requested grouped by shop
    if (groupBy === 'shop' && req.user?.role === 'super_admin') {
      const allShops = await dbStore.collection<Shop>('shops').query();
      const shopMap: Record<string, { shop: Shop; owner: any; workers: any[] }> = {};

      allShops.data.forEach(s => {
        shopMap[s.id] = {
          shop: s,
          owner: null,
          workers: [],
        };
      });

      const superAdmins: any[] = [];

      enrichedUsers.forEach(u => {
        if (u.role === 'super_admin') {
          superAdmins.push(u);
        } else if (u.shopId && shopMap[u.shopId]) {
          if (u.role === 'shop_owner') {
            shopMap[u.shopId].owner = u;
          } else {
            shopMap[u.shopId].workers.push(u);
          }
        }
      });

      const grouped = Object.values(shopMap).filter(item => item.owner || item.workers.length > 0);

      return sendSuccess(res, {
        grouped,
        superAdmins,
        all: enrichedUsers,
      });
    }

    return sendSuccess(res, enrichedUsers);
  }

  static async listShopOwners(req: AuthenticatedRequest, res: Response) {
    const ownersRes = await dbStore.collection<User>('users').query({
      where: [{ field: 'role', op: '==', value: 'shop_owner' }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    const owners = ownersRes.data.map(({ passwordHash, ...safe }: any) => safe);

    const enrichedOwners = await Promise.all(
      owners.map(async owner => {
        let shop: Shop | null = null;
        let subscription: Subscription | null = null;
        let workersCount = 0;

        if (owner.shopId) {
          shop = await dbStore.collection<Shop>('shops').get(owner.shopId);
          if (shop?.subscriptionId) {
            subscription = await dbStore.collection<Subscription>('subscriptions').get(shop.subscriptionId);
          }

          const workersRes = await dbStore.collection<User>('users').query({
            where: [{ field: 'shopId', op: '==', value: owner.shopId }],
          });
          workersCount = workersRes.data.filter(u => u.role !== 'shop_owner').length;
        }

        return {
          ...owner,
          shop,
          subscription,
          workersCount,
          shopName: shop?.name || 'No Associated Shop',
          shopCategory: shop?.category || '',
          shopStatus: shop?.status || 'inactive',
          packageName: shop?.packageName || subscription?.packageName || 'Standard Plan',
        };
      })
    );

    return sendSuccess(res, enrichedOwners);
  }

  static async resetAccess(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { newPassword, reason } = req.body;

    const user = await dbStore.collection<User & { passwordHash?: string }>('users').get(id);
    if (!user) return sendError(res, 'NOT_FOUND', 'User account not found', 404);

    // Tenant isolation: non-super-admins can only reset their own shop employees
    if (req.user?.role !== 'super_admin' && user.shopId !== req.shopId) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this user account', 403);
    }

    const tempPassword = newPassword && newPassword.trim().length >= 6 ? newPassword.trim() : 'TempPass@' + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const updated = await dbStore.collection<User & { passwordHash?: string }>('users').update(id, {
      passwordHash,
      status: 'active', // Reactivate account if it was locked or suspended
      updatedAt: new Date().toISOString(),
    });

    let shopName = 'Platform';
    if (user.shopId) {
      const shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (shop) shopName = shop.name;
    }

    // Send reset email with credentials
    await EmailService.sendResetAccessEmail({
      email: user.email,
      name: user.name,
      userId: user.id,
      shopName,
      temporaryPassword: tempPassword,
      resetReason: reason || 'Administrator performed account access reset.',
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'RESET_USER_ACCESS',
      entity: 'users',
      entityId: id,
      shopId: user.shopId,
      after: { email: user.email, name: user.name, status: 'active', reason },
    });

    const { passwordHash: _, ...safeUser } = updated!;
    return sendSuccess(res, {
      user: safeUser,
      temporaryPassword: tempPassword,
      message: `Account access reset successfully. New credentials have been emailed to ${user.email}.`,
    });
  }

  static async getUserActivity(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const user = await dbStore.collection<User>('users').get(id);
    if (!user || (req.user?.role !== 'super_admin' && user.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const logsRes = await dbStore.collection<any>('auditLogs').query({
      where: [{ field: 'actor.id', op: '==', value: id }],
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit: 50,
    });

    return sendSuccess(res, logsRes.data);
  }

  static async createStaffUser(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID is required', 400);

    // Package limit check for users (BR-03, BR-09)
    try {
      await PackageLimitService.checkUserLimit(shopId);
    } catch (err: any) {
      return sendError(res, 'LIMIT_EXCEEDED', err.message || 'Staff user limit reached', 403);
    }

    const { name, email, password, phone, role, branchIds, branchId, permissions } = req.body;

    if (!email || !name || !password) {
      return sendError(res, 'BAD_REQUEST', 'Name, email, and password are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: normalizedEmail }],
    });

    if (existing.data.length > 0) {
      return sendError(res, 'EMAIL_EXISTS', 'Email is already registered to another account', 400);
    }

    // Determine branchIds
    let effectiveBranchIds: string[] = [];
    if (Array.isArray(branchIds) && branchIds.length > 0) {
      effectiveBranchIds = branchIds;
    } else if (branchId) {
      effectiveBranchIds = [branchId];
    } else {
      const shopBranches = await dbStore.collection<Branch>('branches').query({
        where: [{ field: 'shopId', op: '==', value: shopId }],
      });
      if (shopBranches.data.length > 0) {
        const defaultBranch = shopBranches.data.find(b => b.isDefault) || shopBranches.data[0];
        effectiveBranchIds = [defaultBranch.id];
      }
    }

    const selectedRole = role || 'sales_staff';
    const effectivePermissions = Array.isArray(permissions) && permissions.length > 0
      ? permissions
      : DEFAULT_ROLE_PERMISSIONS[selectedRole] || [];

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const user = await dbStore.collection<User & { passwordHash: string }>('users').create({
      email: normalizedEmail,
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      role: selectedRole,
      permissions: effectivePermissions,
      status: 'active',
      shopId,
      branchIds: effectiveBranchIds,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_STAFF_USER',
      entity: 'users',
      entityId: user.id,
      shopId,
      after: { name: user.name, email: user.email, role: user.role, branchIds: effectiveBranchIds, permissions: effectivePermissions },
    });

    const { passwordHash: _, ...safeUser } = user;
    return sendSuccess(res, safeUser, undefined, 201);
  }

  static async updateUserStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, role, branchIds, name, phone, email, permissions } = req.body;

    const user = await dbStore.collection<User>('users').get(id);
    if (!user || (req.user?.role !== 'super_admin' && user.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const updated = await dbStore.collection<User>('users').update(id, {
      ...(status && { status }),
      ...(role && { role }),
      ...(branchIds && { branchIds }),
      ...(name && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(permissions && { permissions }),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_USER',
      entity: 'users',
      entityId: id,
      shopId: user.shopId,
      before: user,
      after: updated,
    });

    const { passwordHash: _, ...safeUser } = updated as any;
    return sendSuccess(res, safeUser);
  }

  static async deleteStaffUser(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    const user = await dbStore.collection<User>('users').get(id);
    if (!user || (req.user?.role !== 'super_admin' && user.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    if (user.role === 'shop_owner' || user.role === 'super_admin') {
      return sendError(res, 'FORBIDDEN', 'Cannot delete primary owner or admin accounts', 403);
    }

    await dbStore.collection<User>('users').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_STAFF_USER',
      entity: 'users',
      entityId: id,
      shopId: user.shopId,
      before: user,
    });

    return sendSuccess(res, { message: 'Staff user deleted successfully', id });
  }
}
