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
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  permission?: string;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const adminNavCategories: NavCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
    ],
  },
  {
    title: 'Tenant Management',
    items: [
      { name: 'Shops', href: '/super-admin/shops', icon: Store, permission: 'shops' },
      { name: 'Change Requests', href: '/super-admin/change-requests', icon: FileCheck2, permission: 'change_requests' },
      { name: 'Subscriptions', href: '/super-admin/subscriptions', icon: PlaySquare, permission: 'subscriptions' },
      { name: 'Packages', href: '/super-admin/packages', icon: Package, permission: 'packages' },
    ],
  },
  {
    title: 'Finance & Billing',
    items: [
      { name: 'Payments', href: '/super-admin/payments', icon: CreditCard, permission: 'payments' },
    ],
  },
  {
    title: 'Platform Governance',
    items: [
      { name: 'Platform Users', href: '/super-admin/users', icon: Users, permission: 'users' },
      { name: 'Roles & Access', href: '/super-admin/roles', icon: ShieldCheck, permission: 'roles' },
      { name: 'Communication', href: '/super-admin/communication', icon: MessageSquare, permission: 'communication' },
      { name: 'Analytics & Reports', href: '/super-admin/reports', icon: BarChart3, permission: 'reports' },
      { name: 'Audit Logs', href: '/super-admin/audit-logs', icon: ScrollText, permission: 'audit_logs' },
    ],
  },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth();
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'super_admin')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-100/90 border-r border-slate-200">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-200 bg-white/60 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-indigo-300/50">
          SA
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-sm leading-tight">Platform Admin</h1>
          <p className="text-[11px] text-slate-500 font-medium">Global SaaS Control</p>
        </div>
      </div>

      {/* Categorized Navigation Items */}
      <nav className="flex-1 min-h-0 px-2.5 py-3 space-y-4 overflow-y-auto">
        {adminNavCategories.map(cat => {
          const visibleItems = cat.items.filter(
            item => !item.permission || hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={cat.title} className="space-y-1">
              <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {cat.title}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/super-admin/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-150 ${
                        isActive
                          ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="p-3 border-t border-slate-200 space-y-1 shrink-0 bg-white/40">
        <button
          onClick={() => setShowChangePassModal(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
        >
          <KeyRound className="h-4 w-4 text-slate-500" />
          Change Password
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 text-rose-500" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/70">
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col shrink-0 h-screen sticky top-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Backdrop & Slide-over Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-xs h-full bg-white shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-200">
            <div className="absolute right-2 top-3 z-30">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 bg-white/90 backdrop-blur border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Super Admin Platform Console
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Notifications Bell Dropdown */}
            <NotificationDropdown />

            <button
              onClick={() => setShowChangePassModal(true)}
              title="Change Password"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <KeyRound className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">{children}</main>
      </div>

      <ChangePasswordModal
        isOpen={showChangePassModal}
        onClose={() => setShowChangePassModal(false)}
      />
    </div>
  );
}
