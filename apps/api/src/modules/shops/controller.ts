import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbStore } from '../../db/store';
import { Shop, Branch, Subscription, SubscriptionPackage, User, PaymentTransaction, AuditLog } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { PackageLimitService } from '../../services/packageLimit.service';
import { EmailService } from '../../services/email.service';

export class ShopController {
  static async listShops(req: AuthenticatedRequest, res: Response) {
    const { status, search, page = '1', limit = '100' } = req.query;

    if (req.user?.role !== 'super_admin') {
      if (!req.user?.shopId) {
        return sendSuccess(res, [], { total: 0 });
      }
      const myShop = await dbStore.collection<Shop>('shops').get(req.user.shopId);
      return sendSuccess(res, myShop ? [myShop] : [], { total: myShop ? 1 : 0 });
    }

    const where: Array<{ field: string; op: any; value: any }> = [];
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const result = await dbStore.collection<Shop>('shops').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let shops = result.data;
    if (search) {
      const q = (search as string).toLowerCase();
      shops = shops.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.ownerName?.toLowerCase().includes(q) ||
          s.ownerEmail?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
      );
    }

    const paginatedShops = shops.slice(offset, offset + limitNum);

    return sendSuccess(res, paginatedShops, {
      total: shops.length,
      page: pageNum,
      limit: limitNum,
    });
  }

  static async getShop(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    if (req.user?.role !== 'super_admin' && req.user?.shopId !== id) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this shop', 403);
    }

    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) {
      return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);
    }

    const [branches, usage, subscription, owner, usersRes, paymentsRes, auditLogsRes] = await Promise.all([
      dbStore.collection<Branch>('branches').query({ where: [{ field: 'shopId', op: '==', value: id }] }),
      PackageLimitService.getPackageUsage(id),
      shop.subscriptionId ? dbStore.collection<Subscription>('subscriptions').get(shop.subscriptionId) : null,
      shop.ownerId ? dbStore.collection<User>('users').get(shop.ownerId) : null,
      dbStore.collection<User>('users').query({ where: [{ field: 'shopId', op: '==', value: id }] }),
      dbStore.collection<PaymentTransaction>('payments').query({ where: [{ field: 'shopId', op: '==', value: id }], orderBy: { field: 'createdAt', direction: 'desc' } }),
      dbStore.collection<AuditLog>('auditLogs').query({ where: [{ field: 'shopId', op: '==', value: id }], orderBy: { field: 'createdAt', direction: 'desc' }, limit: 25 }),
    ]);

    const safeUsers = usersRes.data.map(({ passwordHash, ...safe }: any) => safe);
    const safeOwner = owner ? (({ passwordHash, ...safe }: any) => safe)(owner) : null;

    return sendSuccess(res, {
      shop,
      branches: branches.data,
      usage,
      subscription,
      owner: safeOwner,
      users: safeUsers,
      payments: paymentsRes.data,
      activity: auditLogsRes.data,
    });
  }

  static async createShop(req: AuthenticatedRequest, res: Response) {
    const {
      name,
      category,
      address,
      contactNumber,
      email,
      ownerName,
      ownerEmail,
      password,
      packageId,
      status = 'active',
      description,
    } = req.body;

    const normalizedEmail = (ownerEmail || email || '').trim().toLowerCase();

    const existingUsers = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: normalizedEmail }],
    });

    if (existingUsers.data.length > 0) {
      return sendError(res, 'EMAIL_EXISTS', 'Owner email is already registered to an existing account', 400);
    }

    const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
    if (!pkg) {
      return sendError(res, 'PACKAGE_NOT_FOUND', 'Selected subscription package does not exist', 400);
    }

    const passwordHash = await bcrypt.hash(password || 'Shop@123456', 10);
    const userId = 'usr_' + Date.now();
    const shopId = 'shp_' + Date.now();
    const branchId = 'br_' + Date.now();
    const subId = 'sub_' + Date.now();

    // 1. Create Default Branch
    const branch = await dbStore.collection<Branch>('branches').create({
      id: branchId,
      shopId,
      name: `${name} - Main Branch`,
      code: 'MAIN-01',
      address: address || 'Main Commercial Street',
      phone: contactNumber || '+1 555 000 0000',
      isDefault: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Create Subscription
    const subscription = await dbStore.collection<Subscription>('subscriptions').create({
      id: subId,
      shopId,
      packageId: pkg.id,
      packageName: pkg.name,
      limits: pkg.limits,
      price: pkg.price,
      startAt: new Date().toISOString(),
      expiryAt: new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000).toISOString(),
      status: status === 'active' ? 'active' : 'pending',
      autoRenew: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Create Shop
    const shop = await dbStore.collection<Shop>('shops').create({
      id: shopId,
      name,
      ownerId: userId,
      ownerName,
      ownerEmail: normalizedEmail,
      contactNumber,
      email: normalizedEmail,
      address,
      category: category || 'Retail Store',
      description: description || 'Active operational store',
      status: status || 'active',
      packageId: pkg.id,
      packageName: pkg.name,
      subscriptionId: subscription.id,
      defaultBranchId: branch.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Create Owner User
    const user = await dbStore.collection<User & { passwordHash: string }>('users').create({
      id: userId,
      email: normalizedEmail,
      name: ownerName,
      role: 'shop_owner',
      status: status === 'active' ? 'active' : 'inactive',
      shopId: shop.id,
      branchIds: [branch.id],
      phone: contactNumber,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Send welcome / credentials email
    await EmailService.sendEmail({
      to: normalizedEmail,
      recipientName: ownerName,
      subject: `Welcome to ${name} on SaaS Platform`,
      template: 'reset_access',
      data: {
        userId,
        name: ownerName,
        email: normalizedEmail,
        shopName: name,
        temporaryPassword: password || 'Shop@123456',
        resetReason: 'Account created by Super Administrator',
      },
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_SHOP_ADMIN',
      entity: 'shops',
      entityId: shop.id,
      shopId: shop.id,
      after: { shop, user: { id: user.id, email: user.email, name: user.name } },
    });

    const { passwordHash: _, ...safeUser } = user;
    return sendSuccess(res, { shop, user: safeUser, defaultBranch: branch, subscription }, undefined, 201);
  }

  static async updateShopAdmin(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);

    const {
      name,
      category,
      address,
      contactNumber,
      email,
      ownerName,
      ownerEmail,
      packageId,
      status,
      password,
      description,
    } = req.body;

    let packageName = shop.packageName;
    let subscriptionId = shop.subscriptionId;

    if (packageId && packageId !== shop.packageId) {
      const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
      if (pkg) {
        packageName = pkg.name;
        if (subscriptionId) {
          await dbStore.collection<Subscription>('subscriptions').update(subscriptionId, {
            packageId: pkg.id,
            packageName: pkg.name,
            limits: pkg.limits,
            price: pkg.price,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const updatedShop = await dbStore.collection<Shop>('shops').update(id, {
      ...(name && { name }),
      ...(category && { category }),
      ...(address && { address }),
      ...(contactNumber && { contactNumber }),
      ...(email && { email }),
      ...(ownerName && { ownerName }),
      ...(ownerEmail && { ownerEmail: ownerEmail.trim().toLowerCase() }),
      ...(packageId && { packageId }),
      ...(packageName && { packageName }),
      ...(status && { status }),
      ...(description !== undefined && { description }),
      updatedAt: new Date().toISOString(),
    });

    // Update associated Owner User if exists
    if (shop.ownerId) {
      const ownerUser = await dbStore.collection<User & { passwordHash?: string }>('users').get(shop.ownerId);
      if (ownerUser) {
        let newPasswordHash: string | undefined = undefined;
        if (password && password.trim().length >= 6) {
          newPasswordHash = await bcrypt.hash(password.trim(), 10);
        }

        await dbStore.collection<User & { passwordHash?: string }>('users').update(shop.ownerId, {
          ...(ownerName && { name: ownerName }),
          ...(ownerEmail && { email: ownerEmail.trim().toLowerCase() }),
          ...(contactNumber && { phone: contactNumber }),
          ...(status && { status: status === 'active' ? 'active' : 'inactive' }),
          ...(newPasswordHash && { passwordHash: newPasswordHash }),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SHOP_ADMIN',
      entity: 'shops',
      entityId: id,
      shopId: id,
      before: shop,
      after: updatedShop,
    });

    return sendSuccess(res, updatedShop);
  }

  static async updateShopStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, restrictionNotes } = req.body; // 'active' | 'suspended' | 'inactive' | 'restricted' | 'pending'

    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) {
      return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);
    }

    const updated = await dbStore.collection<Shop>('shops').update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    // Sync owner user status
    if (shop.ownerId) {
      await dbStore.collection<User>('users').update(shop.ownerId, {
        status: status === 'active' ? 'active' : status === 'suspended' ? 'suspended' : 'inactive',
        updatedAt: new Date().toISOString(),
      });

      // Send status notice email
      const ownerEmail = shop.ownerEmail || shop.email;
      if (ownerEmail) {
        await EmailService.sendAccountStatusEmail({
          email: ownerEmail,
          name: shop.ownerName || 'Shop Owner',
          userId: shop.ownerId,
          shopName: shop.name,
          status,
          reason: restrictionNotes || `Account status updated to ${status} by Super Administrator.`,
        });
      }
    }

    // Sync subscription status if activated
    if (status === 'active' && shop.subscriptionId) {
      await dbStore.collection<Subscription>('subscriptions').update(shop.subscriptionId, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: `SHOP_STATUS_${status.toUpperCase()}`,
      entity: 'shops',
      entityId: id,
      shopId: id,
      before: { status: shop.status },
      after: { status, restrictionNotes },
    });

    return sendSuccess(res, updated);
  }

  static async approveShopRegistration(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);

    const updatedShop = await dbStore.collection<Shop>('shops').update(id, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    if (shop.ownerId) {
      await dbStore.collection<User>('users').update(shop.ownerId, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    }

    if (shop.subscriptionId) {
      await dbStore.collection<Subscription>('subscriptions').update(shop.subscriptionId, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    }

    // Send email to owner
    const ownerEmail = shop.ownerEmail || shop.email;
    if (ownerEmail) {
      await EmailService.sendEmail({
        to: ownerEmail,
        recipientName: shop.ownerName,
        subject: `Registration Approved - ${shop.name} is now Active!`,
        template: 'account_status',
        data: {
          recipientId: shop.ownerId,
          name: shop.ownerName,
          shopName: shop.name,
          status: 'ACTIVATED',
          statusRaw: 'active',
          reason: 'Your shop registration has been approved by our platform administrator. You can now log in and start using your store.',
          link: '/login',
        },
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'APPROVE_SHOP_REGISTRATION',
      entity: 'shops',
      entityId: id,
      shopId: id,
      before: { status: shop.status },
      after: { status: 'active' },
    });

    return sendSuccess(res, {
      shop: updatedShop,
      message: `Shop "${shop.name}" and Owner registration approved successfully. Confirmation email sent.`,
    });
  }

  static async deleteShop(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);

    // Delete associated owner user if exists
    if (shop.ownerId) {
      await dbStore.collection<User>('users').delete(shop.ownerId);
    }

    // Delete all users in this shop
    const shopUsers = await dbStore.collection<User>('users').query({
      where: [{ field: 'shopId', op: '==', value: id }],
    });
    for (const u of shopUsers.data) {
      await dbStore.collection<User>('users').delete(u.id);
    }

    // Delete associated branches
    const branches = await dbStore.collection<Branch>('branches').query({
      where: [{ field: 'shopId', op: '==', value: id }],
    });
    for (const b of branches.data) {
      await dbStore.collection<Branch>('branches').delete(b.id);
    }

    // Delete associated subscription
    if (shop.subscriptionId) {
      await dbStore.collection<Subscription>('subscriptions').delete(shop.subscriptionId);
    }

    await dbStore.collection<Shop>('shops').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_SHOP',
      entity: 'shops',
      entityId: id,
      shopId: id,
      before: shop,
    });

    return sendSuccess(res, { message: 'Shop successfully deleted', id });
  }

  static async updateShopProfile(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    if (req.user?.role !== 'super_admin' && req.user?.shopId !== id) {
      return sendError(res, 'FORBIDDEN', 'Access denied', 403);
    }

    const shop = await dbStore.collection<Shop>('shops').get(id);
    if (!shop) return sendError(res, 'SHOP_NOT_FOUND', 'Shop not found', 404);

    const { name, category, description, openingHours, socialMedia, logoUrl, contactNumber, address } = req.body;

    const updated = await dbStore.collection<Shop>('shops').update(id, {
      ...(name && { name }),
      ...(category && { category }),
      ...(contactNumber && { contactNumber }),
      ...(address && { address }),
      ...(description !== undefined && { description }),
      ...(openingHours !== undefined && { openingHours }),
      ...(socialMedia && { socialMedia }),
      ...(logoUrl && { logoUrl }),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_SHOP_PROFILE',
      entity: 'shops',
      entityId: id,
      shopId: id,
      before: shop,
      after: updated,
    });

    return sendSuccess(res, updated);
  }
}
