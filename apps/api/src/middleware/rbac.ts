import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole } from '@saas/types';
import { sendError } from '../utils/response';

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const userRoles = [
      req.user.role,
      ...(Array.isArray((req.user as any).roles) ? (req.user as any).roles : []),
    ];

    const hasAllowedRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasAllowedRole) {
      return sendError(
        res,
        'FORBIDDEN',
        `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
};

export const isSuperAdmin = requireRole(['super_admin']);
export const isShopOwnerOrAbove = requireRole(['super_admin', 'shop_owner']);
export const isManagerOrAbove = requireRole(['super_admin', 'shop_owner', 'manager']);
export const isShopStaff = requireRole([
  'super_admin',
  'shop_owner',
  'manager',
  'sales_staff',
  'inventory_staff',
  'purchasing_staff',
  'worker',
]);
