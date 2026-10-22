'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { PlatformSettings } from '@saas/types';
import { useModal } from '@/lib/modal-context';
import {
  Settings,
  Mail,
  Building,
  Phone,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  LifeBuoy,
} from 'lucide-react';

export default function PlatformSettingsPage() {
  const { showSuccess, showError } = useModal();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<PlatformSettings>({
    id: 'platform',
    supportEmail: 'savinda.codezela@gmail.com',
    platformName: 'SaaS Shop Management Platform',
    supportPhone: '+94 77 123 4567',
    supportHours: 'Monday - Friday (8:00 AM - 6:00 PM IST)',
    updatedAt: '',
    updatedBy: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setValidationError(null);
    try {
      const res = await api.get<PlatformSettings>('/settings');
      if (res.data) {
        setFormData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load platform settings:', err);
      showError('Error Loading Settings', err.message || 'Could not fetch platform settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = formData.supportEmail.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      setValidationError('Please enter a valid support email address (e.g. support@domain.com)');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.put<PlatformSettings>('/settings', {
        ...formData,
        supportEmail: cleanEmail,
      });

      setFormData(res.data);
      showSuccess(
        'Settings Saved',
        `Platform support email updated to "${cleanEmail}". All login reactivation prompts now reflect this address.`
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        setValidationError(err.message);
      } else {
        setValidationError(err.message || 'Failed to update platform settings.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform System Settings</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Platform Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure platform-wide support channels, reactivation contact details, and organization metadata
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={isLoading || isSaving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Reload Settings
        </button>
      </div>

      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-bold">Validation Issue</p>
            <p className="mt-0.5 leading-relaxed">{validationError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm shadow-slate-200/50 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-slate-900">
            <LifeBuoy className="h-5 w-5 text-indigo-600" />
            <span>Support & Helpdesk Configuration</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Support Email Field */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Platform Support Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={formData.supportEmail}
                  onChange={e => setFormData({ ...formData, supportEmail: e.target.value })}
                  placeholder="e.g. support@platform.com"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-2xs font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Displayed to inactive shops and accounts on the login screen with a direct reactivation mailto link.
              </p>
            </div>

            {/* Platform Brand Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Platform Brand / System Name
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.platformName || ''}
                  onChange={e => setFormData({ ...formData, platformName: e.target.value })}
                  placeholder="e.g. SaaS Shop Management Platform"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* Support Phone Number */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Support Helpline / Hotline
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.supportPhone || ''}
                  onChange={e => setFormData({ ...formData, supportPhone: e.target.value })}
                  placeholder="e.g. +94 77 123 4567"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* Support Operating Hours */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Support Hours & Availability
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.supportHours || ''}
                  onChange={e => setFormData({ ...formData, supportHours: e.target.value })}
                  placeholder="e.g. Monday - Friday (8:00 AM - 6:00 PM IST)"
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-200 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* Metadata info */}
            {formData.updatedAt && (
              <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
                <span>Last updated: {new Date(formData.updatedAt).toLocaleString()}</span>
                <span>By: {formData.updatedBy || 'Super Admin'}</span>
              </div>
            )}

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving Platform Settings...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview of Inactive Account Card */}
        <div className="space-y-4">
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span>Live Inactive User Preview</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When an inactive shop or disabled user attempts to sign in, they will see this message and contact options:
            </p>

            {/* Sample Inactive Alert */}
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 space-y-2.5 shadow-2xs">
              <p className="font-bold text-rose-800">
                Your account is inactive and access is restricted. Please contact platform support.
              </p>
              <div className="p-2.5 bg-white rounded-lg border border-rose-200/80 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Contact Platform Support
                </p>
                <p className="text-[11px] text-slate-600">
                  Email: <span className="font-mono font-bold text-slate-900">{formData.supportEmail || 'support@platform.com'}</span>
                </p>
                <a
                  href={`mailto:${formData.supportEmail || 'support@platform.com'}?subject=Request%20to%20Reactivate%20Shop%20Account`}
                  onClick={e => e.preventDefault()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold shadow-2xs"
                >
                  <Mail className="h-3 w-3" />
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
