'use client';

import React from 'react';
import { checkPasswordStrength } from '@saas/validation';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password?: string;
  className?: string;
  showAlways?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password = '',
  className = '',
  showAlways = false,
}) => {
  if (!showAlways && !password) return null;

  const result = checkPasswordStrength(password);
  const score = [
    result.minLength,
    result.hasUpper,
    result.hasLower,
    result.hasNumber,
    result.hasSpecial,
  ].filter(Boolean).length;

  const getStrengthMeta = () => {
    if (score <= 1) return { label: 'Very Weak', color: 'bg-rose-500', text: 'text-rose-600' };
    if (score === 2) return { label: 'Weak', color: 'bg-rose-400', text: 'text-rose-500' };
    if (score === 3) return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    if (score === 4) return { label: 'Good', color: 'bg-indigo-500', text: 'text-indigo-600' };
    return { label: 'Strong & Secure', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const meta = getStrengthMeta();

  const rules = [
    { label: 'Minimum 8 characters', met: result.minLength },
    { label: 'At least one uppercase letter (A-Z)', met: result.hasUpper },
    { label: 'At least one lowercase letter (a-z)', met: result.hasLower },
    { label: 'At least one number (0-9)', met: result.hasNumber },
    { label: 'At least one special character (!@#$%^&* etc.)', met: result.hasSpecial },
  ];

  return (
    <div className={`p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-2.5 text-xs transition-all ${className}`}>
      {/* Progress Bars */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-semibold text-slate-600">Password Strength:</span>
          <span className={`font-bold ${meta.text}`}>{password ? meta.label : 'Required'}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full">
          {[1, 2, 3, 4, 5].map(step => (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${
                score >= step ? meta.color : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rules Checklist */}
      <div className="space-y-1 pt-1 border-t border-slate-200/60">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 text-[11px] transition-colors ${
              rule.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
            }`}
          >
            <div
              className={`h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                rule.met ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {rule.met ? (
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              ) : (
                <span className="h-1 w-1 rounded-full bg-slate-400" />
              )}
            </div>
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
