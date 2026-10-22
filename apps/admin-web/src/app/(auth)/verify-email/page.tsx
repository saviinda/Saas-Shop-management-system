'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Lock,
  MailCheck,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const registeredParam = searchParams.get('registered') === 'true';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Keep email synced if param loads
  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [emailParam, email]);

  // If token is provided in query params (clicked link from email), verify automatically on mount
  useEffect(() => {
    if (tokenParam) {
      handleVerifyByToken(tokenParam, emailParam);
    }
  }, [tokenParam, emailParam]);

  const extractErrorMessage = (err: any, fallback: string): string => {
    if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
      return err.details.map((d: any) => d.message || `${d.field}: invalid`).join('. ');
    }
    if (err?.message) return err.message;
    return fallback;
  };

  const handleVerifyByToken = async (tokenToVerify: string, emailToVerify?: string) => {
    setIsVerifying(true);
    setStatus('idle');
    setMessage(null);

    try {
      const res = await api.post<{ verified: boolean; alreadyVerified?: boolean; message: string }>(
        '/auth/verify-email',
        {
          token: tokenToVerify,
          email: emailToVerify || undefined,
        }
      );

      setStatus('success');
      setMessage(res.data?.message || 'Email verified successfully! You can now log in.');
      if (res.data?.alreadyVerified) {
        setIsAlreadyVerified(true);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(extractErrorMessage(err, 'Failed to verify email. The verification link may be invalid or expired.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your registered account email.');
      return;
    }
    if (!code.trim()) {
      setStatus('error');
      setMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifying(true);
    setStatus('idle');
    setMessage(null);

    try {
      const res = await api.post<{ verified: boolean; alreadyVerified?: boolean; message: string }>(
        '/auth/verify-email',
        {
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }
      );

      setStatus('success');
      setMessage(res.data?.message || 'Email verified successfully! You can now log in.');
      if (res.data?.alreadyVerified) {
        setIsAlreadyVerified(true);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(extractErrorMessage(err, 'Invalid verification code. Please check the code sent to your email or request a new one.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your account email address to resend verification.');
      return;
    }

    setIsResending(true);
    setStatus('idle');
    setMessage(null);

    try {
      const res = await api.post<{ message: string }>('/auth/resend-verification', {
        email: email.trim().toLowerCase(),
      });

      setStatus('success');
      setMessage(res.data?.message || 'A fresh verification email has been dispatched. Please check your inbox.');
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err: any) {
      setStatus('error');
      if (err instanceof ApiError) {
        setMessage(err.message);
      } else {
        setMessage('Failed to resend verification email. Please try again later.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-6 transition-all duration-300">
        {/* Header Branding */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold shadow-md shadow-indigo-200">
            <MailCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider mb-2">
              Security Verification
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Verify Your Email</h2>
            <p className="text-xs text-slate-500 font-medium">
              Mandatory account activation step before portal login
            </p>
          </div>
        </div>

        {/* Notice for newly registered users */}
        {registeredParam && status !== 'success' && (
          <div className="rounded-xl p-3.5 text-xs bg-indigo-50/90 border border-indigo-200 text-indigo-900 flex items-start gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
            <div>
              <p className="font-bold">Registration Submitted!</p>
              <p className="mt-0.5 leading-relaxed text-[11px]">
                We sent a 6-digit verification code and secure confirmation link to{' '}
                <span className="font-semibold underline">{email || 'your email address'}</span>. Please verify your email to log in.
              </p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status === 'success' && (
          <div className="rounded-xl p-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-in fade-in duration-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-emerald-950 text-sm">
                {isAlreadyVerified ? 'Email Already Verified' : 'Email Verified Successfully!'}
              </p>
              <p className="leading-relaxed text-[11px] text-emerald-800">{message}</p>
              <div className="pt-2">
                <Link
                  href="/login?verified=true"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                >
                  <span>Sign In to Portal</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Verification Error</p>
              <p className="leading-relaxed text-[11px]">{message}</p>
            </div>
          </div>
        )}

        {/* Code Entry Form (Shown if not yet successfully verified) */}
        {status !== 'success' && (
          <form onSubmit={handleVerifyByCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Account Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="owner@business.com"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  6-Digit Verification Code
                </label>
                <span className="text-[11px] text-slate-400 font-medium">From email</span>
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={code}
                  onChange={e => setCode(e.target.value.trim())}
                  placeholder="123456"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-4 text-xs font-mono font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Enter the 6-digit code or click the confirmation link in the verification email.
              </p>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying Account...</span>
                </>
              ) : (
                <>
                  <span>Verify Email & Activate Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Resend Section & Help */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
              Didn&apos;t receive the email?
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition-colors"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  <span>Resend Email</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Please allow up to 2 minutes for delivery and check your spam or promotions tab.
          </p>
        </div>

        {/* Back to Login Footer */}
        <div className="text-center pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            &larr; Back to Portal Login
          </Link>
          <Link
            href="/register"
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            Create Different Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
