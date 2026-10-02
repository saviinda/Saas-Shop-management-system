import { Response } from 'express';
import { dbStore } from '../../db/store';
import { AppNotification } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import { NotificationHub } from '../../services/notificationHub.service';

export class NotificationController {
  static async listNotifications(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const isSuperAdmin = req.user?.role === 'super_admin';

    let notifications: AppNotification[] = [];

    if (isSuperAdmin) {
      // Super admin can see notifications sent to their userId OR sent globally to 'super_admin'
      const userNotifs = await dbStore.collection<AppNotification>('notifications').query({
        where: [{ field: 'recipientId', op: '==', value: userId }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      const globalAdminNotifs = await dbStore.collection<AppNotification>('notifications').query({
        where: [{ field: 'recipientId', op: '==', value: 'super_admin' }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      const combinedMap = new Map<string, AppNotification>();
      userNotifs.data.forEach(n => combinedMap.set(n.id, n));
      globalAdminNotifs.data.forEach(n => combinedMap.set(n.id, n));

      notifications = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      const userNotifs = await dbStore.collection<AppNotification>('notifications').query({
        where: [{ field: 'recipientId', op: '==', value: userId }],
        orderBy: { field: 'createdAt', direction: 'desc' },
        limit: 50,
      });
      notifications = userNotifs.data;
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return sendSuccess(res, {
      notifications: notifications.slice(0, 50),
      unreadCount,
    });
  }

  static async streamNotifications(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const role = req.user!.role;
    const shopId = req.user!.shopId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const connectionId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    NotificationHub.addClient({
      id: connectionId,
      userId,
      role,
      shopId,
      res,
    });

    req.on('close', () => {
      NotificationHub.removeClient(connectionId);
    });
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (id === 'all') {
      const allNotifs = await dbStore.collection<AppNotification>('notifications').query({});
      for (const n of allNotifs.data) {
        if (n.recipientId === userId || (isSuperAdmin && n.recipientId === 'super_admin')) {
          if (!n.isRead) {
            await dbStore.collection<AppNotification>('notifications').update(n.id, { isRead: true });
          }
        }
      }
      NotificationHub.broadcastAllRead(userId);
      return sendSuccess(res, { success: true });
    }

    const notif = await dbStore.collection<AppNotification>('notifications').get(id);
    if (notif) {
      const updated = await dbStore.collection<AppNotification>('notifications').update(id, { isRead: true });
      NotificationHub.broadcastRead(userId, id);
      return sendSuccess(res, updated);
    }

    return sendSuccess(res, { success: true });
  }
}
