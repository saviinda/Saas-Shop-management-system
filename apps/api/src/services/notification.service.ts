import { dbStore } from '../db/store';
import { AppNotification, User } from '@saas/types';

export class NotificationService {
  static async create(params: {
    recipientId: string;
    shopId?: string;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'alert';
    link?: string;
  }) {
    try {
      await dbStore.collection<AppNotification>('notifications').create({
        recipientId: params.recipientId,
        shopId: params.shopId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        link: params.link,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }

  static async notifySuperAdmins(params: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'alert';
    link?: string;
  }) {
    try {
      const superAdmins = await dbStore.collection<User>('users').query({
        where: [{ field: 'role', op: '==', value: 'super_admin' }],
      });

      for (const admin of superAdmins.data) {
        await this.create({
          recipientId: admin.id,
          title: params.title,
          message: params.message,
          type: params.type || 'alert',
          link: params.link,
        });
      }
    } catch (err) {
      console.error('Failed to notify super admins:', err);
    }
  }

  static async notifyShopOwner(
    shopId: string,
    params: {
      title: string;
      message: string;
      type?: 'info' | 'warning' | 'success' | 'alert';
      link?: string;
    }
  ) {
    try {
      const owners = await dbStore.collection<User>('users').query({
        where: [
          { field: 'shopId', op: '==', value: shopId },
          { field: 'role', op: '==', value: 'shop_owner' },
        ],
      });

      for (const owner of owners.data) {
        await this.create({
          recipientId: owner.id,
          shopId,
          title: params.title,
          message: params.message,
          type: params.type || 'info',
          link: params.link,
        });
      }
    } catch (err) {
      console.error(`Failed to notify shop owner for shop ${shopId}:`, err);
    }
  }

  static async notifyShop(
    shopId: string,
    params: {
      title: string;
      message: string;
      type?: 'info' | 'warning' | 'success' | 'alert';
      link?: string;
    }
  ) {
    try {
      const users = await dbStore.collection<User>('users').query({
        where: [{ field: 'shopId', op: '==', value: shopId }],
      });

      for (const u of users.data) {
        await this.create({
          recipientId: u.id,
          shopId,
          title: params.title,
          message: params.message,
          type: params.type || 'info',
          link: params.link,
        });
      }
    } catch (err) {
      console.error(`Failed to notify shop staff for shop ${shopId}:`, err);
    }
  }

  static async broadcastSystemAnnouncement(params: {
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      const allUsers = await dbStore.collection<User>('users').query({
        where: [],
      });

      for (const u of allUsers.data) {
        await this.create({
          recipientId: u.id,
          shopId: u.shopId,
          title: params.title,
          message: params.message,
          type: 'info',
          link: params.link,
        });
      }
    } catch (err) {
      console.error('Failed to broadcast system announcement:', err);
    }
  }
}
