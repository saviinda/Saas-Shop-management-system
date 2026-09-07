import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { dbStore } from '../db/store';
import { User } from '@saas/types';
import { sendError } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: User;
  shopId?: string;
  branchId?: string;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Missing or invalid authorization token', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
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
      return sendError(res, 'ACCOUNT_INACTIVE', 'User account is inactive or suspended', 403);
    }

    req.user = user;
    req.shopId = user.shopId;
    
    // Check if client passed active branch in header
    const branchHeader = req.headers['x-branch-id'] as string;
    if (branchHeader) {
      req.branchId = branchHeader;
    }

    next();
  } catch (error) {
    return sendError(res, 'INVALID_TOKEN', 'Token has expired or is invalid', 401);
  }
};
