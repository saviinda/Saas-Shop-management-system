import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbStore } from '../../db/store';
import { User, Shop, Branch, SubscriptionPackage, Subscription } from '@saas/types';
import { config } from '../../config/env';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../middleware/auth';
import { AuditLogService } from '../../services/auditLog.service';
import { NotificationService } from '../../services/notification.service';
import { EmailService } from '../../services/email.service';
import { seedDatabase } from '../../scripts/seed';
import { checkPasswordStrength, validateSriLankanPhone } from '@saas/validation';

export class AuthController {
  static async login(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();

    if (!email || !password) {
      return sendError(res, 'INVALID_INPUT', 'Email and password are required', 400);
    }

    // Auto-bootstrap seed if database is empty
    const userCount = await dbStore.collection('users').count();
    if (userCount === 0) {
      console.log('Database empty on login attempt. Automatically running seedDatabase...');
      await seedDatabase();
    }

    let users = await dbStore.collection<User & { passwordHash?: string }>('users').query({
      where: [{ field: 'email', op: '==', value: email }],
    });

    let user = users.data[0];

    // If still not found and this is the default admin or shop owner, re-seed
    if (!user && (email === 'admin@platform.com' || email === 'owner@urbancafe.com')) {
      console.log(`Default user ${email} not found in store. Refreshing seed accounts...`);
      await seedDatabase();
      users = await dbStore.collection<User & { passwordHash?: string }>('users').query({
        where: [{ field: 'email', op: '==', value: email }],
      });
      user = users.data[0];
    }

    if (!user) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 15;

    // Check if account is currently locked out
    if (user.lockoutUntil) {
      const lockoutTime = new Date(user.lockoutUntil).getTime();
      const now = Date.now();
      if (now < lockoutTime) {
        const remainingMinutes = Math.max(1, Math.ceil((lockoutTime - now) / (60 * 1000)));
        return sendError(
          res,
          'ACCOUNT_LOCKED',
          `Your account is temporarily locked due to multiple consecutive failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} or reset your password.`,
          423
        );
      } else {
        // Lockout expired - automatically clear lockout
        await dbStore.collection<User>('users').update(user.id, {
          failedLoginAttempts: 0,
          lockoutUntil: undefined,
          updatedAt: new Date().toISOString(),
        });
        user.failedLoginAttempts = 0;
        user.lockoutUntil = undefined;
      }
    }

    // Check password hash
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    // Fallback for default seeded credentials
    if (!isMatch) {
      if (email === 'admin@platform.com' && password === 'Admin@123456') {
        isMatch = true;
      } else if (email === 'owner@urbancafe.com' && password === 'Shop@123456') {
        isMatch = true;
      } else if (email.endsWith('@urbancafe.com') && password === 'Staff@123456') {
        isMatch = true;
      }
    }

    if (!isMatch) {
      const currentAttempts = (user.failedLoginAttempts || 0) + 1;
      const isNowLocked = currentAttempts >= MAX_FAILED_ATTEMPTS;
      const lockoutUntil = isNowLocked
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : undefined;

      await dbStore.collection<User>('users').update(user.id, {
        failedLoginAttempts: currentAttempts,
        lockoutUntil,
        updatedAt: new Date().toISOString(),
      });

      if (isNowLocked) {
        await AuditLogService.log({
          actor: user,
          action: 'ACCOUNT_LOCKOUT',
          entity: 'users',
          entityId: user.id,
          shopId: user.shopId,
        });

        return sendError(
          res,
          'ACCOUNT_LOCKED',
          `Your account has been locked due to ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts. Please try again in ${LOCKOUT_MINUTES} minutes or reset your password.`,
          423
        );
      }

      const remainingAttempts = MAX_FAILED_ATTEMPTS - currentAttempts;
      return sendError(
        res,
        'INVALID_CREDENTIALS',
        `Invalid email or password. You have ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining before account lockout.`,
        401
      );
    }

    // Password matches - reset failed attempts and lockout if any
    if (user.failedLoginAttempts || user.lockoutUntil) {
      await dbStore.collection<User>('users').update(user.id, {
        failedLoginAttempts: 0,
        lockoutUntil: undefined,
        updatedAt: new Date().toISOString(),
      });
      user.failedLoginAttempts = 0;
      user.lockoutUntil = undefined;
    }

    if (user.emailVerified === false) {
      return sendError(
        res,
        'EMAIL_NOT_VERIFIED',
        'Your email address has not been verified yet. Please check your inbox and verify your email before logging in.',
        403,
        {
          email: user.email,
          requiresEmailVerification: true,
        }
      );
    }

    const getPlatformSupportEmail = async (): Promise<string> => {
      try {
        const settings = await dbStore.collection<any>('settings').get('platform');
        return (settings?.supportEmail || config.brevo.senderEmail || config.email.user || 'savinda.codezela@gmail.com').trim();
      } catch {
        return (config.brevo.senderEmail || config.email.user || 'savinda.codezela@gmail.com').trim();
      }
    };

    if (user.status !== 'active') {
      const supportEmail = await getPlatformSupportEmail();
      return sendError(
        res,
        'ACCOUNT_INACTIVE',
        'Your account is inactive and access is restricted. Please contact platform support.',
        403,
        { supportEmail }
      );
    }

    // If user belongs to a shop, verify the shop itself is active
    if (user.shopId && user.role !== 'super_admin') {
      const shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (!shop || shop.status === 'inactive' || shop.status === 'suspended') {
        const supportEmail = await getPlatformSupportEmail();
        return sendError(
          res,
          shop?.status === 'suspended' ? 'SHOP_SUSPENDED' : 'SHOP_INACTIVE',
          'Your account is inactive and access is restricted. Please contact platform support.',
          403,
          { supportEmail }
        );
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, shopId: user.shopId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    let shop: Shop | null = null;
    let defaultBranch: Branch | null = null;

    if (user.shopId) {
      shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (shop?.defaultBranchId) {
        defaultBranch = await dbStore.collection<Branch>('branches').get(shop.defaultBranchId);
      }
    }

    await AuditLogService.log({
      actor: user,
      action: 'LOGIN',
      entity: 'users',
      entityId: user.id,
      shopId: user.shopId,
    });

    const { passwordHash: _, ...safeUser } = user;
    return sendSuccess(res, {
      token,
      user: safeUser,
      shop,
      defaultBranch,
    });
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    if (req.user) {
      await AuditLogService.log({
        actor: req.user,
        action: 'LOGOUT',
        entity: 'users',
        entityId: req.user.id,
        shopId: req.user.shopId,
      });
    }
    return sendSuccess(res, { message: 'Logged out successfully' });
  }

  static async changePassword(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return sendError(res, 'BAD_REQUEST', 'Both old password and new password are required', 400);
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      return sendError(res, 'WEAK_PASSWORD', `Password requirements not met: ${strength.errors.join(', ')}`, 400);
    }

    const userWithHash = await dbStore.collection<User & { passwordHash?: string }>('users').get(req.user.id);
    if (!userWithHash) return sendError(res, 'NOT_FOUND', 'User account not found', 404);

    // Verify old password
    let isOldMatch = false;
    if (userWithHash.passwordHash) {
      isOldMatch = await bcrypt.compare(oldPassword, userWithHash.passwordHash);
    }
    // Fallback check for initial seeded admin/owner
    if (!isOldMatch) {
      if (userWithHash.email === 'admin@platform.com' && oldPassword === 'Admin@123456') isOldMatch = true;
      if (userWithHash.email === 'owner@urbancafe.com' && oldPassword === 'Shop@123456') isOldMatch = true;
    }

    if (!isOldMatch) {
      return sendError(res, 'INVALID_PASSWORD', 'The current/old password provided is incorrect', 400);
    }

    const newHash = await bcrypt.hash(newPassword.trim(), 10);
    await dbStore.collection<User & { passwordHash?: string }>('users').update(req.user.id, {
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    });

    // Send confirmation email
    await EmailService.sendPasswordChangedEmail({
      email: userWithHash.email,
      name: userWithHash.name,
      userId: userWithHash.id,
    });

    await AuditLogService.log({
      actor: req.user,
      action: 'CHANGE_PASSWORD',
      entity: 'users',
      entityId: req.user.id,
      shopId: req.user.shopId,
    });

    return sendSuccess(res, { message: 'Password changed successfully' });
  }

  static async forgotPassword(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return sendError(res, 'BAD_REQUEST', 'Email address is required', 400);
    }

    const usersRes = await dbStore.collection<User & { passwordResetToken?: string; passwordResetExpires?: string }>('users').query({
      where: [{ field: 'email', op: '==', value: email }],
    });

    const user = usersRes.data[0];
    if (!user) {
      // Return success response to prevent email enumeration attack
      return sendSuccess(res, {
        message: 'If an account exists with this email, a password reset token has been dispatched.',
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await dbStore.collection<User & { passwordResetToken?: string; passwordResetExpires?: string }>('users').update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: expiresAt,
      updatedAt: new Date().toISOString(),
    });

    // Send email with reset token
    await EmailService.sendForgotPasswordEmail({
      email: user.email,
      name: user.name,
      userId: user.id,
      resetToken,
      expiresMinutes: 60,
    });

    return sendSuccess(res, {
      message: 'Password reset instructions have been dispatched to your email address.',
      resetToken, // Provided in development response for convenience
    });
  }

  static async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(res, 'BAD_REQUEST', 'Reset token and new password are required', 400);
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      return sendError(res, 'WEAK_PASSWORD', `Password requirements not met: ${strength.errors.join(', ')}`, 400);
    }

