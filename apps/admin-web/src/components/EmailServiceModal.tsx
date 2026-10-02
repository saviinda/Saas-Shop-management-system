'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  ExternalLink,
  ShieldCheck,
  Server,
  Sparkles,
} from 'lucide-react';

interface EmailServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export const EmailServiceModal: React.FC<EmailServiceModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
}) => {
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [targetEmail, setTargetEmail] = useState(defaultEmail);
  const [selectedTemplate, setSelectedTemplate] = useState('registration_welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; previewUrl?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.get<any>('/email/status')
        .then(res => setProviderStatus(res.data))
        .catch(err => console.warn('Could not fetch email status:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await api.post<any>('/email/test', {
        to: targetEmail,
        templateType: selectedTemplate,
      });

      setResult({
        success: true,
        message: res.data.message || 'Test email dispatched successfully!',
        previewUrl: res.data.previewUrl,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to dispatch test email.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Email Service Integration</h2>
              <p className="text-xs text-slate-500">Provider connectivity & transactional notifications</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Provider Status Card */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Configured Provider
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                providerStatus?.configured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {providerStatus?.configured ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Ready / Configured
                </>
              ) : (
                <>
                  <Server className="h-3 w-3" /> Ethereal Sandbox Mode
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Service Provider</span>
              <span className="font-bold text-slate-800 capitalize">
                {providerStatus?.provider?.replace('_', ' ') || 'Detecting...'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Sender Email</span>
              <span className="font-semibold text-slate-800 font-mono text-[11px] truncate block">
                {providerStatus?.senderEmail || 'System default'}
              </span>
            </div>
          </div>
        </div>

        {/* Test Email Dispatcher */}
        <form onSubmit={handleSendTest} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Email Address
            </label>
            <input
              type="email"
              required
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Notification Type to Test
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold text-slate-800 cursor-pointer"
            >
              <option value="registration_welcome">Registration / Welcome Email</option>
              <option value="account_approved">Account Approval Email</option>
              <option value="plan_expiry_reminder">Plan Expiry Reminder Email</option>
              <option value="low_stock_reminder">Low Stock Reminder Email</option>
              <option value="otp_verification">OTP Verification Code Email</option>
              <option value="password_changed">Password Changed Confirmation Email</option>
              <option value="downgrade_confirmation">Plan Downgrade Confirmation Email</option>
              <option value="payment_status">Payment Status Email</option>
              <option value="test_email">System Diagnostics Test Email</option>
            </select>
          </div>

          {result && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-150 ${
                result.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                )}
                <span>{result.message}</span>
              </div>
              {result.previewUrl && (
                <a
                  href={result.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 underline text-[11px] mt-1 hover:text-emerald-900"
                >
                  <ExternalLink className="h-3 w-3" /> View In Ethereal Test Inbox
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !targetEmail}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-sm shadow-indigo-200 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            {isLoading ? (
              <span>Dispatching Test Email...</span>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send Test Notification</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
