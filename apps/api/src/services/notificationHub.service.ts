import { Response } from 'express';
import { AppNotification } from '@saas/types';

interface ConnectedClient {
  id: string;
  userId: string;
  role: string;
  shopId?: string;
  res: Response;
  heartbeatInterval: NodeJS.Timeout;
}

export class NotificationHub {
  private static clients: Map<string, ConnectedClient> = new Map();

  static addClient(params: {
    id: string;
    userId: string;
    role: string;
    shopId?: string;
    res: Response;
  }) {
    // Send keep-alive comment every 25 seconds
    const heartbeatInterval = setInterval(() => {
      try {
        params.res.write(': ping\n\n');
      } catch (err) {
        this.removeClient(params.id);
      }
    }, 25000);

    const client: ConnectedClient = {
      ...params,
      heartbeatInterval,
    };

    this.clients.set(params.id, client);
    console.log(`[NotificationHub] Client connected: ${params.userId} (${params.role}). Total active: ${this.clients.size}`);

    // Send initial connected payload
    try {
      params.res.write(`data: ${JSON.stringify({ type: 'connected', userId: params.userId, timestamp: new Date().toISOString() })}\n\n`);
    } catch (_) {}
  }

  static removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      clearInterval(client.heartbeatInterval);
      this.clients.delete(id);
      console.log(`[NotificationHub] Client disconnected: ${client.userId}. Remaining: ${this.clients.size}`);
    }
  }

  static broadcastNotification(notification: AppNotification) {
    const payload = `data: ${JSON.stringify({ type: 'new_notification', notification })}\n\n`;

    this.clients.forEach(client => {
      let shouldSend = false;

      if (notification.recipientId === client.userId) {
        shouldSend = true;
      } else if (notification.recipientId === 'super_admin' && client.role === 'super_admin') {
        shouldSend = true;
      } else if (notification.shopId && client.shopId === notification.shopId && (notification.recipientId === 'shop_broadcast' || !notification.recipientId)) {
        shouldSend = true;
      }

      if (shouldSend) {
        try {
          client.res.write(payload);
        } catch (err) {
          console.warn('[NotificationHub] Failed to send notification to client:', err);
          this.removeClient(client.id);
        }
      }
    });
  }

  static broadcastRead(userId: string, notificationId: string) {
    const payload = `data: ${JSON.stringify({ type: 'notification_read', id: notificationId })}\n\n`;
    this.clients.forEach(client => {
      if (client.userId === userId || client.role === 'super_admin') {
        try {
          client.res.write(payload);
        } catch (_) {
          this.removeClient(client.id);
        }
      }
    });
  }

  static broadcastAllRead(userId: string) {
    const payload = `data: ${JSON.stringify({ type: 'all_notifications_read', userId })}\n\n`;
    this.clients.forEach(client => {
      if (client.userId === userId || client.role === 'super_admin') {
        try {
          client.res.write(payload);
        } catch (_) {
          this.removeClient(client.id);
        }
      }
    });
  }
}
