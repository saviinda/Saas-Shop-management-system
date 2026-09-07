'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { Lock, X, CheckCircle2, KeyRound } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });

      setSuccessMsg('Your password has been changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to change password. Please verify current password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Change Account Password</h3>
              <p className="text-xs text-slate-500">Update your login security credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              placeholder="Enter your current password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">New Password (min. 6 characters) *</label>
            <input
              type="password"
              required
              placeholder="Enter your new password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
