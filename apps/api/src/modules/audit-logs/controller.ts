import { Response } from 'express';
import { dbStore } from '../../db/store';
import { AuditLog } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export class AuditLogController {
  static async listLogs(req: AuthenticatedRequest, res: Response) {
    const {
      action,
      entity,
      shopId: queryShopId,
      userId,
      user: queryUser,
      startDate,
      endDate,
      date,
      search,
      page,
      limit,
    } = req.query;

    let baseWhere: Array<{ field: string; op: any; value: any }> = [];
    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, [], { total: 0 });
      baseWhere.push({ field: 'shopId', op: '==', value: req.shopId });
    } else if (queryShopId && queryShopId !== 'all') {
      baseWhere.push({ field: 'shopId', op: '==', value: queryShopId });
    }

    const allLogs = await dbStore.collection<AuditLog>('auditLogs').query({
      where: baseWhere,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    // Extract dynamic options for frontend filters
    const availableActorsMap = new Map<string, { id: string; name: string; role?: string }>();
    const availableActionsSet = new Set<string>();

    allLogs.data.forEach(l => {
      if (l.action) availableActionsSet.add(l.action);
      const actorKey = l.actorId || l.actorName;
      if (actorKey && !availableActorsMap.has(actorKey)) {
        availableActorsMap.set(actorKey, {
          id: actorKey,
          name: l.actorName || l.actorId,
          role: l.actorRole,
        });
      }
    });

    let filtered = allLogs.data;

    // Filter by User (actorId or actorName)
    const targetUser = (userId || queryUser || '') as string;
    if (targetUser && targetUser !== 'all') {
      filtered = filtered.filter(l =>
        l.actorId === targetUser ||
        l.actorName === targetUser ||
        (l.actorName && l.actorName.toLowerCase() === targetUser.toLowerCase())
      );
    }

    // Filter by Action
    if (action && action !== 'all') {
      filtered = filtered.filter(l => l.action === action);
    }

    // Filter by Entity
    if (entity && entity !== 'all') {
      filtered = filtered.filter(l => l.entity === entity);
    }

    // Filter by specific Date (YYYY-MM-DD)
    if (date && typeof date === 'string') {
      filtered = filtered.filter(l => {
        if (!l.createdAt) return false;
        return l.createdAt.startsWith(date);
      });
    }

    // Filter by Date Range (startDate and/or endDate)
    if (startDate && typeof startDate === 'string') {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter(l => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() >= startMs;
      });
    }
    if (endDate && typeof endDate === 'string') {
      // Include the entire end day up to 23:59:59.999
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      const endMs = endD.getTime();
      filtered = filtered.filter(l => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() <= endMs;
      });
    }

    // Filter by Search Query
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.actorName?.toLowerCase().includes(q) ||
        l.actorRole?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q) ||
        l.entityId?.toLowerCase().includes(q) ||
        JSON.stringify(l.after || l.before || {}).toLowerCase().includes(q)
      );
    }

    const availableActors = Array.from(availableActorsMap.values());
    const availableActions = Array.from(availableActionsSet).sort();

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit as string, 10) || 20);
      const offset = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(offset, offset + limitNum);

      return sendSuccess(res, paginated, {
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum),
        availableActors,
        availableActions,
      });
    }

    return sendSuccess(res, filtered, {
      total: filtered.length,
      availableActors,
      availableActions,
    });
  }
}
