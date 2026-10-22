import { Request, Response } from 'express';
import { dbStore } from '../../db/store';
import { PlatformSettings } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { config } from '../../config/env';

export class SettingsController {
  private static getDefaultSupportEmail(): string {
    return (
      process.env.SUPPORT_EMAIL ||
      process.env.PLATFORM_SUPPORT_EMAIL ||
      config.brevo.senderEmail ||
      config.email.user ||
      'savinda.codezela@gmail.com'
    );
  }

  /**
   * Public endpoint to fetch platform support contact information.
   * Accessible by unauthenticated users on login or registration pages.
   */
  static async getPublicSupportSettings(req: Request, res: Response) {
    try {
      const doc = await dbStore.collection<PlatformSettings>('settings').get('platform');
      const supportEmail = (doc?.supportEmail || SettingsController.getDefaultSupportEmail()).trim();
      const platformName = doc?.platformName || 'SaaS Shop Management Platform';
      const supportPhone = doc?.supportPhone || '';
      const supportHours = doc?.supportHours || '24/7 Platform Support Desk';

      return sendSuccess(res, {
        supportEmail,
        platformName,
        supportPhone,
        supportHours,
      });
    } catch (err: any) {
      console.error('Error fetching public support settings:', err);
      return sendSuccess(res, {
        supportEmail: SettingsController.getDefaultSupportEmail(),
        platformName: 'SaaS Shop Management Platform',
      });
    }
  }

  /**
   * Super Admin endpoint to view full platform configuration.
   */
  static async getAdminSettings(req: AuthenticatedRequest, res: Response) {
    try {
      let doc = await dbStore.collection<PlatformSettings>('settings').get('platform');
      if (!doc) {
        doc = {
          id: 'platform',
          supportEmail: SettingsController.getDefaultSupportEmail(),
          platformName: 'SaaS Shop Management Platform',
          supportPhone: '+94 77 123 4567',
          supportHours: 'Monday - Friday (8:00 AM - 6:00 PM)',
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Default',
        };
      }
      return sendSuccess(res, doc);
    } catch (err: any) {
      console.error('Error fetching admin settings:', err);
      return sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve platform settings', 500);
    }
  }

  /**
   * Super Admin endpoint to update platform settings including Support Email.
   */
  static async updateAdminSettings(req: AuthenticatedRequest, res: Response) {
    const { supportEmail, platformName, supportPhone, supportHours } = req.body;

    if (!supportEmail || typeof supportEmail !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', 'Platform support email is required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = supportEmail.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return sendError(res, 'VALIDATION_ERROR', 'Please provide a valid support email address', 400);
    }

    try {
      const existing = await dbStore.collection<PlatformSettings>('settings').get('platform');

      const updatedData: PlatformSettings = {
        id: 'platform',
        supportEmail: cleanEmail,
        platformName: (platformName || existing?.platformName || 'SaaS Shop Management Platform').trim(),
        supportPhone: supportPhone !== undefined ? String(supportPhone).trim() : existing?.supportPhone || '',
        supportHours: supportHours !== undefined ? String(supportHours).trim() : existing?.supportHours || '',
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.email || req.user?.name || 'Super Admin',
      };

      if (existing) {
        await dbStore.collection<PlatformSettings>('settings').update('platform', updatedData);
      } else {
        await dbStore.collection<PlatformSettings>('settings').create(updatedData);
      }

      await AuditLogService.log({
        actor: req.user!,
        action: 'UPDATE_PLATFORM_SETTINGS',
        entity: 'settings',
        entityId: 'platform',
        before: existing,
        after: updatedData,
      });

      return sendSuccess(res, updatedData, {
        message: 'Platform settings and support email updated successfully',
      });
    } catch (err: any) {
      console.error('Error updating platform settings:', err);
      return sendError(res, 'INTERNAL_ERROR', 'Failed to save platform settings', 500);
    }
  }
}
