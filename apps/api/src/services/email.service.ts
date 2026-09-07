import { dbStore } from '../db/store';
import { AppNotification } from '@saas/types';

export interface EmailOptions {
  to: string;
  recipientName?: string;
  subject: string;
  template:
    | 'payment_status'
    | 'account_approved'
    | 'account_status'
    | 'reset_access'
    | 'forgot_password'
    | 'password_changed'
    | 'payment_restricted'
    | 'change_request'
    | 'general';
  data: Record<string, any>;
}

export class EmailService {
  /**
   * Dispatches a structured transactional email to the shop owner or user.
   * Logs email content to console, creates an in-app notification, and persists email dispatch log.
   */
  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId: string }> {
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const timestamp = new Date().toISOString();

    const formattedBody = this.renderEmailBody(options.template, options.data, options.recipientName);

    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCH SERVICE] -> To: ${options.to} (${options.recipientName || 'User'})`);
    console.log(`[SUBJECT]: ${options.subject}`);
    console.log(`[MESSAGE ID]: ${messageId} | [TIME]: ${timestamp}`);
    console.log(`------------------------------------------------------`);
    console.log(formattedBody);
    console.log(`======================================================\n`);

    // If a recipient userId is provided, create an in-app notification matching the email
    if (options.data.userId || options.data.recipientId) {
      const recipientId = options.data.userId || options.data.recipientId;
      try {
        await dbStore.collection<AppNotification>('notifications').create({
          recipientId,
          shopId: options.data.shopId,
          title: options.subject,
          message: options.data.summaryMessage || options.subject,
          type: options.data.notificationType || 'info',
          link: options.data.link || '/subscription',
          isRead: false,
          createdAt: timestamp,
        });
      } catch (e) {
        console.warn('Failed to record notification for email:', e);
      }
    }

    return { success: true, messageId };
  }

  /**
   * Helper to send payment status notification email to shop owner
   */
  static async sendPaymentStatusEmail(params: {
    ownerEmail: string;
    ownerName: string;
    ownerId?: string;
    shopId: string;
    shopName: string;
    amount: number;
    currency: string;
    status: 'successful' | 'pending' | 'rejected' | 'approved' | 'processing' | 'failed' | 'cancelled' | 'refunded';
    packageName?: string;
    notes?: string;
    transactionId: string;
  }) {
    const statusLabelMap: Record<string, string> = {
      successful: 'Approved & Verified',
      approved: 'Approved & Verified',
      pending: 'Under Review / Pending',
      processing: 'Processing',
      failed: 'Payment Failed',
      rejected: 'Payment Rejected',
      cancelled: 'Payment Cancelled',
      refunded: 'Payment Refunded',
    };

    const statusLabel = statusLabelMap[params.status] || params.status;

    const subject =
      params.status === 'successful' || params.status === 'approved'
        ? `Payment Approved - Subscription Activated for ${params.shopName}`
        : params.status === 'refunded'
        ? `Payment Refund Issued - ${params.shopName}`
        : params.status === 'failed' || params.status === 'rejected'
        ? `Payment Alert: ${statusLabel} for ${params.shopName}`
        : `Payment Status Update: ${statusLabel} for ${params.shopName}`;

    return this.sendEmail({
      to: params.ownerEmail,
      recipientName: params.ownerName,
      subject,
      template: 'payment_status',
      data: {
        recipientId: params.ownerId,
        shopId: params.shopId,
        shopName: params.shopName,
        amount: params.amount,
        currency: params.currency,
        status: statusLabel,
        statusRaw: params.status,
        packageName: params.packageName || 'Standard Tier',
        notes: params.notes,
        transactionId: params.transactionId,
        notificationType:
          params.status === 'successful' || params.status === 'approved'
            ? 'success'
            : params.status === 'pending' || params.status === 'processing'
            ? 'info'
            : 'alert',
        summaryMessage: `Payment of ${params.currency} ${params.amount} is now ${statusLabel}.`,
        link: '/shop-owner/subscription',
      },
    });
  }

  /**
   * Helper to send forgot password / password reset token email
   */
  static async sendForgotPasswordEmail(params: {
    email: string;
    name: string;
    userId: string;
    resetToken: string;
    expiresMinutes: number;
  }) {
    const subject = `Password Reset Request - SaaS Platform`;

    return this.sendEmail({
      to: params.email,
      recipientName: params.name,
      subject,
      template: 'forgot_password',
      data: {
        recipientId: params.userId,
        name: params.name,
        email: params.email,
        resetToken: params.resetToken,
        expiresMinutes: params.expiresMinutes,
        notificationType: 'warning',
        summaryMessage: 'A password reset link was requested for your account.',
        link: `/login?resetToken=${params.resetToken}`,
      },
    });
  }

  /**
   * Helper to send password changed confirmation email
   */
  static async sendPasswordChangedEmail(params: {
    email: string;
    name: string;
    userId: string;
  }) {
    const subject = `Security Notice: Your Password Has Been Changed`;

    return this.sendEmail({
      to: params.email,
      recipientName: params.name,
      subject,
      template: 'password_changed',
      data: {
        recipientId: params.userId,
        name: params.name,
        email: params.email,
        notificationType: 'info',
        summaryMessage: 'Your account password has been updated successfully.',
        link: '/login',
      },
    });
  }

  /**
   * Helper to send change request review status email (Approved / Rejected)
   */
  static async sendChangeRequestStatusEmail(params: {
    ownerEmail: string;
    ownerName: string;
    ownerId?: string;
    shopId: string;
    shopName: string;
    field: string;
    currentValue: any;
    requestedValue: any;
    status: 'approved' | 'rejected';
    reviewNotes?: string;
  }) {
    const isApproved = params.status === 'approved';
    const subject = isApproved
      ? `Change Request Approved - ${params.field} updated for ${params.shopName}`
      : `Change Request Notice - Request Rejected for ${params.shopName}`;

    return this.sendEmail({
      to: params.ownerEmail,
      recipientName: params.ownerName,
      subject,
      template: 'change_request',
      data: {
        recipientId: params.ownerId,
        shopId: params.shopId,
        shopName: params.shopName,
        field: params.field,
        currentValue: params.currentValue,
        requestedValue: params.requestedValue,
        status: isApproved ? 'Approved & Applied' : 'Rejected',
        statusRaw: params.status,
        reviewNotes: params.reviewNotes,
        notificationType: isApproved ? 'success' : 'alert',
        summaryMessage: isApproved
          ? `Your change request for ${params.field} has been approved and applied.`
          : `Your change request for ${params.field} was rejected.`,
        link: '/shop-owner/change-requests',
      },
    });
  }

  /**
   * Helper to send payment restriction status update email
   */
  static async sendPaymentRestrictedEmail(params: {
    email: string;
    name: string;
    userId?: string;
    shopName: string;
    isRestricted: boolean;
    reason?: string;
  }) {
    const subject = params.isRestricted
      ? `Notice: Payment Processing Restricted for ${params.shopName}`
      : `Notice: Payment Processing Restored for ${params.shopName}`;

    return this.sendEmail({
      to: params.email,
      recipientName: params.name,
      subject,
      template: 'payment_restricted',
      data: {
        recipientId: params.userId,
        name: params.name,
        shopName: params.shopName,
        isRestricted: params.isRestricted,
        reason: params.reason || 'Platform risk and verification policy',
        notificationType: params.isRestricted ? 'alert' : 'success',
        summaryMessage: params.isRestricted
          ? `Payment processing for "${params.shopName}" has been temporarily restricted.`
          : `Payment processing for "${params.shopName}" has been restored.`,
        link: '/shop-owner/subscription',
      },
    });
  }

  /**
   * Helper to send account access reset / new credentials email
   */
  static async sendResetAccessEmail(params: {
    email: string;
    name: string;
    userId: string;
    shopName?: string;
    temporaryPassword?: string;
    resetReason?: string;
  }) {
    const subject = `Account Access & Credentials Update - ${params.shopName || 'SaaS Platform'}`;

    return this.sendEmail({
      to: params.email,
      recipientName: params.name,
      subject,
      template: 'reset_access',
      data: {
        recipientId: params.userId,
        name: params.name,
        email: params.email,
        shopName: params.shopName,
        temporaryPassword: params.temporaryPassword || 'Password@123',
        resetReason: params.resetReason || 'Super Admin generated temporary credentials',
        notificationType: 'warning',
        summaryMessage: 'Your account access credentials have been reset by the platform administrator.',
        link: '/login',
      },
    });
  }

  /**
   * Helper to send account status change email (Activated, Suspended, Deactivated)
   */
  static async sendAccountStatusEmail(params: {
    email: string;
    name: string;
    userId?: string;
    shopName: string;
    status: 'active' | 'inactive' | 'suspended' | 'restricted';
    reason?: string;
  }) {
    const statusMap: Record<string, string> = {
      active: 'Activated',
      inactive: 'Deactivated',
      suspended: 'Suspended',
      restricted: 'Restricted',
    };

    const subject = `Shop Account Notice: Account has been ${statusMap[params.status] || params.status}`;

    return this.sendEmail({
      to: params.email,
      recipientName: params.name,
      subject,
      template: 'account_status',
      data: {
        recipientId: params.userId,
        name: params.name,
        shopName: params.shopName,
        status: statusMap[params.status] || params.status,
        statusRaw: params.status,
        reason: params.reason,
        notificationType: params.status === 'active' ? 'success' : 'alert',
        summaryMessage: `Your shop account "${params.shopName}" status is now ${statusMap[params.status] || params.status}.`,
        link: '/login',
      },
    });
  }

  private static renderEmailBody(template: string, data: Record<string, any>, recipientName?: string): string {
    const greeting = recipientName ? `Dear ${recipientName},` : `Dear Store Owner,`;

    switch (template) {
      case 'change_request':
        return `
