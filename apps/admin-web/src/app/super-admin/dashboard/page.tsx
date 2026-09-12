'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TablePagination } from '@/components/TablePagination';
import {
  TrendingUp,
  AlertCircle,
  PlusCircle,
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Store,
  ShieldCheck,
  Zap,
  ChevronsUpDown,
  Layers,
  ArrowUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function SuperAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<any>('/reports/super-admin');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto-poll every 15 seconds for real-time live data updates
    const timer = setInterval(() => {
      api.get<any>('/reports/super-admin')
        .then(res => {
          setData(res.data);
          setLastUpdated(new Date());
        })
        .catch(console.error);
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const metrics = data?.metrics || {
    totalShops: 0,
    activeShops: 0,
    activeSubs: 0,
    grossRevenue: 0,
    mrr: 0,
    pendingRequests: 0,
    totalUsers: 0,
  };

  const revenueTrendData = data?.revenueTrend || [];
  const pieData = data?.subDistribution || [];
  const recentActivities = data?.recentActivity || [];

  // View mode & pagination controls for Recent Platform Activity
  const [viewMode, setViewMode] = useState<'scroll' | 'paginated'>('scroll');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const totalActivities = recentActivities.length;
  const totalPages = Math.ceil(totalActivities / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const displayedActivities = viewMode === 'scroll'
    ? recentActivities
    : recentActivities.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Super Admin Overview</h1>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE REAL-TIME
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Platform governance, live tenant subscriptions, and financial metrics (Updated {lastUpdated.toLocaleTimeString()})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            title="Refresh dashboard"
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/super-admin/payments"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-2xs active:scale-[0.98] transition-all"
          >
            <CreditCard className="h-4 w-4 text-slate-600" />
            Review Payments ({metrics.pendingRequests || 0})
          </Link>
          <Link
            href="/super-admin/shops"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            Create Shop
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards with Live Database Values */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Shops */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL SHOPS</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" /> {metrics.activeShops} Active
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{metrics.totalShops}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {metrics.pendingShops ? `${metrics.pendingShops} pending approval` : 'All stores registered'}
          </p>
        </div>

        {/* Active Subs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ACTIVE SUBSCRIPTIONS</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full">
              <Zap className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{metrics.activeSubs}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">Across active tenant accounts</p>
        </div>

        {/* Gross Platform Revenue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL REVENUE</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
              <TrendingUp className="h-3 w-3" /> {metrics.successfulPaymentsCount || 0} Paid
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {formatCurrency(metrics.grossRevenue || 0, 'USD')}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            MRR Run-rate: {formatCurrency(metrics.mrr || 0, 'USD')}/mo
          </p>
        </div>

        {/* Pending Requests */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">PENDING ACTIONS</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/70">
              <AlertCircle className="h-3 w-3" /> Review
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{metrics.pendingRequests}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">Bank slips & account requests</p>
        </div>
      </div>

      {/* Middle Row: Live Dynamic Revenue Trend & Sub Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base tracking-tight">Revenue & Billing Velocity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated platform billing volume by month</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-50 rounded-full text-slate-600 border border-slate-200/80">
              Live Aggregation
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorRevDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Intake']} />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevDash)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sub Distribution Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight mb-2">Subscription Share</h3>
            <div className="relative h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-900 leading-tight">{metrics.activeSubs}</span>
                <span className="text-[11px] text-slate-500 font-medium">Active Subs</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            {pieData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.count || item.value} stores ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Activity Table from Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white z-20">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">Recent Platform Activity</h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                {totalActivities} Records
              </span>
              {viewMode === 'scroll' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Scroll Option Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Real-time tenant transactions, logins, and lifecycle events</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Scroll Option / View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === 'scroll'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Continuous vertical scrolling of all activity records"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Scroll View
              </button>

              <button
                type="button"
                onClick={() => setViewMode('paginated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === 'paginated'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Paginated view with page navigation"
              >
                <Layers className="h-3.5 w-3.5" />
                Paginated
              </button>
            </div>

            <Link
              href="/super-admin/audit-logs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 py-1.5 px-2.5 rounded-xl hover:bg-indigo-50/60 transition-colors"
            >
              View All Logs <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Scrollable Viewport with Fixed Sticky Header */}
        <div
          ref={tableContainerRef}
          tabIndex={0}
          aria-label="Recent platform activity table scroll area"
          className={`overflow-x-auto relative divide-y divide-slate-100 focus:outline-none scroll-smooth ${
            viewMode === 'scroll' ? 'h-[360px] overflow-y-scroll' : 'max-h-[360px] overflow-y-auto'
          }`}
        >
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-2xs">
              <tr>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Actor / User</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Action / Event</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Target Entity</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium bg-white">
              {displayedActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    {isLoading ? 'Loading platform activity...' : 'No activity recorded yet.'}
                  </td>
                </tr>
              ) : (
                displayedActivities.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6">
                      <p className="font-bold text-slate-900">{log.actorName || 'System'}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{log.actorRole?.replace('_', ' ') || 'Admin'}</p>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 rounded-md text-slate-700 font-semibold text-[10px] border border-slate-200">
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[11px] text-slate-600">
                      {log.entity} / {log.entityId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: either Scroll Mode Bar or Pagination Bar */}
        {viewMode === 'scroll' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-medium text-slate-500">
              Showing all <span className="font-bold text-slate-900">{totalActivities}</span> records in vertical scroll view &bull; Header fixed at top
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Scroll to Top
              </button>
            </div>
          </div>
        ) : (
          <TablePagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={totalActivities}
            pageSize={pageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            itemName="activities"
          />
        )}
      </div>
    </div>
  );
}
