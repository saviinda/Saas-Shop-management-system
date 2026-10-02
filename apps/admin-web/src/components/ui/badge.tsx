import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | 'info'
    | 'muted';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

  const variants: Record<string, string> = {
    default: 'border-transparent bg-indigo-600 text-white shadow-2xs',
    secondary: 'border-slate-200 bg-slate-100 text-slate-700',
    destructive: 'border-rose-200 bg-rose-50 text-rose-700',
    outline: 'border-slate-300 text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    muted: 'border-slate-100 bg-slate-50 text-slate-500',
  };

  return <div className={cn(baseStyles, variants[variant], className)} {...props} />;
}

export { Badge };
