'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DollarSign,
  Store,
  Users,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  Download,
  RefreshCw,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function PlatformReportsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<any>('/reports/super-admin');
      setData(res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load system reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Real-time polling every 12 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      api.get<any>('/reports/super-admin')
        .then(res => {
          setData(res.data);
          setLastRefreshed(new Date());
        })
        .catch(console.error);
    }, 12000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const metrics = data?.metrics || {};
  const revenueTrend = data?.revenueTrend || [];
  const subDistribution = data?.subDistribution || [];
  const categoryDistribution = data?.categoryDistribution || [];
  const paymentMethods = data?.paymentMethods || [];
  const shopSummary = data?.shopSummary || [];

  const handleExportCSV = () => {
    if (!shopSummary.length) return;

    const headers = ['Shop Name', 'Category', 'Owner Name', 'Owner Email', 'Plan Tier', 'Branches', 'Staff', 'Orders', 'Revenue', 'Status', 'Created Date'];
    const rows = shopSummary.map((s: any) => [
      `"${s.name}"`,
      `"${s.category}"`,
      `"${s.ownerName}"`,
      `"${s.ownerEmail}"`,
      `"${s.packageName}"`,
      s.branchesCount,
      s.staffCount,
      s.ordersCount,
      s.revenue,
      s.status,
      s.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SaaS_Platform_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">System Reports & Financial Analytics</h1>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE REAL-TIME
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide recurring financial health, MRR, tenant operational activity, and cross-shop metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] text-slate-400 font-medium">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            Auto-Sync: {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={loadReports}
            title="Refresh now"
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross Platform Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">GROSS REVENUE</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {formatCurrency(metrics.grossRevenue || 0, 'USD')}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1.5 font-semibold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {metrics.successfulPaymentsCount || 0} verified transactions
          </p>
        </div>

        {/* Monthly Recurring Revenue (MRR) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ACTIVE MRR</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {formatCurrency(metrics.mrr || 0, 'USD')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            From {metrics.activeSubs || 0} active subscriptions
          </p>
        </div>

        {/* Total Platform Shops */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL SHOPS</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {metrics.totalShops || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            {metrics.activeShops || 0} active | {metrics.restrictedShops || 0} restricted/suspended
          </p>
        </div>

        {/* Total Platform Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">PLATFORM USERS</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {metrics.totalUsers || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            Across {metrics.totalBranches || 0} store branches
          </p>
        </div>
      </div>

      {/* Row 2: Secondary Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Avg. Rev Per Shop (ARPU)</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">${metrics.arpu || 0}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Verification Rate</span>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{metrics.verificationRate || 100}%</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Requests</span>
          <p className="text-lg font-bold text-amber-600 mt-0.5">{metrics.pendingRequests || 0}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Orders Processed</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{metrics.totalOrders || 0}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" /> Revenue & Billing Velocity Trend
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated monthly SaaS subscription intake</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-50 rounded-full text-slate-600 border border-slate-200/80">
              Live Monthly Data
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Intake']} />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevReport)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Plan Distribution Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight mb-2 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-indigo-600" /> Subscription Plan Share
            </h3>
            <div className="relative h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subDistribution}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {subDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-900">{metrics.activeSubs || 0}</span>
                <span className="text-[11px] text-slate-500 font-medium">Active Subs</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            {subDistribution.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.count} stores ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Business Category Breakdown & Payment Methods Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business Category Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 space-y-4">
          <h3 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" /> Business Category Distribution
          </h3>

          <div className="space-y-3">
            {categoryDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No shop categories recorded yet.</p>
            ) : (
              categoryDistribution.map((cat: any) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat.category}</span>
                    <span className="text-slate-500">{cat.count} shops ({cat.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${Math.max(5, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 space-y-4">
          <h3 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" /> Payment Methods Breakdown
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {paymentMethods.map((pm: any) => (
              <div key={pm.method} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">{pm.method}</span>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(pm.total || 0, 'USD')}</p>
                <p className="text-xs text-slate-500 font-medium">{pm.count} transactions</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System-Wide Operational Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight">System-Wide Operational Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time breakdown of all store accounts, branch counts, order velocity and status</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Download Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Business / Shop</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Owner Account</th>
                <th className="py-3.5 px-6">Plan Tier</th>
                <th className="py-3.5 px-6">Branches</th>
                <th className="py-3.5 px-6">Staff Count</th>
                <th className="py-3.5 px-6">Orders Generated</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {shopSummary.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">No shop operational data available.</td>
                </tr>
              ) : (
                shopSummary.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                      <Store className="h-4 w-4 text-indigo-600 shrink-0" />
                      {s.name}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 rounded-md text-slate-700 text-[10px] font-semibold border border-slate-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{s.ownerName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{s.ownerEmail}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold text-[10px] border border-indigo-100">
                        {s.packageName}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">{s.branchesCount}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{s.staffCount}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{s.ordersCount}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(s.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
