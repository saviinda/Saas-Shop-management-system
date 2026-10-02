import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer';

    const variants: Record<string, string> = {
      default: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 shadow-indigo-200/50',
      destructive:
        'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200/80 shadow-2xs',
      outline:
        'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs hover:text-slate-900',
      secondary:
        'bg-slate-100 text-slate-800 hover:bg-slate-200/80 shadow-2xs',
      ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
      link: 'text-indigo-600 underline-offset-4 hover:underline !p-0 !h-auto',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200/50',
    };

    const sizes: Record<string, string> = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-lg px-3 text-[11px]',
      lg: 'h-11 rounded-2xl px-6 text-sm',
      icon: 'h-9 w-9 rounded-xl',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