    const usersRes = await dbStore.collection<User & { passwordHash?: string; passwordResetToken?: string; passwordResetExpires?: string }>('users').query({
      where: [{ field: 'passwordResetToken', op: '==', value: token.trim() }],
    });

    const user = usersRes.data[0];
    if (!user) {
      return sendError(res, 'INVALID_TOKEN', 'Invalid or expired password reset token', 400);
    }

    if (user.passwordResetExpires && new Date() > new Date(user.passwordResetExpires)) {
      return sendError(res, 'TOKEN_EXPIRED', 'Password reset token has expired. Please request a new one.', 400);
    }

    const newHash = await bcrypt.hash(newPassword.trim(), 10);

    await dbStore.collection<User & { passwordHash?: string; passwordResetToken?: string; passwordResetExpires?: string; failedLoginAttempts?: number; lockoutUntil?: string }>('users').update(user.id, {
      passwordHash: newHash,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
      status: 'active', // Unlock/reactivate if locked
      updatedAt: new Date().toISOString(),
    });

    await EmailService.sendPasswordChangedEmail({
      email: user.email,
      name: user.name,
      userId: user.id,
    });

    return sendSuccess(res, { message: 'Password reset successful. You can now log in with your new password.' });
  }

  static async registerShopOwner(req: Request, res: Response) {
    const {
      name,
      email,
      password,
      phone,
      businessName,
      businessAddress,
      businessCategory,
      packageId,
    } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();

    const strength = checkPasswordStrength(password);
    if (!strength.isValid) {
      return sendError(res, 'WEAK_PASSWORD', `Password requirements not met: ${strength.errors.join(', ')}`, 400);
    }

    const existingUsers = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: normalizedEmail }],
    });
    const existingShops = await dbStore.collection<Shop>('shops').query({
      where: [{ field: 'email', op: '==', value: normalizedEmail }],
    });

    if (existingUsers.data.length > 0 || existingShops.data.length > 0) {
      return sendError(
        res,
        'EMAIL_EXISTS',
        'This email address is already registered. Please log in or use a different email address.',
        400
      );
    }

    // Validate Sri Lankan phone number format
    const phoneValidation = validateSriLankanPhone(phone);
    if (!phoneValidation.isValid) {
      return sendError(
        res,
        'INVALID_PHONE',
        phoneValidation.error || 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567)',
        400
      );
    }
    const formattedPhone = phoneValidation.normalized || phone;

    // 1. Automatically assign the Free Subscription Plan by default for all new shop registrations
    let targetPkg: SubscriptionPackage | null = null;
    const freeQuery = await dbStore.collection<SubscriptionPackage>('packages').query({
      where: [{ field: 'price', op: '==', value: 0 }],
    });
    targetPkg = freeQuery.data[0] || (await dbStore.collection<SubscriptionPackage>('packages').get('pkg_free'));

    if (!targetPkg) {
      const allPkgs = await dbStore.collection<SubscriptionPackage>('packages').query();
      targetPkg = allPkgs.data.find(p => p.price === 0) || allPkgs.data[0];
    }

    if (!targetPkg) {
      return sendError(res, 'PACKAGE_NOT_FOUND', 'No subscription package available for registration', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'usr_' + Date.now();
    const shopId = 'shp_' + Date.now();
    const branchId = 'br_' + Date.now();
    const subId = 'sub_' + Date.now();

    // 1. Create Default Branch (BR-13)
    const branch = await dbStore.collection<Branch>('branches').create({
      id: branchId,
      shopId,
      name: `${businessName} - Main Branch`,
      code: 'MAIN-01',
      address: businessAddress,
      phone: formattedPhone,
      isDefault: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Create Subscription
    const subscription = await dbStore.collection<Subscription>('subscriptions').create({
      id: subId,
      shopId,
      packageId: targetPkg.id,
      packageName: targetPkg.name,
      limits: targetPkg.limits,
      price: targetPkg.price,
      startAt: new Date().toISOString(),
      expiryAt: new Date(Date.now() + (targetPkg.durationDays || 365) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      autoRenew: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Create Shop
    const shop = await dbStore.collection<Shop>('shops').create({
      id: shopId,
      name: businessName,
      ownerId: userId,
      ownerName: name,
      ownerEmail: normalizedEmail,
      contactNumber: formattedPhone,
      email: normalizedEmail,
      address: businessAddress,
      category: businessCategory,
      status: 'active',
      packageId: targetPkg.id,
      packageName: targetPkg.name,
      subscriptionId: subscription.id,
      defaultBranchId: branch.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Create User with mandatory email verification pending
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 minutes

    const user = await dbStore.collection<User & { passwordHash: string }>('users').create({
      id: userId,
      email: normalizedEmail,
      name,
      role: 'shop_owner',
      status: 'active',
      shopId: shop.id,
      branchIds: [branch.id],
      phone: formattedPhone,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Send Mandatory Email Verification (Code & Clickable Link)
    await EmailService.sendEmailVerification({
      email: normalizedEmail,
      name,
      shopName: businessName,
      verificationToken,
      verificationCode,
      userId: user.id,
      shopId: shop.id,
      expiresMinutes: 60,
    });

    // Notify Super Admins
    await NotificationService.notifySuperAdmins({
      title: 'New Shop Registered (Verification Pending)',
      message: `Shop "${businessName}" has registered with ${targetPkg.name} (email verification pending).`,
      link: `/super-admin/shops`,
    });

    const {
      passwordHash: _,
      emailVerificationToken: __,
      emailVerificationCode: ___,
      ...safeUser
    } = user;

    return sendSuccess(
      res,
      {
        email: normalizedEmail,
        emailVerified: false,
        requiresVerification: true,
        user: safeUser,
        shop,
        defaultBranch: branch,
        message: 'Account created successfully! Please verify your email address to activate your account.',
      },
      undefined,
      201
    );
  }

  static async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    let shop: Shop | null = null;
    let defaultBranch: Branch | null = null;
    let branches: Branch[] = [];

    if (req.user.shopId) {
      shop = await dbStore.collection<Shop>('shops').get(req.user.shopId);
      const bRes = await dbStore.collection<Branch>('branches').query({
        where: [{ field: 'shopId', op: '==', value: req.user.shopId }],
      });
      branches = bRes.data;
      defaultBranch = branches.find(b => b.isDefault) || branches[0] || null;
    }

    return sendSuccess(res, {
      user: req.user,
      shop,
      defaultBranch,
      branches,
    });
  }

  // Ephemeral in-memory OTP store
  private static otpStore: Map<string, { code: string; expiresAt: number; purpose: string }> = new Map();

  static async sendOtp(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();
    const purpose = (req.body.purpose || 'Security Verification').trim();

    if (!email) {
      return sendError(res, 'INVALID_INPUT', 'Email address is required for OTP', 400);
    }

    // Generate 6-digit cryptographic OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresMinutes = 10;
    const expiresAt = Date.now() + expiresMinutes * 60 * 1000;

    AuthController.otpStore.set(email, { code: otpCode, expiresAt, purpose });

    let userName = 'Valued User';
    const users = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: email }],
    });
    if (users.data[0]?.name) {
      userName = users.data[0].name;
    }

    await EmailService.sendOtpEmail({
      email,
      name: userName,
      otpCode,
      purpose,
      expiresMinutes,
      userId: users.data[0]?.id,
    });

    return sendSuccess(res, {
      message: `Verification code sent to ${email}`,
      expiresMinutes,
    });
  }

  static async verifyOtp(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || req.body.otpCode || '').trim();

    if (!email || !code) {
      return sendError(res, 'INVALID_INPUT', 'Email and OTP code are required', 400);
    }

    const record = AuthController.otpStore.get(email);
    if (!record) {
      return sendError(res, 'INVALID_OTP', 'No verification code found. Please request a new one.', 400);
    }

    if (Date.now() > record.expiresAt) {
      AuthController.otpStore.delete(email);
      return sendError(res, 'OTP_EXPIRED', 'Verification code has expired. Please request a new code.', 400);
    }

    if (record.code !== code) {
      return sendError(res, 'INVALID_OTP', 'Invalid verification code. Please check and try again.', 400);
    }

    // Code verified successfully - remove OTP to prevent reuse
    AuthController.otpStore.delete(email);

    return sendSuccess(res, {
      verified: true,
      message: 'Verification code verified successfully',
    });
  }

  static async verifyEmail(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();
    const token = (req.body.token || '').trim();
    const code = (req.body.code || req.body.verificationCode || '').trim();

    if (!token && (!email || !code)) {
      return sendError(
        res,
        'INVALID_REQUEST',
        'Please provide a verification token or your registered email with the 6-digit verification code.',
        400
      );
    }

    let user: (User & { passwordHash?: string }) | undefined;

    if (token) {
      const usersRes = await dbStore.collection<User & { passwordHash?: string }>('users').query({
        where: [{ field: 'emailVerificationToken', op: '==', value: token }],
      });
      user = usersRes.data[0];
    } else if (email) {
      const usersRes = await dbStore.collection<User & { passwordHash?: string }>('users').query({
        where: [{ field: 'email', op: '==', value: email }],
      });
      user = usersRes.data[0];
    }

    if (!user) {
      return sendError(
        res,
        'INVALID_TOKEN',
        'Invalid or expired verification link/code. Please check your email or request a new one.',
        400
      );
    }

    if (user.emailVerified === true && !user.emailVerificationToken && !user.emailVerificationCode) {
      return sendSuccess(res, {
        verified: true,
        alreadyVerified: true,
        message: 'Your email address is already verified. You can log in directly.',
      });
    }

    // Verify code if verifying by code
    if (!token && code) {
      if (user.emailVerificationCode !== code) {
        return sendError(
          res,
          'INVALID_CODE',
          'Invalid verification code. Please check the 6-digit code sent to your email.',
          400
        );
      }
    }

    // Check expiration
    if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
      return sendError(
        res,
        'VERIFICATION_EXPIRED',
        'Verification link or code has expired. Please request a new verification email.',
        400,
        { email: user.email, expired: true }
      );
    }

    // Update user to verified
    await dbStore.collection<User>('users').update(user.id, {
      emailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationCode: undefined,
      emailVerificationExpires: undefined,
      updatedAt: new Date().toISOString(),
    });

    // Send Welcome Email now that they are verified
    if (user.shopId) {
      const shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (shop) {
        await EmailService.sendRegistrationWelcomeEmail({
          email: user.email,
          name: user.name,
          shopName: shop.name,
          packageName: shop.packageName || 'Free Starter Plan',
          shopId: shop.id,
          userId: user.id,
        }).catch(err => console.error('Failed to send welcome email post verification:', err));
      }
    }

    await AuditLogService.log({
      actor: user,
      action: 'EMAIL_VERIFIED',
      entity: 'users',
      entityId: user.id,
      shopId: user.shopId,
    });

    return sendSuccess(res, {
      verified: true,
      email: user.email,
      message: 'Email verified successfully! You can now log in using your registered credentials.',
    });
  }

  static async resendVerification(req: Request, res: Response) {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return sendError(res, 'BAD_REQUEST', 'Email address is required to resend verification.', 400);
    }

    const usersRes = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: email }],
    });

    const user = usersRes.data[0];

    // If user does not exist, return success to prevent email enumeration
    if (!user) {
      return sendSuccess(res, {
        message: 'If an unverified account exists with this email address, a verification email has been sent.',
      });
    }

    if (user.emailVerified === true && !user.emailVerificationToken) {
      return sendError(
        res,
        'ALREADY_VERIFIED',
        'This email address has already been verified. You can log in directly.',
        400
      );
    }

    // Generate new token & code
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 minutes

    await dbStore.collection<User>('users').update(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires,
      updatedAt: new Date().toISOString(),
    });

    let shopName = 'Your Print Shop';
    if (user.shopId) {
      const shop = await dbStore.collection<Shop>('shops').get(user.shopId);
      if (shop?.name) shopName = shop.name;
    }

    await EmailService.sendEmailVerification({
      email: user.email,
      name: user.name,
      shopName,
      verificationToken,
      verificationCode,
      userId: user.id,
      shopId: user.shopId,
      expiresMinutes: 60,
    });

    return sendSuccess(res, {
      message: `A fresh verification email has been dispatched to ${user.email}. Please check your inbox.`,
    });
  }

  static async checkEmail(req: Request, res: Response) {
    const email = (req.body.email || req.query.email || '').toString().trim().toLowerCase();
    if (!email) {
      return sendError(res, 'INVALID_INPUT', 'Email address is required', 400);
    }

    const existingUsers = await dbStore.collection<User>('users').query({
      where: [{ field: 'email', op: '==', value: email }],
    });
    const existingShops = await dbStore.collection<Shop>('shops').query({
      where: [{ field: 'email', op: '==', value: email }],
    });

    const isRegistered = existingUsers.data.length > 0 || existingShops.data.length > 0;

    return sendSuccess(res, {
      available: !isRegistered,
      registered: isRegistered,
      message: isRegistered
        ? 'This email address is already registered. Please log in or use a different email address.'
        : 'Email address is available for registration.',
    });
  }
}
