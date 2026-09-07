'use client';

import React, { useState, Suspense } from 'react';
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
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setError(err.message);
      } else {
        setError('Cannot connect to backend API server. Please ensure the backend is running.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-7 transition-all duration-300">
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

        {error && (
          <div className="rounded-xl bg-rose-50/80 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1" />
            <p className="leading-relaxed">{error}</p>
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
                  <label className="block font-bold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
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