${greeting}

This is an update regarding your protected account change request for "${data.shopName}".

Change Request Details:
- Protected Field: ${data.field}
- Previous Value: ${data.currentValue}
- Requested Value: ${data.requestedValue}
- Decision: ${data.status.toUpperCase()}
${data.reviewNotes ? `- Super Admin Review Notes: ${data.reviewNotes}\n` : ''}
${
  data.statusRaw === 'approved'
    ? 'The requested change has been APPROVED and the platform records have been updated automatically.'
    : 'Your change request was REJECTED by the platform administrator. If you have questions, please open a support ticket.'
}

Best regards,
Platform Administration & Compliance Team
        `.trim();

      case 'forgot_password':
        return `
${greeting}

We received a request to reset your password. Use the secure token below to reset your password:

Reset Token: ${data.resetToken}
Valid for: ${data.expiresMinutes} minutes

If you did not request a password reset, please ignore this email or contact support.

Best regards,
Platform Security Team
        `.trim();

      case 'password_changed':
        return `
${greeting}

This is a confirmation that the password for your account (${data.email}) was successfully changed.

If you did not perform this change, please contact platform security immediately.

Best regards,
Platform Security Team
        `.trim();

      case 'payment_restricted':
        return `
${greeting}

This is an administrative notice regarding payment processing for "${data.shopName}".

