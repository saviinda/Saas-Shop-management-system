import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { dbStore } from '../db/store';
import { Shop } from '@saas/types';
import { sendError } from '../utils/response';

export const requireTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === 'super_admin') {
    return next();
  }

  const shopId = req.user?.shopId;
  if (!shopId) {
    return sendError(res, 'NO_SHOP_ASSIGNED', 'No shop associated with this user account', 403);
  }

  const shop = await dbStore.collection<Shop>('shops').get(shopId);
  if (!shop) {
    return sendError(res, 'SHOP_NOT_FOUND', 'Shop does not exist', 404);
  }

  if (shop.status === 'suspended' || shop.status === 'inactive') {
    return sendError(res, 'SHOP_SUSPENDED', 'Shop access is currently suspended or inactive. Please contact support.', 403);
  }

  req.shopId = shopId;
  next();
};

export const requireBranchAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === 'super_admin' || req.user?.role === 'shop_owner') {
    return next();
  }

  const targetBranchId = req.branchId || (req.body?.branchId as string) || (req.params?.branchId as string);
  if (targetBranchId && req.user?.branchIds && !req.user.branchIds.includes(targetBranchId)) {
    return sendError(res, 'BRANCH_ACCESS_DENIED', 'You do not have access to operations for this branch', 403);
  }

  next();
};
