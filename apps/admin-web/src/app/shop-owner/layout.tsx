'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import {
  LayoutDashboard,
  Store,
  Building2,
  Users,
  Package,
  Wrench,
  UserCheck,
  ShoppingCart,
  Boxes,
  Truck,
  CheckSquare,
  MessageSquare,
  Sparkles,
  LogOut,
  ChevronDown,
  Tag,
  KeyRound,
  FileCheck2,
  BarChart3,
} from 'lucide-react';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  shop_owner: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'reports', 'communication'],
  manager: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'reports', 'communication'],
  sales_staff: ['dashboard', 'products', 'services', 'customers', 'orders', 'tasks'],
  inventory_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  purchasing_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  worker: ['dashboard', 'tasks', 'products', 'inventory', 'orders'],
};

const navItems = [
  { name: 'Dashboard', href: '/shop-owner/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { name: 'Branches', href: '/shop-owner/branches', icon: Building2, permission: 'branches', minRole: 'manager' },
  { name: 'Employees & Staff', href: '/shop-owner/staff', icon: Users, permission: 'staff', minRole: 'manager' },
  { name: 'Products', href: '/shop-owner/products', icon: Package, permission: 'products' },
  { name: 'Services', href: '/shop-owner/services', icon: Wrench, permission: 'services' },
  { name: 'Customers', href: '/shop-owner/customers', icon: UserCheck, permission: 'customers' },
  { name: 'Orders', href: '/shop-owner/orders', icon: ShoppingCart, permission: 'orders' },
  { name: 'Inventory & Stock', href: '/shop-owner/inventory', icon: Boxes, permission: 'inventory' },
  { name: 'Suppliers', href: '/shop-owner/suppliers', icon: Building2, permission: 'procurement' },
  { name: 'Procurement (PO & GRN)', href: '/shop-owner/procurement', icon: Truck, permission: 'procurement' },
  { name: 'Staff Tasks', href: '/shop-owner/tasks', icon: CheckSquare, permission: 'tasks' },
  { name: 'Reports & Analytics', href: '/shop-owner/reports', icon: BarChart3, permission: 'reports', minRole: 'manager' },
  { name: 'Shop Information', href: '/shop-owner/information', icon: Store, minRole: 'shop_owner' },
  { name: 'Account Change Requests', href: '/shop-owner/change-requests', icon: FileCheck2, minRole: 'shop_owner' },
  { name: 'Support with Admin', href: '/shop-owner/communication', icon: MessageSquare, permission: 'communication' },
  { name: 'Subscription & Plan', href: '/shop-owner/subscription', icon: Sparkles, minRole: 'shop_owner' },
];

export default function ShopOwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, shop, isLoading, logout } = useAuth();
  const { branches, activeBranch, setActiveBranchId } = useBranch();
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role === 'super_admin')) {
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

  const userPermissions = (user.permissions && user.permissions.length > 0)
    ? user.permissions
    : DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  const isOwner = user.role === 'shop_owner' || user.role === 'super_admin';

  const visibleNavItems = navItems.filter(item => {
    if (isOwner) return true;
    if (item.minRole === 'shop_owner' && user.role !== 'shop_owner') return false;
    if (item.minRole === 'manager' && user.role !== 'manager' && user.role !== 'shop_owner') {
      if (item.permission && !userPermissions.includes(item.permission)) return false;
    }
    if (item.permission && !userPermissions.includes(item.permission)) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/70">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-200/80 border-r border-slate-300/80 flex flex-col shrink-0 h-screen sticky top-0">
        {/* Shop Brand Header with Category */}
        <div className="p-5 border-b border-slate-300/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-300/50 shrink-0 overflow-hidden border border-indigo-200/60 bg-white">
              {shop?.logoUrl ? (
                <img
                  src={shop.logoUrl}
                  alt={shop.name || 'Shop Logo'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-slate-900 text-sm truncate">{shop?.name || 'My Shop'}</h1>
              <p className="text-[11px] text-indigo-700 font-semibold truncate flex items-center gap-1">
                <Tag className="h-3 w-3 shrink-0" />
                {shop?.category || 'General Store'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">{user.role.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Active Branch Switcher */}
          <div className="mt-4 pt-3 border-t border-slate-300/80">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Active Branch Context
            </label>
            <div className="relative">
              <select
                value={activeBranch?.id || ''}
                onChange={e => setActiveBranchId(e.target.value)}
                className="w-full bg-white border border-slate-300/80 rounded-xl text-xs text-slate-800 p-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-semibold shadow-sm shadow-slate-200/40 transition-all duration-200"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all duration-200 ${
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-300/80 space-y-1 shrink-0 mt-auto">
          <button
            onClick={() => setShowChangePassModal(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-300/50 rounded-xl transition-all duration-200"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            Change Password
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-100/60 rounded-xl active:scale-[0.98] transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white/90 backdrop-blur border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {activeBranch ? activeBranch.name : shop?.name}
            </h2>
            {shop?.category && (
              <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100/80">
                {shop.category}
              </span>
            )}
            {activeBranch?.isDefault && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                Default Branch
              </span>
            )}
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
            <Link
              href="/shop-owner/communication"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MessageSquare className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
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

        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>

      <ChangePasswordModal
        isOpen={showChangePassModal}
        onClose={() => setShowChangePassModal(false)}
      />
    </div>
  );
}
