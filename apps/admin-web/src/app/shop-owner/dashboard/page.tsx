'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { formatCurrency } from '@/lib/utils';
import {
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Boxes,
  CheckSquare,
  Plus,
  ArrowRight,
  Store,
  Tag,
  Building2,
  Users,
} from 'lucide-react';

export default function ShopOwnerDashboard() {
  const { shop } = useAuth();
  const { activeBranch } = useBranch();
  const [data, setData] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const [dashRes, subRes] = await Promise.all([
        api.get<any>('/reports/shop-owner', { branchId: activeBranch?.id }),
        api.get<any>('/subscriptions/my'),
      ]);
      setData(dashRes.data);
      setSubscriptionInfo(subRes.data);
    } catch (err) {
      console.error('Failed to load shop owner dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [activeBranch]);

  const metrics = data?.metrics || {
    totalOrders: 0,
    totalSales: 0,
    totalProducts: 0,
    lowStockCount: 0,
    pendingTasksCount: 0,
  };

  const usage = subscriptionInfo?.usage || {};
  const currentCategory = data?.shop?.category || shop?.category || 'Retail Store';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Branch Operations Dashboard</h1>
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Tag className="h-3 w-3" />
              {currentCategory}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time activity for <span className="font-semibold text-slate-800">{activeBranch?.name || 'Selected Branch'}</span> ({shop?.name})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/shop-owner/orders"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200"
          >
            <Plus className="h-4 w-4" /> New Order
          </Link>
          <Link
            href="/shop-owner/inventory"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-sm shadow-slate-100 active:scale-[0.98] transition-all duration-200"
          >
            <Boxes className="h-4 w-4 text-slate-500" /> Stock Adjustment
          </Link>
        </div>
      </div>

      {/* Package Quota Progress Bar (BR-03, BR-04) - Luxury Card */}
      {subscriptionInfo && (
        <div className="bg-white text-slate-800 p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-bold text-[11px] uppercase rounded-full">
                {subscriptionInfo.package?.name || 'Active Plan'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Package Limit Consumption (BR-03)</span>
            </div>
            <Link href="/shop-owner/subscription" className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 transition-colors">
              Upgrade Plan <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
            {usage.branches && (
              <div>
                <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                  <span className="text-slate-600">Branches</span>
                  <span className="font-bold text-slate-900">{usage.branches.current} / {usage.branches.limit}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.branches.current >= usage.branches.limit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(100, (usage.branches.current / usage.branches.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {usage.users && (
              <div>
                <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                  <span className="text-slate-600">Staff Users</span>
                  <span className="font-bold text-slate-900">{usage.users.current} / {usage.users.limit}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.users.current >= usage.users.limit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(100, (usage.users.current / usage.users.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {usage.products && (
              <div>
                <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                  <span className="text-slate-600">Products</span>
                  <span className="font-bold text-slate-900">{usage.products.current} / {usage.products.limit}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.products.current >= usage.products.limit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(100, (usage.products.current / usage.products.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {usage.services && (
              <div>
                <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                  <span className="text-slate-600">Services</span>
                  <span className="font-bold text-slate-900">{usage.services.current} / {usage.services.limit}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.services.current >= usage.services.limit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(100, (usage.services.current / usage.services.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4 Operations KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL SALES</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {formatCurrency(metrics.totalSales, 'USD')}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">Current branch revenue</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ORDERS</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{metrics.totalOrders}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">{metrics.pendingOrders || 0} pending processing</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">LOW STOCK ALERTS</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${metrics.lowStockCount > 0 ? 'bg-amber-50 text-amber-600 border border-amber-200/70' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className={`text-3xl font-extrabold mt-3 tracking-tight ${metrics.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {metrics.lowStockCount}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">{metrics.outOfStockCount || 0} items completely out</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">STAFF TASKS</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{metrics.pendingTasksCount}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">{metrics.completedTasksCount || 0} tasks completed</p>
        </div>
      </div>

      {/* Low Stock Items & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Warnings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Low Stock Inventory Alerts (BR-10)</h3>
            <Link href="/shop-owner/procurement" className="text-xs text-indigo-600 font-semibold hover:text-indigo-800">
              Create PO &rarr;
            </Link>
          </div>
          {(!data?.lowStockItems || data.lowStockItems.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">All inventory items are well-stocked</p>
          ) : (
            <div className="space-y-2.5">
              {data.lowStockItems.map((item: any) => (
                <div key={item.id} className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{item.productName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-amber-700">{item.quantity} units</span>
                    <p className="text-[10px] text-slate-400">Min: {item.minimumStockLevel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Branch Orders */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Recent Orders</h3>
            <Link href="/shop-owner/orders" className="text-xs text-indigo-600 font-semibold hover:text-indigo-800">
              View All &rarr;
            </Link>
          </div>
          {(!data?.recentOrders || data.recentOrders.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">No orders processed yet</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentOrders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900 font-mono">{order.orderNumber}</p>
                    <p className="text-[11px] text-slate-500">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatCurrency(order.totalAmount, 'USD')}</p>
                    <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
