'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api-client';
import {
  ShieldCheck,
  Store,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  ShieldAlert,
  LifeBuoy,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { checkPasswordStrength } from '@saas/validation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{
    message: string;
    isLockout?: boolean;
    isInactive?: boolean;
    isUnverified?: boolean;
    unverifiedEmail?: string;
    supportEmail?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportEmail, setSupportEmail] = useState<string>('savinda.codezela@gmail.com');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendVerificationMsg, setResendVerificationMsg] = useState<string | null>(null);

  // Notice banners from URL params
  const reasonParam = searchParams.get('reason');
  const timeoutParam = searchParams.get('timeout');
  const registeredParam = searchParams.get('registered');
  const verifiedParam = searchParams.get('verified');

  // Load configured platform support email
  useEffect(() => {
    let isMounted = true;
    api
      .get<{ supportEmail: string }>('/settings/support')
      .then(res => {
        if (isMounted && res.data?.supportEmail) {
          setSupportEmail(res.data.supportEmail);
        }
      })
      .catch(() => {
        // Fallback already defaults to configured sender
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyEmail = (emailToCopy: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(emailToCopy);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const getNotice = (): {
    type: 'success' | 'warning' | 'danger';
    title: string;
    message: string;
    isInactive?: boolean;
  } | null => {
    if (reasonParam === 'session_timeout' || timeoutParam === 'true') {
      return {
        type: 'warning',
        title: 'Session Timed Out',
        message: 'Your session has automatically expired due to 30 minutes of inactivity. Please log in again to continue.',
      };
    }
    if (reasonParam === 'session_expired') {
      return {
        type: 'warning',
        title: 'Session Expired',
        message: 'Your authentication token has expired. Please sign in to resume your session.',
      };
    }
    if (reasonParam === 'session_revoked') {
      return {
        type: 'danger',
        title: 'Session Revoked',
        message: 'Your active session was terminated or revoked by an administrator. Please log in again.',
      };
    }
    if (reasonParam === 'shop_inactive' || reasonParam === 'account_inactive') {
      return {
        type: 'danger',
        title: 'Account Inactive',
        message: 'Your account is inactive and access is restricted. Please contact platform support.',
        isInactive: true,
      };
    }
    if (verifiedParam === 'true') {
      return {
        type: 'success',
        title: 'Email Verified Successfully',
        message: 'Your email address has been verified. You can now sign in using your credentials.',
      };
    }
    if (registeredParam === 'true') {
      return {
        type: 'success',
        title: 'Registration Complete',
        message: 'Your shop and account have been registered! Please verify your email or sign in using your credentials.',
      };
    }
    return null;
  };

  const notice = getNotice();

  // Forgot / Reset Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState(searchParams.get('resetToken') || '');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post<any>('/auth/login', {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      login(res.data.token, res.data.user, res.data.shop, res.data.defaultBranch);

      if (res.data.user.role === 'super_admin') {
        router.push('/super-admin/dashboard');
      } else {
        router.push('/shop-owner/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const isLockout = err.code === 'ACCOUNT_LOCKED';
        const isInactive =
          err.code === 'ACCOUNT_INACTIVE' ||
          err.code === 'SHOP_INACTIVE' ||
          err.code === 'SHOP_SUSPENDED';
        const isUnverified = err.code === 'EMAIL_NOT_VERIFIED';
        const customSupportEmail = err.details?.supportEmail || supportEmail;
        if (err.details?.supportEmail) {
          setSupportEmail(err.details.supportEmail);
        }

        setError({
          message: isInactive
            ? 'Your account is inactive and access is restricted. Please contact platform support.'
            : isUnverified
            ? 'Your email address is not verified. Please verify your email before logging in.'
            : err.message,
          isLockout,
          isInactive,
          isUnverified,
          unverifiedEmail: err.details?.email || email,
          supportEmail: customSupportEmail,
        });
      } else {
        setError({
          message: 'Cannot connect to backend API server. Please ensure the backend is running.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    setIsForgotSubmitting(true);
    try {
      const res = await api.post<any>('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg({
        type: 'success',
        text: res.data?.message || 'Password reset token has been dispatched to your email.',
      });
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
      }
      setForgotStep('reset');
    } catch (err: any) {
      setForgotMsg({ type: 'error', text: err.message || 'Failed to request reset token.' });
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      setForgotMsg({
        type: 'error',
        text: strength.errors[0] || 'Password does not meet strong security requirements.',
      });
      return;
    }

    setIsForgotSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token: resetToken.trim(),
        newPassword: newPassword.trim(),
      });
      setForgotMsg({
        type: 'success',
        text: 'Password has been reset successfully! You can now log in.',
      });
      setPassword(newPassword);
      setEmail(forgotEmail || email);
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('request');
        setForgotMsg(null);
      }, 2000);
    } catch (err: any) {
      setForgotMsg({ type: 'error', text: err.message || 'Failed to reset password.' });
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  const renderSupportBox = (targetEmail: string) => {
    const activeTarget = targetEmail || supportEmail || 'savinda.codezela@gmail.com';
    const mailtoUrl = `mailto:${activeTarget}?subject=${encodeURIComponent(
      'Request to Reactivate Shop Account'
    )}&body=${encodeURIComponent(
      `Hello Platform Support,\n\nPlease reactivate my shop account.\n\nAccount Email: ${
        email || '[Enter your registered email address]'
      }\nReason: Requesting account review and reactivation.\n\nThank you.`
    )}`;

    return (
      <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-rose-900 inline-flex items-center gap-1.5 text-xs">
            <LifeBuoy className="h-3.5 w-3.5 text-rose-600" />
            Contact Platform Support
          </span>
          <span className="text-[10px] font-bold text-rose-600 bg-rose-100/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Reactivation
          </span>
        </div>
        <p className="text-[11px] text-rose-800 leading-relaxed">
          Please reach out to the platform administration team to request your shop account reactivation:
        </p>
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/90 border border-rose-200 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Mail className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="font-mono text-[11px] font-semibold text-rose-900 truncate select-all">
              {activeTarget}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopyEmail(activeTarget)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors border border-rose-200/60"
            title="Copy support email address"
          >
            {copiedEmail ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <a
          href={mailtoUrl}
          className="inline-flex items-center justify-center gap-1.5 w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-3 rounded-lg text-xs shadow-sm transition-colors text-center"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Contact Support</span>
          <ExternalLink className="h-3 w-3 opacity-80" />
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-6 transition-all duration-300">
        {/* Header Branding */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold shadow-md shadow-indigo-200">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider mb-2">
              Multi-Tenant SaaS
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Login</h2>
            <p className="text-xs text-slate-500 font-medium">Communication & Shop Management System</p>
          </div>
        </div>

        {/* Global Notice Banners */}
        {notice && (!error || !notice.isInactive) && (
          <div
            className={`rounded-xl p-3.5 text-xs flex items-start gap-2.5 border animate-in fade-in duration-200 ${
              notice.type === 'success'
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                : notice.type === 'warning'
                ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                : 'bg-rose-50/90 border-rose-200 text-rose-800'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : notice.type === 'warning' ? (
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold">{notice.title}</p>
              <p className="mt-0.5 leading-relaxed text-[11px]">{notice.message}</p>
              {notice.isInactive && renderSupportBox(supportEmail)}
            </div>
          </div>
        )}

        {/* Error / Account Lockout / Email Unverified Alert */}
        {error && (
          <div
            className={`rounded-xl border p-3.5 text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
              error.isLockout || error.isInactive
                ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                : error.isUnverified
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                : 'bg-rose-50/80 border-rose-200 text-rose-700'
            }`}
          >
            {error.isLockout || error.isInactive ? (
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : error.isUnverified ? (
              <Mail className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1 min-w-0">
              {error.isLockout && <p className="font-bold text-rose-800">Account Temporarily Locked</p>}
              {error.isInactive && <p className="font-bold text-rose-800">Access Restricted</p>}
              {error.isUnverified && <p className="font-bold text-amber-900">Email Verification Required</p>}
              <p className="leading-relaxed">{error.message}</p>
              {error.isLockout && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline"
                >
                  <KeyRound className="h-3 w-3" />
                  Reset your password to unlock now
                </button>
              )}
              {error.isInactive && renderSupportBox(error.supportEmail || supportEmail)}
              {error.isUnverified && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-200/80 space-y-2">
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Check your email for the 6-digit verification code or click the button below to complete verification:
                  </p>
                  {resendVerificationMsg && (
                    <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-1.5 px-2">
                      {resendVerificationMsg}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(error.unverifiedEmail || email)}`}
                      className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-xs transition-colors text-center"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verify Email Now</span>
                    </Link>
                    <button
                      type="button"
                      disabled={isResendingVerification}
                      onClick={async () => {
                        const target = error.unverifiedEmail || email;
                        if (!target) return;
                        setIsResendingVerification(true);
                        setResendVerificationMsg(null);
                        try {
                          await api.post('/auth/resend-verification', { email: target.trim().toLowerCase() });
                          setResendVerificationMsg('Fresh verification email sent! Please check your inbox.');
                          setTimeout(() => setResendVerificationMsg(null), 5000);
                        } catch (resendErr: any) {
                          setResendVerificationMsg(resendErr.message || 'Failed to resend email.');
                        } finally {
                          setIsResendingVerification(false);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border border-amber-300 hover:bg-amber-100/70 text-amber-900 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isResendingVerification ? 'animate-spin' : ''}`} />
                      <span>{isResendingVerification ? 'Sending...' : 'Resend Code'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@business.com"
                className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Demo Logins Box */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2 text-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Demo Login Shortcuts</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('admin@platform.com', 'Admin@123456')}
              className="p-2 text-left bg-white rounded-lg border border-slate-200/80 hover:border-indigo-500/50 hover:bg-indigo-50/30 transition-all text-[11px] font-medium text-slate-700 shadow-2xs"
            >
              <span className="font-bold text-indigo-700 block">Super Admin</span>
              admin@platform.com
            </button>
            <button
              type="button"
              onClick={() => fillDemo('owner@urbancafe.com', 'Shop@123456')}
              className="p-2 text-left bg-white rounded-lg border border-slate-200/80 hover:border-indigo-500/50 hover:bg-indigo-50/30 transition-all text-[11px] font-medium text-slate-700 shadow-2xs"
            >
              <span className="font-bold text-slate-900 block">Shop Owner</span>
              owner@urbancafe.com
            </button>
          </div>
        </div>

        {/* Footer Registration Link */}
        <p className="text-center text-xs text-slate-500">
          Want to register a new shop?{' '}
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Create Store Account
          </Link>
        </p>
      </div>

      {/* FORGOT / RESET PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {forgotStep === 'request' ? 'Forgot Your Password?' : 'Reset Account Password'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotMsg(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {forgotMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  forgotMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {forgotMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : null}
                <p>{forgotMsg.text}</p>
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestResetToken} className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Enter your registered account email address. We will generate and dispatch a secure password reset token.
                </p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. owner@store.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('reset')}
                    className="text-indigo-600 hover:underline text-[11px]"
                  >
                    Already have a token?
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50"
                  >
                    {isForgotSubmitting ? 'Dispatching...' : 'Send Reset Token'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleExecutePasswordReset} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reset Token</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter the reset token sent to your email"
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars with upper, lower, number, symbol"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <PasswordStrengthIndicator password={newPassword} className="mt-2" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="text-slate-500 hover:underline text-[11px]"
                  >
                    &larr; Back to request
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50"
                  >
                    {isForgotSubmitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
