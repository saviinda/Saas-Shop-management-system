import { Request, Response } from 'express';
import { EmailService } from '../../services/email.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../middleware/auth';
import { dbStore } from '../../db/store';
import { Subscription } from '@saas/types';

export class EmailController {
  /**
   * Get current email service provider configuration and connectivity status
   */
  static async getProviderStatus(req: AuthenticatedRequest, res: Response) {
    const status = EmailService.getProviderStatus();
    return sendSuccess(res, status);
  }

  /**
   * Dispatches a test email to verify provider integration
   */
  static async sendTestEmail(req: AuthenticatedRequest, res: Response) {
    const { to, templateType } = req.body;
    const recipientEmail = (to || req.user?.email || '').trim().toLowerCase();

    if (!recipientEmail) {
      return sendError(res, 'INVALID_INPUT', 'Destination email address is required', 400);
    }

    try {
      const result = await EmailService.sendTestEmail({
        to: recipientEmail,
        templateType: templateType || 'general_test',
        recipientName: req.user?.name || 'Administrator',
      });

      return sendSuccess(res, {
        message: `Test email dispatched successfully to ${recipientEmail}`,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        provider: EmailService.getProviderStatus(),
      });
    } catch (err: any) {
      console.error('Failed to send test email:', err);
      return sendError(res, 'EMAIL_SEND_FAILED', err.message || 'Failed to dispatch test email', 500);
    }
  }

  /**
   * Triggers subscription plan expiry check across active shops
   */
  static async triggerExpiryCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const allSubs = await dbStore.collection<Subscription>('subscriptions').query({
        where: [{ field: 'status', op: '==', value: 'active' }],
      });

      let notifiedCount = 0;
      const now = Date.now();

      for (const sub of allSubs.data) {
        const expiryTime = new Date(sub.expiryAt).getTime();
        const diffMs = expiryTime - now;
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 7) {
          const shop = await dbStore.collection<any>('shops').get(sub.shopId);
          const ownerEmail = shop?.ownerEmail || shop?.email;

          if (ownerEmail && shop) {
            await EmailService.sendPlanExpiryReminderEmail({
              email: ownerEmail,
              name: shop.ownerName || 'Shop Owner',
              shopName: shop.name,
              packageName: sub.packageName || 'Standard Tier',
              daysRemaining,
              expiryDate: new Date(sub.expiryAt).toLocaleDateString(),
              isExpired: daysRemaining <= 0,
              shopId: sub.shopId,
              userId: shop.ownerId,
            });
            notifiedCount++;
          }
        }
      }

      return sendSuccess(res, {
        scannedCount: allSubs.data.length,
        notifiedCount,
        message: `Plan expiry check complete. Notified ${notifiedCount} expiring or expired shop owners.`,
      });
    } catch (err: any) {
      return sendError(res, 'EXPIRY_CHECK_FAILED', err.message || 'Failed to check expiring plans', 500);
    }
  }
}
