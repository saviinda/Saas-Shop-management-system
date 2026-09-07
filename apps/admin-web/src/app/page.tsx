'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'super_admin') {
        router.push('/super-admin/dashboard');
      } else {
        router.push('/shop-owner/dashboard');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">Initializing SaaS Session...</p>
      </div>
    </div>
  );
}
