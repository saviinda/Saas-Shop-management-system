import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { dbStore } from '../db/store';
import { User, Shop } from '@saas/types';
import { sendError } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: User;
  shopId?: string;
  branchId?: string;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return sendError(res, 'UNAUTHORIZED', 'Missing or invalid authorization token', 401);
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string; iat?: number };
    let user: User | null = null;
    
    if (decoded.id) {
      user = await dbStore.collection<User>('users').get(decoded.id);
    }

    // Fallback: Lookup by email if ID not found directly
    if (!user && decoded.email) {
      const usersByEmail = await dbStore.collection<User>('users').query({
        where: [{ field: 'email', op: '==', value: decoded.email.trim().toLowerCase() }],
      });
      if (usersByEmail.data.length > 0) {
        user = usersByEmail.data[0];
      }
    }

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User account not found', 401);
    }

    if (user.status !== 'active') {
      return sendError(res, 'ACCOUNT_INACTIVE', 'Your account is inactive and access is restricted. Please contact platform support.', 403);
    }

    // Check if user session has been revoked
    if (user.sessionsInvalidatedAt && decoded.iat) {
      const userInvalidationSec = Math.floor(new Date(user.sessionsInvalidatedAt).getTime() / 1000);
      if (decoded.iat < userInvalidationSec) {
        return sendError(res, 'TOKEN_REVOKED', 'Your account is inactive and access is restricted. Please contact platform support.', 401);
      }
    }

    // Validate Shop status for shop-scoped users
    if (user.shopId && user.role !== 'super_admin') {
      const shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (!shop || shop.status === 'inactive') {
        return sendError(res, 'SHOP_INACTIVE', 'Your account is inactive and access is restricted. Please contact platform support.', 403);
      }
      if (shop.status === 'suspended') {
        return sendError(res, 'SHOP_SUSPENDED', 'Your account is inactive and access is restricted. Please contact platform support.', 403);
      }

      // Check if shop sessions were revoked
      if (shop.sessionsInvalidatedAt && decoded.iat) {
        const shopInvalidationSec = Math.floor(new Date(shop.sessionsInvalidatedAt).getTime() / 1000);
        if (decoded.iat < shopInvalidationSec) {
          return sendError(res, 'TOKEN_REVOKED', 'Your account is inactive and access is restricted. Please contact platform support.', 401);
        }
      }
    }

    req.user = user;
    req.shopId = user.shopId;
    
    // Check if client passed active branch in header
    const branchHeader = req.headers['x-branch-id'] as string;
    if (branchHeader) {
      req.branchId = branchHeader;
    }

    next();
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.', 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Token has expired or is invalid', 401);
  }
};
