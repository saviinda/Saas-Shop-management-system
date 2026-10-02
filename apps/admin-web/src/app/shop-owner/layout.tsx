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
  Layers,
  Menu,
  X,
} from 'lucide-react';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  shop_owner: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'reports', 'communication'],
  manager: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'reports', 'communication'],
  sales_staff: ['dashboard', 'products', 'services', 'customers', 'orders', 'tasks'],
  inventory_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  purchasing_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  worker: ['dashboard', 'tasks', 'products', 'inventory', 'orders'],
};

interface NavItem {
  name: string;
  href: string;
  icon: any;
  permission?: string;
  minRole?: string;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/shop-owner/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
    ],
  },
  {
    title: 'Operations & Sales',
    items: [
      { name: 'Orders', href: '/shop-owner/orders', icon: ShoppingCart, permission: 'orders' },
      { name: 'Customers', href: '/shop-owner/customers', icon: UserCheck, permission: 'customers' },
      { name: 'Services', href: '/shop-owner/services', icon: Wrench, permission: 'services' },
      { name: 'Service Categories', href: '/shop-owner/services/categories', icon: Tag, permission: 'services' },
      { name: 'Staff Tasks', href: '/shop-owner/tasks', icon: CheckSquare, permission: 'tasks' },
    ],
  },
  {
    title: 'Catalog & Inventory',
    items: [
      { name: 'Products', href: '/shop-owner/products', icon: Package, permission: 'products' },
      { name: 'Product Categories', href: '/shop-owner/products/categories', icon: Tag, permission: 'products' },
      { name: 'Batches', href: '/shop-owner/batches', icon: Layers, permission: 'inventory' },
      { name: 'Inventory & Stock', href: '/shop-owner/inventory', icon: Boxes, permission: 'inventory' },
    ],
  },
  {
    title: 'Procurement & Supply',
    items: [
      { name: 'Procurement (PO & GRN)', href: '/shop-owner/procurement', icon: Truck, permission: 'procurement' },
      { name: 'Suppliers', href: '/shop-owner/suppliers', icon: Building2, permission: 'procurement' },
    ],
  },
  {
    title: 'Management & Reports',
    items: [
      { name: 'Branches', href: '/shop-owner/branches', icon: Building2, permission: 'branches', minRole: 'manager' },
      { name: 'Employees & Staff', href: '/shop-owner/staff', icon: Users, permission: 'staff', minRole: 'manager' },
      { name: 'Reports & Analytics', href: '/shop-owner/reports', icon: BarChart3, permission: 'reports', minRole: 'manager' },
    ],
  },
  {
    title: 'Settings & Support',
    items: [
      { name: 'Shop Information', href: '/shop-owner/information', icon: Store, minRole: 'shop_owner' },
      { name: 'Subscription & Plan', href: '/shop-owner/subscription', icon: Sparkles, minRole: 'shop_owner' },
      { name: 'Change Requests', href: '/shop-owner/change-requests', icon: FileCheck2, minRole: 'shop_owner' },
      { name: 'Support with Admin', href: '/shop-owner/communication', icon: MessageSquare, permission: 'communication' },
    ],
  },
];

export default function ShopOwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, shop, isLoading, logout } = useAuth();
  const { branches, activeBranch, setActiveBranchId } = useBranch();
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role === 'super_admin')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Close mobile sidebar on route change
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

  const userPermissions = (user.permissions && user.permissions.length > 0)
    ? user.permissions
    : DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  const isOwner = user.role === 'shop_owner' || user.role === 'super_admin';

  const filterItem = (item: NavItem) => {
    if (isOwner) return true;
    if (item.minRole === 'shop_owner' && user.role !== 'shop_owner') return false;
    if (item.minRole === 'manager' && user.role !== 'manager' && user.role !== 'shop_owner') {
      if (item.permission && !userPermissions.includes(item.permission)) return false;
    }
    if (item.permission && !userPermissions.includes(item.permission)) {
      return false;
    }
    return true;
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-100/90 border-r border-slate-200">
      {/* Shop Brand Header with Category */}
      <div className="p-4 border-b border-slate-200 bg-white/60 shrink-0">
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
              {shop?.category || 'Print & Shop'}
            </p>
            <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">{user.role.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Active Branch Switcher */}
        <div className="mt-3 pt-2.5 border-t border-slate-200">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Branch Context
          </label>
          <div className="relative">
            <select
              value={activeBranch?.id || ''}
              onChange={e => setActiveBranchId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl text-xs text-slate-800 p-2 pr-8 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-semibold shadow-2xs transition-all cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 min-h-0 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navCategories.map(cat => {
          const visibleItems = cat.items.filter(filterItem);
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
                    (item.href !== '/shop-owner/dashboard' &&
                      pathname.startsWith(item.href) &&
                      (item.href !== '/shop-owner/products' || pathname === '/shop-owner/products'));
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

      {/* Footer */}
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
          Sign Out
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
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 truncate">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {activeBranch ? activeBranch.name : shop?.name}
              </h2>
              {shop?.category && (
                <span className="hidden sm:inline-flex text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100/80">
                  {shop.category}
                </span>
              )}
            </div>
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
            <Link
              href="/shop-owner/communication"
              title="Support Messaging"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MessageSquare className="h-5 w-5" />
            </Link>
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
