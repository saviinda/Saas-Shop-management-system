import { Response } from 'express';
import { dbStore } from '../../db/store';
import { AuditLog } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export class AuditLogController {
  static async listLogs(req: AuthenticatedRequest, res: Response) {
    const { action, entity, shopId: queryShopId, search, page, limit } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];
    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    } else if (queryShopId && queryShopId !== 'all') {
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
    });

    let data = logs.data;
    if (search) {
      const q = (search as string).toLowerCase();
      data = data.filter(l =>
        l.actorName?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q) ||
        l.entityId?.toLowerCase().includes(q)
      );
    }

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 20);
      const offset = (pageNum - 1) * limitNum;
      const paginated = data.slice(offset, offset + limitNum);

      return sendSuccess(res, paginated, {
        total: data.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(data.length / limitNum),
      });
    }

    return sendSuccess(res, data, { total: data.length });
  }
}
