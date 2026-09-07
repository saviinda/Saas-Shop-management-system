import { Response } from 'express';
import { dbStore } from '../../db/store';
import { ChangeRequest, Shop, User } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { NotificationService } from '../../services/notification.service';
import { EmailService } from '../../services/email.service';

export class ChangeRequestController {
  static async listRequests(req: AuthenticatedRequest, res: Response) {
    const { status } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];
    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    }

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    const requests = await dbStore.collection<ChangeRequest>('changeRequests').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    return sendSuccess(res, requests.data);
  }

  static async getRequest(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const request = await dbStore.collection<ChangeRequest>('changeRequests').get(id);

    if (!request || (req.user?.role !== 'super_admin' && request.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Change request not found', 404);
    }

    return sendSuccess(res, request);
  }

  static async createRequest(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const shop = await dbStore.collection<Shop>('shops').get(shopId);
    if (!shop) return sendError(res, 'NOT_FOUND', 'Shop not found', 404);

    const { field, currentValue, requestedValue, reason } = req.body;
    if (!field || requestedValue === undefined || !reason) {
      return sendError(res, 'BAD_REQUEST', 'Field, requestedValue, and reason are required', 400);
    }

    const request = await dbStore.collection<ChangeRequest>('changeRequests').create({
      shopId,
      shopName: shop.name,
      requesterId: req.user!.id,
      requesterName: req.user!.name,
      field,
      currentValue: currentValue !== undefined ? currentValue : (shop as any)[field] || '',
      requestedValue,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Notify Super Admins
    await NotificationService.notifySuperAdmins({
      title: 'New Account Change Request',
      message: `Shop "${shop.name}" submitted a request to change "${field}".`,
      link: '/super-admin/change-requests',
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'SUBMIT_CHANGE_REQUEST',
      entity: 'changeRequests',
      entityId: request.id,
      shopId,
      after: request,
    });

    return sendSuccess(res, request, undefined, 201);
  }

  static async reviewRequest(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
      return sendError(res, 'BAD_REQUEST', 'Status must be approved or rejected', 400);
    }

    const request = await dbStore.collection<ChangeRequest>('changeRequests').get(id);
    if (!request) return sendError(res, 'NOT_FOUND', 'Change request not found', 404);

    const updated = await dbStore.collection<ChangeRequest>('changeRequests').update(id, {
      status,
      reviewNotes: reviewNotes || request.reviewNotes,
      reviewedBy: req.user!.name,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const shop = await dbStore.collection<Shop>('shops').get(request.shopId);

    // If approved, automatically update the requested fields in the database
    if (status === 'approved' && shop) {
      const field = request.field;
      const val = request.requestedValue;
      const shopUpdates: Partial<Shop> = { updatedAt: new Date().toISOString() };

      if (field === 'name' || field === 'businessName' || field === 'Shop Name') {
        shopUpdates.name = val;
      } else if (field === 'category' || field === 'businessCategory' || field === 'Business Category') {
        shopUpdates.category = val;
      } else if (field === 'address' || field === 'businessAddress' || field === 'Business Address') {
        shopUpdates.address = val;
      } else if (field === 'contactNumber' || field === 'phone' || field === 'Contact Number') {
        shopUpdates.contactNumber = val;
        if (shop.ownerId) {
          await dbStore.collection<User>('users').update(shop.ownerId, { phone: val, updatedAt: new Date().toISOString() });
        }
      } else if (field === 'email' || field === 'ownerEmail' || field === 'Email Address') {
        shopUpdates.email = val;
        shopUpdates.ownerEmail = val;
        if (shop.ownerId) {
          await dbStore.collection<User>('users').update(shop.ownerId, { email: val, updatedAt: new Date().toISOString() });
        }
      } else if (field === 'ownerName' || field === 'Owner Name') {
        shopUpdates.ownerName = val;
        if (shop.ownerId) {
          await dbStore.collection<User>('users').update(shop.ownerId, { name: val, updatedAt: new Date().toISOString() });
        }
      } else {
        (shopUpdates as any)[field] = val;
      }

      await dbStore.collection<Shop>('shops').update(request.shopId, shopUpdates);
    }

    // In-app Notification to Shop Owner
    if (shop?.ownerId) {
      await NotificationService.create({
        recipientId: shop.ownerId,
        shopId: shop.id,
        title: status === 'approved' ? 'Account Change Request Approved' : 'Account Change Request Rejected',
        message: status === 'approved'
          ? `Your change request for ${request.field} was approved and updated.`
          : `Your change request for ${request.field} was rejected. ${reviewNotes ? `Reason: ${reviewNotes}` : ''}`,
        type: status === 'approved' ? 'success' : 'alert',
        link: '/shop-owner/change-requests',
      });
    }

    // Email dispatch to Shop Owner
    const ownerEmail = shop?.ownerEmail || shop?.email;
    if (ownerEmail) {
      await EmailService.sendChangeRequestStatusEmail({
        ownerEmail,
        ownerName: shop?.ownerName || 'Shop Owner',
        ownerId: shop?.ownerId,
        shopId: request.shopId,
        shopName: shop?.name || request.shopName || 'Shop',
        field: request.field,
        currentValue: request.currentValue,
        requestedValue: request.requestedValue,
        status,
        reviewNotes,
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: `REVIEW_CHANGE_REQUEST_${status.toUpperCase()}`,
      entity: 'changeRequests',
      entityId: id,
      shopId: request.shopId,
      before: request,
      after: updated,
    });

    return sendSuccess(res, updated);
  }
}
