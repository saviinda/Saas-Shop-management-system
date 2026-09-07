import { dbStore } from '../db/store';
import { AuditLog, User } from '@saas/types';

export class AuditLogService {
  static async log(params: {
    actor: User;
    action: string;
    entity: string;
    entityId: string;
    shopId?: string;
    before?: any;
    after?: any;
    ipAddress?: string;
  }) {
    try {
      await dbStore.collection<AuditLog>('auditLogs').create({
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorRole: params.actor.role,
        shopId: params.shopId || params.actor.shopId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
        after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
        ipAddress: params.ipAddress,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}
