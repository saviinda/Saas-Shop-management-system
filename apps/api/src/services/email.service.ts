import { dbStore } from '../db/store';
import { AppNotification } from '@saas/types';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

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

let cachedTransporter: Transporter | null = null;
let etherealAccount: any = null;

async function getTransporter(): Promise<{ transporter: Transporter; isEthereal: boolean }> {
  if (config.email.host && config.email.user && config.email.pass) {
    if (!cachedTransporter) {
      cachedTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
    return { transporter: cachedTransporter, isEthereal: false };
  }

  // Fallback: If user provided user & pass without custom host, default to Gmail SMTP
  if (config.email.user && config.email.pass) {
    if (!cachedTransporter) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
    return { transporter: cachedTransporter, isEthereal: false };
  }

  // Fallback for local development/testing: auto-create Ethereal test account
  if (!cachedTransporter) {
    try {
      if (!etherealAccount) {
        etherealAccount = await nodemailer.createTestAccount();
        console.log(`[EMAIL DISPATCH SERVICE] Initialized Ethereal test inbox for: ${etherealAccount.user}`);
      }
      cachedTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass,
        },
      });
    } catch (err) {
      console.warn('[EMAIL DISPATCH SERVICE] Could not setup test transporter, using stream fallback:', err);
      cachedTransporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
      });
      return { transporter: cachedTransporter, isEthereal: false };
    }
  }

  return { transporter: cachedTransporter, isEthereal: true };
}

export class EmailService {
  /**
   * Dispatches a structured transactional email to the shop owner or user.
   * Prioritizes Brevo Transactional Email API (https://api.brevo.com/v3/smtp/email),
   * falls back to Brevo/Nodemailer SMTP, and generates in-app notifications.
   */
  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId: string; previewUrl?: string }> {
    let messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const timestamp = new Date().toISOString();

    const formattedBody = this.renderEmailBody(options.template, options.data, options.recipientName);
    const htmlBody = this.renderHtmlEmail(options.template, options.subject, options.data, options.recipientName);

    let previewUrl: string | undefined;

    // 1. Prioritize Brevo REST API if configured
    if (config.brevo.apiKey) {
      try {
        const senderEmail = config.brevo.senderEmail || config.email.user || 'noreply@saasplatform.com';
        const senderName = config.brevo.senderName || 'SaaS Platform Admin';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': config.brevo.apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: senderName,
              email: senderEmail,
            },
            to: [
              {
                email: options.to,
                name: options.recipientName || options.to,
              },
            ],
            subject: options.subject,
            htmlContent: htmlBody,
            textContent: formattedBody,
          }),
        });

        const resData: any = await response.json();
        if (!response.ok) {
          console.error('[EMAIL DISPATCH SERVICE] Brevo API Error response:', resData);
          throw new Error(resData?.message || 'Brevo API rejected email dispatch');
        }

        if (resData?.messageId) {
          messageId = resData.messageId;
        }

        console.log(`\n======================================================`);
        console.log(`[EMAIL DISPATCH SERVICE] -> Dispatched via Brevo API`);
        console.log(`[TO]: ${options.to} (${options.recipientName || 'User'})`);
        console.log(`[SUBJECT]: ${options.subject}`);
        console.log(`[MESSAGE ID]: ${messageId} | [TIME]: ${timestamp}`);
        console.log(`------------------------------------------------------`);
        console.log(formattedBody);
        console.log(`======================================================\n`);
      } catch (error) {
        console.error(`[EMAIL DISPATCH SERVICE] Error dispatching via Brevo API to ${options.to}:`, error);
      }
    } else {
      // 2. Otherwise use Nodemailer (Brevo SMTP, custom SMTP, or Ethereal test inbox)
      try {
        const { transporter, isEthereal } = await getTransporter();
        const mailOptions = {
          from: config.email.from,
          to: options.to,
          subject: options.subject,
          text: formattedBody,
          html: htmlBody,
        };

        const info = await transporter.sendMail(mailOptions);
        if (info?.messageId) {
          messageId = info.messageId;
        }

        if (isEthereal) {
          const testUrl = nodemailer.getTestMessageUrl(info);
          if (testUrl) {
            previewUrl = testUrl;
          }
        }

        console.log(`\n======================================================`);
        console.log(`[EMAIL DISPATCH SERVICE] -> To: ${options.to} (${options.recipientName || 'User'})`);
        console.log(`[SUBJECT]: ${options.subject}`);
        console.log(`[MESSAGE ID]: ${messageId} | [TIME]: ${timestamp}`);
        if (previewUrl) {
          console.log(`[ETHEREAL INBOX PREVIEW]: ${previewUrl}`);
        }
        console.log(`------------------------------------------------------`);
        console.log(formattedBody);
        console.log(`======================================================\n`);
      } catch (error) {
        console.error(`[EMAIL DISPATCH SERVICE] Error sending email via SMTP to ${options.to}:`, error);
      }
    }

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

    return { success: true, messageId, previewUrl };
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

  private static renderHtmlEmail(template: string, subject: string, data: Record<string, any>, recipientName?: string): string {
    const greeting = recipientName ? `Dear ${recipientName},` : `Dear Store Owner,`;
    const appUrl = config.corsOrigin || 'http://localhost:3000';

    if (template === 'reset_access') {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #4f46e5; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 32px 28px; font-size: 14px; line-height: 1.6; }
    .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .row { margin-bottom: 10px; font-size: 13px; }
    .label { font-weight: 600; color: #475569; display: inline-block; width: 140px; }
    .val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; color: #0f172a; }
    .pwd-badge { background: #e0e7ff; color: #3730a3; padding: 5px 12px; border-radius: 6px; font-size: 15px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #c7d2fe; display: inline-block; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 16px; text-align: center; }
    .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Account Access & Credentials Update</h1>
    </div>
    <div class="content">
      <p style="font-size: 15px; font-weight: 600; margin-top: 0;">${greeting}</p>
      <p>Your account access credentials for <b>${data.shopName || 'SaaS Shop Management Platform'}</b> have been updated by an Administrator.</p>
      
      <div class="box">
        <div class="row">
          <span class="label">Email / Login:</span>
          <span class="val">${data.email}</span>
        </div>
        <div class="row" style="margin-top: 12px; margin-bottom: 12px;">
          <span class="label" style="vertical-align: middle;">Temporary Password:</span>
          <span class="pwd-badge">${data.temporaryPassword}</span>
        </div>
        <div class="row" style="margin-bottom: 0;">
          <span class="label">Reset Reason:</span>
          <span style="color: #64748b;">${data.resetReason || 'Administrator performed account access reset'}</span>
        </div>
      </div>

      <p style="color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; font-size: 12px; margin: 20px 0;">
        <b>Security Notice:</b> Please log in to your portal immediately with these temporary credentials and set a new personal password.
      </p>

      <div style="text-align: center;">
        <a href="${appUrl}/login" class="btn">Log In to Your Account</a>
      </div>

      <p style="margin-top: 32px; color: #64748b; font-size: 13px;">
        Best regards,<br>
        <b>Platform Security & Administration Team</b>
      </p>
    </div>
    <div class="footer">
      This is an automated notification sent to ${data.email}. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
      `.trim();
    }

    // Default HTML wrapper for other templates
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 28px; }
    .pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="pre">${this.renderEmailBody(template, data, recipientName)}</div>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${appUrl}/login" class="btn">Access Portal</a>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
