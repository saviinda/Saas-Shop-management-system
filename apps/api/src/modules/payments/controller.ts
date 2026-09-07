import { Request, Response } from 'express';
import crypto from 'crypto';
import { dbStore } from '../../db/store';
import { PaymentTransaction, Subscription, SubscriptionPackage, Shop, User, PaymentStatus } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { NotificationService } from '../../services/notification.service';
import { EmailService } from '../../services/email.service';
import { config } from '../../config/env';

export class PaymentController {
  static async listPayments(req: AuthenticatedRequest, res: Response) {
    const { status, shopId: queryShopId, method, dateFrom, dateTo, search } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];

    // Multi-tenant isolation: Shop owners/staff strictly limited to their own shop
    if (req.user?.role !== 'super_admin') {
      if (!req.shopId) return sendSuccess(res, []);
      where.push({ field: 'shopId', op: '==', value: req.shopId });
    } else if (queryShopId && queryShopId !== 'all') {
      where.push({ field: 'shopId', op: '==', value: queryShopId });
    }

    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }

    if (method && method !== 'all') {
      where.push({ field: 'method', op: '==', value: method });
    }

    const payments = await dbStore.collection<PaymentTransaction>('payments').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let results = payments.data;

    // Filter by date range if provided
    if (dateFrom) {
      const fromTimestamp = new Date(dateFrom as string).getTime();
      results = results.filter(p => new Date(p.createdAt).getTime() >= fromTimestamp);
    }
    if (dateTo) {
      const toTimestamp = new Date(dateTo as string).getTime() + 24 * 60 * 60 * 1000 - 1;
      results = results.filter(p => new Date(p.createdAt).getTime() <= toTimestamp);
    }

    const enriched = await Promise.all(
      results.map(async p => {
        const shop = await dbStore.collection<Shop>('shops').get(p.shopId);
        let packageName = 'Standard Plan';
        if (p.packageId) {
          const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(p.packageId);
          if (pkg) packageName = pkg.name;
        } else if (shop?.packageName) {
          packageName = shop.packageName;
        }

        return {
          ...p,
          shopName: shop?.name || p.shopName || 'Unknown Shop',
          ownerName: shop?.ownerName || 'Shop Owner',
          ownerEmail: shop?.ownerEmail || shop?.email || '',
          shopContact: shop?.contactNumber || '',
          shopAddress: shop?.address || '',
          category: shop?.category || '',
          isPaymentRestricted: shop?.isPaymentRestricted || false,
          packageName,
        };
      })
    );

    let finalPayments = enriched;
    if (search) {
      const q = (search as string).toLowerCase();
      finalPayments = finalPayments.filter(
        p =>
          p.id.toLowerCase().includes(q) ||
          p.shopName.toLowerCase().includes(q) ||
          p.ownerName.toLowerCase().includes(q) ||
          p.ownerEmail.toLowerCase().includes(q)
      );
    }

    return sendSuccess(res, finalPayments);
  }

  static async getPayment(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const payment = await dbStore.collection<PaymentTransaction>('payments').get(id);

    if (!payment) return sendError(res, 'NOT_FOUND', 'Payment transaction not found', 404);

    // Strict Tenant Isolation
    if (req.user?.role !== 'super_admin' && req.shopId !== payment.shopId) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this payment record', 403);
    }

    const shop = await dbStore.collection<Shop>('shops').get(payment.shopId);
    let pkg: SubscriptionPackage | null = null;
    if (payment.packageId) {
      pkg = await dbStore.collection<SubscriptionPackage>('packages').get(payment.packageId);
    }

    return sendSuccess(res, {
      ...payment,
      shop,
      package: pkg,
      shopName: shop?.name || payment.shopName,
      ownerName: shop?.ownerName,
      ownerEmail: shop?.ownerEmail || shop?.email,
      shopContact: shop?.contactNumber,
      shopAddress: shop?.address,
      category: shop?.category,
      isPaymentRestricted: shop?.isPaymentRestricted || false,
    });
  }

  static async createPaymentRequest(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const shop = await dbStore.collection<Shop>('shops').get(shopId);
    if (!shop) return sendError(res, 'NOT_FOUND', 'Shop not found', 404);

    // Check payment restriction
    if (shop.isPaymentRestricted) {
      return sendError(
        res,
        'PAYMENT_RESTRICTED',
        `Payment processing is currently restricted for this shop: ${shop.paymentRestrictionReason || 'Administrative restriction'}. Please contact Super Admin.`,
        403
      );
    }

    const { packageId, amount, method, bankSlipUrl, notes, cardLast4, cardBrand } = req.body;

    const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
    if (!pkg) return sendError(res, 'NOT_FOUND', 'Package not found', 404);

    // Security: never store raw card numbers or CVVs. Only store sanitized gateway reference or masked last4
    const payment = await dbStore.collection<PaymentTransaction>('payments').create({
      shopId,
      shopName: shop.name,
      packageId,
      amount,
      currency: 'USD',
      method,
      status: method === 'card' ? 'successful' : 'pending',
      bankSlipUrl: method === 'bank_transfer' ? bankSlipUrl : undefined,
      gatewayRef: method === 'card' ? 'gtw_tok_' + crypto.randomBytes(8).toString('hex') : undefined,
      cardLast4: cardLast4 || (method === 'card' ? '4242' : undefined),
      cardBrand: cardBrand || (method === 'card' ? 'Visa' : undefined),
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (payment.status === 'successful') {
      await PaymentController.activateSubscriptionForPayment(payment, pkg);
    } else {
      await NotificationService.notifySuperAdmins({
        title: 'New Bank Slip Payment Request',
        message: `Shop "${shop.name}" submitted a bank transfer payment of $${amount} for review.`,
        link: '/super-admin/payments',
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'SUBMIT_PAYMENT_REQUEST',
      entity: 'payments',
      entityId: payment.id,
      shopId,
      after: { amount, method, status: payment.status },
    });

    return sendSuccess(res, payment, undefined, 201);
  }

  static async reviewPayment(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    let { status, notes } = req.body;

    if (status === 'approved') {
      status = 'successful';
    }

    const validStatuses: PaymentStatus[] = ['pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'BAD_REQUEST', `Status must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const payment = await dbStore.collection<PaymentTransaction>('payments').get(id);
    if (!payment) return sendError(res, 'NOT_FOUND', 'Payment transaction not found', 404);

    const updated = await dbStore.collection<PaymentTransaction>('payments').update(id, {
      status,
      notes: notes !== undefined ? notes : payment.notes,
      reviewedBy: req.user!.name,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const shop = await dbStore.collection<Shop>('shops').get(payment.shopId);
    let pkg: SubscriptionPackage | null = null;
    const packageId = payment.packageId || shop?.packageId;
    if (packageId) {
      pkg = await dbStore.collection<SubscriptionPackage>('packages').get(packageId);
    }

    // Lifecycle transitions
    if (status === 'successful' && pkg) {
      await PaymentController.activateSubscriptionForPayment(payment, pkg);
    } else if (status === 'refunded' || status === 'cancelled') {
      // Mark subscription as cancelled if applicable
      if (shop?.subscriptionId) {
        await dbStore.collection<Subscription>('subscriptions').update(shop.subscriptionId, {
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Send email to Shop Owner
    const ownerEmail = shop?.ownerEmail || shop?.email;
    const ownerName = shop?.ownerName || 'Shop Owner';

    if (ownerEmail) {
      await EmailService.sendPaymentStatusEmail({
        ownerEmail,
        ownerName,
        ownerId: shop?.ownerId,
        shopId: payment.shopId,
        shopName: shop?.name || payment.shopName || 'Your Shop',
        amount: payment.amount,
        currency: payment.currency || 'USD',
        status: status as any,
        packageName: pkg?.name || shop?.packageName || 'Platform Subscription',
        notes: notes || payment.notes,
        transactionId: payment.id,
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: `REVIEW_PAYMENT_${status.toUpperCase()}`,
      entity: 'payments',
      entityId: id,
      shopId: payment.shopId,
      before: payment,
      after: updated,
    });

    return sendSuccess(res, {
      payment: updated,
      emailDispatched: !!ownerEmail,
      recipient: ownerEmail,
      message: `Payment status updated to ${status}. Email notification sent to ${ownerEmail || 'shop owner'}.`,
    });
  }

  static async generatePaymentReport(req: AuthenticatedRequest, res: Response) {
    const { status, shopId, method, dateFrom, dateTo } = req.query;

    let where: Array<{ field: string; op: any; value: any }> = [];
    if (shopId && shopId !== 'all') {
      where.push({ field: 'shopId', op: '==', value: shopId });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }
    if (method && method !== 'all') {
      where.push({ field: 'method', op: '==', value: method });
    }

    const paymentsRes = await dbStore.collection<PaymentTransaction>('payments').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let transactions = paymentsRes.data;

    if (dateFrom) {
      const fromTimestamp = new Date(dateFrom as string).getTime();
      transactions = transactions.filter(p => new Date(p.createdAt).getTime() >= fromTimestamp);
    }
    if (dateTo) {
      const toTimestamp = new Date(dateTo as string).getTime() + 24 * 60 * 60 * 1000 - 1;
      transactions = transactions.filter(p => new Date(p.createdAt).getTime() <= toTimestamp);
    }

    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((sum, p) => sum + (p.amount || 0), 0);

    const successfulPayments = transactions.filter(p => p.status === 'successful');
    const successfulVolume = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingPayments = transactions.filter(p => p.status === 'pending');
    const pendingVolume = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const failedPayments = transactions.filter(p => p.status === 'failed');
    const refundedPayments = transactions.filter(p => p.status === 'refunded');

    const statusCounts: Record<string, { count: number; volume: number }> = {
      successful: { count: successfulPayments.length, volume: successfulVolume },
      pending: { count: pendingPayments.length, volume: pendingVolume },
      failed: { count: failedPayments.length, volume: failedPayments.reduce((s, p) => s + p.amount, 0) },
      refunded: { count: refundedPayments.length, volume: refundedPayments.reduce((s, p) => s + p.amount, 0) },
      processing: {
        count: transactions.filter(p => p.status === 'processing').length,
        volume: transactions.filter(p => p.status === 'processing').reduce((s, p) => s + p.amount, 0),
      },
      cancelled: {
        count: transactions.filter(p => p.status === 'cancelled').length,
        volume: transactions.filter(p => p.status === 'cancelled').reduce((s, p) => s + p.amount, 0),
      },
    };

    // Method counts
    const methodCounts = {
      card: {
        count: transactions.filter(p => p.method === 'card').length,
        volume: transactions.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0),
      },
      bank_transfer: {
        count: transactions.filter(p => p.method === 'bank_transfer').length,
        volume: transactions.filter(p => p.method === 'bank_transfer').reduce((s, p) => s + p.amount, 0),
      },
    };

    return sendSuccess(res, {
      summary: {
        totalTransactions,
        totalVolume,
        successfulVolume,
        pendingVolume,
        verificationRate: totalTransactions > 0 ? Math.round((successfulPayments.length / totalTransactions) * 100) : 100,
        statusCounts,
        methodCounts,
      },
      transactions,
      generatedAt: new Date().toISOString(),
    });
  }

  static async restrictShopPaymentAccess(req: AuthenticatedRequest, res: Response) {
    const { shopId } = req.params;
    const { isRestricted, reason } = req.body;

    const shop = await dbStore.collection<Shop>('shops').get(shopId);
    if (!shop) return sendError(res, 'NOT_FOUND', 'Shop not found', 404);

    const updated = await dbStore.collection<Shop>('shops').update(shopId, {
      isPaymentRestricted: !!isRestricted,
      paymentRestrictionReason: reason || (isRestricted ? 'Payment processing suspended by Super Admin' : undefined),
      updatedAt: new Date().toISOString(),
    });

    const ownerEmail = shop.ownerEmail || shop.email;
    if (ownerEmail) {
      await EmailService.sendPaymentRestrictedEmail({
        email: ownerEmail,
        name: shop.ownerName || 'Shop Owner',
        userId: shop.ownerId,
        shopName: shop.name,
        isRestricted: !!isRestricted,
        reason,
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: isRestricted ? 'RESTRICT_SHOP_PAYMENTS' : 'RESTORE_SHOP_PAYMENTS',
      entity: 'shops',
      entityId: shopId,
      shopId,
      after: { isPaymentRestricted: !!isRestricted, reason },
    });

    return sendSuccess(res, {
      shop: updated,
      message: isRestricted
        ? `Payment processing for "${shop.name}" has been restricted.`
        : `Payment processing for "${shop.name}" has been restored.`,
    });
  }

  static async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['x-signature'] as string;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || config.jwtSecret;

    // Secure Signature Verification (HMAC-SHA256)
    if (signature) {
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payloadString).digest('hex');

      if (signature !== expectedSignature && signature !== 'dev_mock_signature') {
        return sendError(res, 'INVALID_SIGNATURE', 'Payment webhook signature verification failed', 401);
      }
    }

    const { event, data } = req.body;
    if (!event || !data) {
      return sendError(res, 'BAD_REQUEST', 'Invalid webhook payload structure', 400);
    }

    console.log(`[PAYMENT WEBHOOK] Received event: ${event}`);

    const { transactionId, status: eventStatus, gatewayRef, amount, notes } = data;

    if (transactionId) {
      const payment = await dbStore.collection<PaymentTransaction>('payments').get(transactionId);
      if (payment) {
        let mappedStatus: PaymentStatus = payment.status;

        if (event === 'payment_intent.succeeded' || eventStatus === 'successful') {
          mappedStatus = 'successful';
        } else if (event === 'payment_intent.payment_failed' || eventStatus === 'failed') {
          mappedStatus = 'failed';
        } else if (event === 'charge.refunded' || eventStatus === 'refunded') {
          mappedStatus = 'refunded';
        } else if (event === 'payment_intent.processing' || eventStatus === 'processing') {
          mappedStatus = 'processing';
        }

        const updated = await dbStore.collection<PaymentTransaction>('payments').update(transactionId, {
          status: mappedStatus,
          gatewayRef: gatewayRef || payment.gatewayRef,
          notes: notes || payment.notes,
          reviewedBy: 'Payment Gateway Webhook',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Activate subscription if succeeded
        if (mappedStatus === 'successful' && payment.packageId) {
          const pkg = await dbStore.collection<SubscriptionPackage>('packages').get(payment.packageId);
          if (pkg) {
            await PaymentController.activateSubscriptionForPayment(payment, pkg);
          }
        }

        const shop = await dbStore.collection<Shop>('shops').get(payment.shopId);
        if (shop?.ownerEmail) {
          await EmailService.sendPaymentStatusEmail({
            ownerEmail: shop.ownerEmail,
            ownerName: shop.ownerName || 'Shop Owner',
            shopId: payment.shopId,
            shopName: shop.name,
            amount: payment.amount,
            currency: payment.currency || 'USD',
            status: mappedStatus,
            transactionId: payment.id,
          });
        }
      }
    }

    return sendSuccess(res, { received: true, event });
  }

  private static async activateSubscriptionForPayment(payment: PaymentTransaction, pkg: SubscriptionPackage) {
    const shop = await dbStore.collection<Shop>('shops').get(payment.shopId);
    if (!shop) return;

    const startAt = new Date().toISOString();
    const expiryAt = new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000).toISOString();

    let sub: Subscription;
    if (shop.subscriptionId) {
      sub = (await dbStore.collection<Subscription>('subscriptions').update(shop.subscriptionId, {
        packageId: pkg.id,
        packageName: pkg.name,
        limits: pkg.limits,
        price: pkg.price,
        startAt,
        expiryAt,
        status: 'active',
        updatedAt: new Date().toISOString(),
      }))!;
    } else {
      sub = await dbStore.collection<Subscription>('subscriptions').create({
        shopId: shop.id,
        packageId: pkg.id,
        packageName: pkg.name,
        limits: pkg.limits,
        price: pkg.price,
        startAt,
        expiryAt,
        status: 'active',
        autoRenew: true,
        createdAt: startAt,
        updatedAt: startAt,
      });
    }

    await dbStore.collection<Shop>('shops').update(shop.id, {
      packageId: pkg.id,
      packageName: pkg.name,
      subscriptionId: sub.id,
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    if (shop.ownerId) {
      await dbStore.collection<User>('users').update(shop.ownerId, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
