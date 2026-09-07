'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import {
  LayoutDashboard,
  Store,
  Users,
  Package,
  PlaySquare,
  CreditCard,
  MessageSquare,
  BarChart3,
  FileCheck2,
  ScrollText,
  LogOut,
  KeyRound,
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { name: 'Shops', href: '/super-admin/shops', icon: Store },
  { name: 'Users', href: '/super-admin/users', icon: Users },
  { name: 'Packages', href: '/super-admin/packages', icon: Package },
  { name: 'Subscriptions', href: '/super-admin/subscriptions', icon: PlaySquare },
  { name: 'Payments', href: '/super-admin/payments', icon: CreditCard },
  { name: 'Change Requests', href: '/super-admin/change-requests', icon: FileCheck2 },
  { name: 'Communication', href: '/super-admin/communication', icon: MessageSquare },
  { name: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
  { name: 'Audit Logs', href: '/super-admin/audit-logs', icon: ScrollText },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'super_admin')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100/70">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-200/80 border-r border-slate-300/80 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-300/80">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-indigo-300/50">
            SA
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">Platform Admin</h1>
            <p className="text-xs text-slate-500 font-medium">Global Governance</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-indigo-700 font-semibold shadow-sm shadow-slate-300/40 border border-slate-200/60'
                    : 'text-slate-600 hover:bg-slate-300/50 hover:text-slate-900 hover:translate-x-0.5'
                }`}
              >
                <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-300/80 space-y-1">
          <button
            onClick={() => setShowChangePassModal(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-300/50 rounded-xl transition-all duration-200"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            Change Password
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100/60 rounded-xl active:scale-[0.98] transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Super Admin Console
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Notifications Bell Dropdown */}
            <NotificationDropdown />

            <button
              onClick={() => setShowChangePassModal(true)}
              title="Change Password"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <KeyRound className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      <ChangePasswordModal
        isOpen={showChangePassModal}
        onClose={() => setShowChangePassModal(false)}
      />
    </div>
  );
}
