import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbStore } from '../../db/store';
import { SupportTicket, TicketMessage, Shop, User } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { NotificationService } from '../../services/notification.service';
import { AuditLogService } from '../../services/auditLog.service';

export class CommunicationController {
  static async listTickets(req: AuthenticatedRequest, res: Response) {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const { status, category, priority } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];
    if (!isSuperAdmin) {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    }

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }
    if (category && category !== 'all') {
      where.push({ field: 'category', op: '==', value: category });
    }
    if (priority && priority !== 'all') {
      where.push({ field: 'priority', op: '==', value: priority });
    }

    const tickets = await dbStore.collection<SupportTicket>('conversations').query({
      where,
      orderBy: { field: 'updatedAt', direction: 'desc' },
    });

    return sendSuccess(res, tickets.data);
  }

  static async getTicket(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const ticket = await dbStore.collection<SupportTicket>('conversations').get(id);

    if (!ticket || (req.user?.role !== 'super_admin' && ticket.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Ticket not found', 404);
    }

    return sendSuccess(res, ticket);
  }

  static async createTicket(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { subject, category, priority = 'medium', message } = req.body;
    const shop = await dbStore.collection<Shop>('shops').get(shopId);

    const count = await dbStore.collection('conversations').count();
    const ticketNumber = `TICK-${(count + 1).toString().padStart(4, '0')}`;

    const initialMessage: TicketMessage = {
      id: uuidv4(),
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
      message,
      createdAt: new Date().toISOString(),
    };

    const ticket = await dbStore.collection<SupportTicket>('conversations').create({
      shopId,
      shopName: shop?.name || 'Shop',
      ticketNumber,
      subject,
      category,
      priority,
      status: 'open',
      messages: [initialMessage],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Notify Super Admins
    await NotificationService.notifySuperAdmins({
      title: 'New Support Ticket',
      message: `Shop "${shop?.name}" submitted ticket #${ticketNumber}: "${subject}"`,
      link: '/super-admin/communication',
    });

    return sendSuccess(res, ticket, undefined, 201);
  }

  static async replyTicket(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { message, status } = req.body;

    const ticket = await dbStore.collection<SupportTicket>('conversations').get(id);
    if (!ticket || (req.user?.role !== 'super_admin' && ticket.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Ticket not found', 404);
    }

    const newMessage: TicketMessage = {
      id: uuidv4(),
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
      message,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...ticket.messages, newMessage];
    const newStatus = status || (req.user?.role === 'super_admin' ? 'waiting_for_user' : 'in_progress');

    const updated = await dbStore.collection<SupportTicket>('conversations').update(id, {
      messages: updatedMessages,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    // Notify counterpart
    if (req.user?.role === 'super_admin') {
      const shop = await dbStore.collection<Shop>('shops').get(ticket.shopId);
      if (shop?.ownerId) {
        await NotificationService.create({
          recipientId: shop.ownerId,
          shopId: shop.id,
          title: 'Super Admin Replied to Ticket',
          message: `New message on ticket #${ticket.ticketNumber}: "${ticket.subject}"`,
          link: '/shop-owner/communication',
        });
      }
    } else {
      await NotificationService.notifySuperAdmins({
        title: 'Shop Replied to Ticket',
        message: `Shop "${ticket.shopName}" replied to #${ticket.ticketNumber}`,
        link: '/super-admin/communication',
      });
    }

    return sendSuccess(res, updated);
  }
}
