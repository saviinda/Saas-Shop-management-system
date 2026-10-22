'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { SubscriptionPackage } from '@saas/types';
import {
  Store,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Tag,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  MailCheck,
} from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { checkPasswordStrength, validateSriLankanPhone } from '@saas/validation';

export default function RegisterPage() {
  const router = useRouter();

  // Wizard Step: 'form' | 'verify' | 'completed'
  const [step, setStep] = useState<'form' | 'verify' | 'completed'>('form');

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    businessAddress: '',
    businessCategory: 'Retail & Specialty Store',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field-level error & validation states
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailAvailable, setEmailAvailable] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneValid, setPhoneValid] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification Step States
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);

  // Load packages
  useEffect(() => {
    api
      .get<SubscriptionPackage[]>('/packages')
      .then(res => {
        const pkgs = res.data || [];
        setPackages(pkgs);
        // Auto-assign Free Plan by default
        const freePkg = pkgs.find(p => p.price === 0 || p.id === 'pkg_free');
        if (freePkg) {
          setSelectedPackageId(freePkg.id);
        } else if (pkgs.length > 0) {
          setSelectedPackageId(pkgs[0].id);
        }
      })
      .catch(err => console.error('Failed to load packages:', err));
  }, []);

  // Countdown timer for resend code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Extract clear, friendly error messages
  const extractErrorMessage = (err: any): string => {
    if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
      return err.details.map((d: any) => d.message || `${d.field}: invalid`).join('. ');
    }
    if (err?.message) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    return 'Failed to complete shop registration. Please check your information and try again.';
  };

  // Validate Email Uniqueness (on blur / debounced)
  const handleCheckEmailUniqueness = async (emailToCheck: string) => {
    const trimmed = emailToCheck.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEmailAvailable(false);
      setEmailError(null);
      return;
    }

    setEmailCheckLoading(true);
    setEmailError(null);
    setEmailAvailable(false);

    try {
      const res = await api.post<{ available: boolean; registered: boolean; message: string }>(
        '/auth/check-email',
        { email: trimmed }
      );

      if (res.data?.registered) {
        setEmailError('This email address is already registered. Please log in or use a different email address.');
        setEmailAvailable(false);
      } else {
        setEmailError(null);
        setEmailAvailable(true);
      }
    } catch (err: any) {
      // If error occurs, leave check for submit time
      console.warn('Email check error:', err);
    } finally {
      setEmailCheckLoading(false);
    }
  };

  // Validate Sri Lankan Phone Format
  const handlePhoneChange = (raw: string) => {
    setFormData(prev => ({ ...prev, phone: raw }));
    setError(null);

    if (!raw.trim()) {
      setPhoneError(null);
      setPhoneValid(false);
      return;
    }

    const check = validateSriLankanPhone(raw);
    if (!check.isValid) {
      setPhoneError(check.error || 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567)');
      setPhoneValid(false);
    } else {
      setPhoneError(null);
      setPhoneValid(true);
    }
  };

  // Submit Registration Form -> Initiates Verification Code
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Password check
    const strength = checkPasswordStrength(formData.password);
    if (!strength.isValid) {
      setError(strength.errors[0] || 'Password does not meet strong security requirements.');
      return;
    }

    if (formData.password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    // 2. Sri Lankan Phone check
    const phoneCheck = validateSriLankanPhone(formData.phone);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567).');
      setPhoneError(phoneCheck.error || 'Invalid Sri Lankan mobile number');
      return;
    }

    // 3. Email check
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post<any>('/auth/register', {
        ...formData,
        phone: phoneCheck.normalized || formData.phone,
        packageId: selectedPackageId || 'pkg_free',
      });

      // Transition smoothly into Step 2 (Email OTP verification)
      setStep('verify');
      setResendCooldown(60);
      setVerifyError(null);
      setVerifySuccessMsg(null);
    } catch (err: any) {
      const friendlyMsg = extractErrorMessage(err);
      setError(friendlyMsg);
      if (friendlyMsg.toLowerCase().includes('already registered')) {
        setEmailError('This email address is already registered. Please log in or use a different email address.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP Verification Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifySuccessMsg(null);

    const cleanCode = verificationCode.trim();
    if (!cleanCode) {
      setVerifyError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifying(true);

    try {
      const res = await api.post<{ verified: boolean; message: string }>('/auth/verify-email', {
        email: formData.email.trim().toLowerCase(),
        code: cleanCode,
      });

      setVerifySuccessMsg(res.data?.message || 'Email verified successfully! Your shop account is now active.');
      setStep('completed');
    } catch (err: any) {
      setVerifyError(extractErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setVerifyError(null);
    setResendSuccessMsg(null);

    try {
      const res = await api.post<{ message: string }>('/auth/resend-verification', {
        email: formData.email.trim().toLowerCase(),
      });
      setResendSuccessMsg(res.data?.message || 'A fresh 6-digit verification code has been dispatched to your email.');
      setResendCooldown(60);
      setTimeout(() => setResendSuccessMsg(null), 5000);
    } catch (err: any) {
      setVerifyError(extractErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-7 transition-all duration-300">
        
        {/* Step Progress Tracker */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
          <div className={`flex items-center gap-1.5 ${step === 'form' ? 'text-indigo-600 font-bold' : 'text-emerald-600'}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
              step === 'form' ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {step !== 'form' ? <Check className="h-3.5 w-3.5" /> : '1'}
            </span>
            <span>Shop Details</span>
          </div>
          <span className="text-slate-300">&bull;&bull;&bull;</span>
          <div className={`flex items-center gap-1.5 ${
            step === 'verify' ? 'text-indigo-600 font-bold' : step === 'completed' ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
              step === 'verify'
                ? 'bg-indigo-600 text-white'
                : step === 'completed'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {step === 'completed' ? <Check className="h-3.5 w-3.5" /> : '2'}
            </span>
            <span>Email Verification</span>
          </div>
          <span className="text-slate-300">&bull;&bull;&bull;</span>
          <div className={`flex items-center gap-1.5 ${step === 'completed' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
              step === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </span>
            <span>Activation</span>
          </div>
        </div>

        {/* STEP 1: Registration Form */}
        {step === 'form' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold shadow-md shadow-indigo-200">
                <Store className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider">
                Instant Onboarding
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Register Business Account</h2>
              <p className="text-xs text-slate-500 font-medium">
                Complete your details below. You will receive an email verification code before activation.
              </p>
            </div>

            {/* Error Alert Box */}
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-rose-900">Registration Notice</p>
                  <p className="leading-relaxed">{error}</p>
                  {error.toLowerCase().includes('already registered') && (
                    <div className="pt-1.5">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline"
                      >
                        <span>Sign In to Existing Account</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitRegistration} className="space-y-6">
              {/* 1. Subscription Plan (Free Default) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Subscription Plan (Default Auto-Assigned)
                  </label>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    Free Forever Tier • No Upfront Payment
                  </span>
                </div>

                <div className="rounded-2xl border-2 border-indigo-600 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {packages.find(p => p.price === 0)?.name || 'Free Starter Plan'}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                          Free Plan
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Standard multi-tenant management features with zero payment obligation
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-2xl font-black text-indigo-700 tracking-tight">
                        LKR 0<span className="text-xs text-slate-500 font-normal"> / month</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-indigo-100/80 text-[11px] text-slate-700 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>1 Default Store Branch</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>2 Operational Staff Users</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>50 Active Products & POS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Shop Owner Credentials */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                  2. Shop Owner Credentials
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Marcus Vance"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                    </div>
                  </div>

                  {/* Email Address with Real-time Check */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700">Email Address *</label>
                      {emailCheckLoading && (
                        <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onBlur={e => handleCheckEmailUniqueness(e.target.value)}
                        onChange={e => {
                          setFormData({ ...formData, email: e.target.value });
                          setEmailError(null);
                          setEmailAvailable(false);
                        }}
                        placeholder="owner@business.com"
                        className={`w-full rounded-xl bg-slate-50/70 border py-2.5 pl-10 pr-10 text-xs text-slate-900 focus:bg-white focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100 ${
                          emailError
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                            : emailAvailable
                            ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                            : 'border-slate-200/90 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                        }`}
                      />
                      {emailAvailable && (
                        <Check className="absolute right-3.5 top-3 h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    {emailError && (
                      <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-tight space-y-1">
                        <p className="font-semibold">{emailError}</p>
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline"
                        >
                          <span>Log in to your existing account</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                    {emailAvailable && (
                      <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Email address is available
                      </p>
                    )}
                  </div>

                  {/* Contact Phone: Sri Lanka Mobile Number */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700">
                        Mobile Phone Number (Sri Lanka) *
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Format: +94 77 123 4567</span>
                    </div>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 flex items-center gap-1 text-slate-500 font-semibold text-xs border-r border-slate-200 pr-2 pointer-events-none">
                        <span>🇱🇰 +94</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={e => handlePhoneChange(e.target.value)}
                        placeholder="+94 77 123 4567"
                        className={`w-full rounded-xl bg-slate-50/70 border py-2.5 pl-24 pr-10 text-xs text-slate-900 focus:bg-white focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100 ${
                          phoneError
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                            : phoneValid
                            ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                            : 'border-slate-200/90 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                        }`}
                      />
                      {phoneValid && (
                        <Check className="absolute right-3.5 top-3 h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    {phoneError ? (
                      <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{phoneError}</span>
                      </p>
                    ) : phoneValid ? (
                      <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Valid Sri Lankan mobile number
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supports Sri Lankan mobile numbers (070, 071, 072, 074, 075, 076, 077, 078) with or without country code.
                      </p>
                    )}
                  </div>

                  {/* Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Min 8 chars (upper, lower, num, sym)"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-10 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={formData.password} className="mt-2" />
                  </div>

                  {/* Confirm Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-10 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && formData.password !== confirmPassword && (
                      <p className="text-[11px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Passwords do not match
                      </p>
                    )}
                    {confirmPassword && formData.password === confirmPassword && (
                      <p className="text-[11px] text-emerald-600 mt-1.5 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Business Information & Default Branch */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                  3. Business Information & Default Branch (BR-13)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Business Name *</label>
                    <div className="relative">
                      <Store className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.businessName}
                        onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                        placeholder="Urban Cafe & Print Hub"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Business Category *</label>
                    <div className="relative">
                      <Tag className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.businessCategory}
                        onChange={e => setFormData({ ...formData, businessCategory: e.target.value })}
                        placeholder="Retail & Specialty Store"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Physical Store Address *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.businessAddress}
                        onChange={e => setFormData({ ...formData, businessAddress: e.target.value })}
                        placeholder="No. 45 Galle Road, Colombo 03, Sri Lanka"
                        className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !!emailError || emailCheckLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Creating Account & Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Email Verification</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* STEP 2: Email OTP Verification Screen */}
        {step === 'verify' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold shadow-md shadow-indigo-200">
                <MailCheck className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider">
                Step 2 of 2
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Enter Verification Code</h2>
              <p className="text-xs text-slate-600 font-medium">
                We sent a 6-digit verification code to <span className="font-bold text-indigo-700">{formData.email}</span>.
              </p>
            </div>

            {/* Error Message */}
            {verifyError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-rose-900">Verification Failed</p>
                  <p className="leading-relaxed">{verifyError}</p>
                </div>
              </div>
            )}

            {/* Resend Success Message */}
            {resendSuccessMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 text-center">
                  6-Digit OTP Code
                </label>
                <div className="relative max-w-xs mx-auto">
                  <ShieldCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={8}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.trim())}
                    placeholder="123456"
                    className="w-full text-center font-mono text-xl font-bold tracking-[0.3em] rounded-xl bg-slate-50 border border-slate-300 py-3 pl-10 pr-4 text-slate-900 placeholder-slate-300 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Enter the 6-digit code or click the confirmation link in the verification email.
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifying || verificationCode.length < 4}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Complete Registration</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Resend & Edit Details */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-slate-600 text-[11px]">Didn&apos;t receive the code?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending || resendCooldown > 0}
                  className="font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 text-xs inline-flex items-center gap-1 transition-colors"
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
                      <span>Resend Code</span>
                    </>
                  )}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setError(null);
                  }}
                  className="text-slate-600 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  <span>Edit Details</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Completed Success Screen */}
        {step === 'completed' && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-md shadow-emerald-100">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full uppercase tracking-wider">
                Registration Successful
              </span>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Shop Account Activated!</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Your email <span className="font-bold text-slate-900">{formData.email}</span> has been verified. Store <span className="font-bold text-slate-900">&ldquo;{formData.businessName}&rdquo;</span> is now active with the Free Starter Plan.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-medium">Business Name:</span>
                <span className="font-bold text-slate-900">{formData.businessName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-medium">Plan Tier:</span>
                <span className="font-bold text-emerald-700">Free Starter Plan (LKR 0/mo)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500 font-medium">Contact Phone:</span>
                <span className="font-bold text-slate-900">{formData.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email Address:</span>
                <span className="font-bold text-slate-900">{formData.email}</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/login?verified=true"
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300/50 active:scale-[0.98] transition-all duration-200"
              >
                <span>Sign In to Portal Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
