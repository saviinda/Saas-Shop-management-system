import { Response } from 'express';
import { dbStore } from '../../db/store';
import { AuditLog } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export class AuditLogController {
  static async listLogs(req: AuthenticatedRequest, res: Response) {
    const { action, entity, shopId: queryShopId } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];
    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    } else if (queryShopId) {
      where.push({ field: 'shopId', op: '==', value: queryShopId });
    }

    if (action && action !== 'all') {
      where.push({ field: 'action', op: '==', value: action });
    }
    if (entity && entity !== 'all') {
      where.push({ field: 'entity', op: '==', value: entity });
    }

    const logs = await dbStore.collection<AuditLog>('auditLogs').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 100,
    });

    return sendSuccess(res, logs.data);
  }
}