Status: ${data.isRestricted ? 'PAYMENT ACCESS RESTRICTED' : 'PAYMENT ACCESS RESTORED'}
${data.reason ? `Reason / Note: ${data.reason}\n` : ''}
${
  data.isRestricted
    ? 'Your ability to submit new bank transfer payments and process subscriptions is temporarily restricted. Please contact Super Admin support to resolve.'
    : 'Your shop is now permitted to process payments and submit bank transfer invoices normally.'
}

Best regards,
Platform Financial Compliance Team
        `.trim();

      case 'payment_status':
        return `
${greeting}

We are writing to notify you regarding your payment transaction for "${data.shopName}".

Payment Details:
- Transaction ID: ${data.transactionId}
- Package / Plan: ${data.packageName}
- Amount: ${data.currency} ${data.amount}
- Current Status: ${data.status}
${data.notes ? `- Reviewer Notes: ${data.notes}\n` : ''}
${
  data.statusRaw === 'successful' || data.statusRaw === 'approved'
    ? 'Your subscription is now ACTIVE. You can continue using all platform features and quotas.'
    : data.statusRaw === 'pending'
    ? 'Your bank slip is currently being reviewed by our financial verification team. We will update you shortly.'
    : data.statusRaw === 'refunded'
    ? 'A refund has been processed for this transaction.'
    : 'Your payment submission could not be verified or was rejected. Please log in and re-submit a valid bank transfer slip or contact support.'
}

Best regards,
Platform Financial Operations Team
        `.trim();

      case 'reset_access':
        return `
${greeting}

Your account access credentials for "${data.shopName || 'Platform'}" have been updated by a Super Administrator.

Login Credentials:
- Email / Username: ${data.email}
- Temporary Password: ${data.temporaryPassword}
- Reason: ${data.resetReason}

For security reasons, please log in immediately at your portal and change your password.

Best regards,
Platform Security & Administration Team
        `.trim();

      case 'account_status':
        return `
${greeting}

This is an important update regarding your shop account "${data.shopName}".

Account Status: ${data.status.toUpperCase()}
${data.reason ? `Reason / Notice: ${data.reason}\n` : ''}
${
  data.statusRaw === 'active'
    ? 'Your account is fully operational. You and your staff can log in and access all store features.'
    : 'Your account access has been limited or temporarily paused. Please contact Super Admin support if you have questions.'
}

Best regards,
Platform Administration Team
        `.trim();

      default:
        return `
${greeting}

You have a new update from the SaaS Shop Management Platform.

${JSON.stringify(data, null, 2)}

Best regards,
Platform Support
        `.trim();
    }
  }
}
