'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Boxes,
  AlertTriangle,
  Truck,
  FileCheck2,
  CheckSquare,
  Wrench,
  Calendar,
  Printer,
  Download,
  Filter,
  DollarSign,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function ShopReportsPage() {
  const { showSuccess, showError } = useModal();
  const { activeBranch, branches } = useBranch();

  const [reportsData, setReportsData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs & Filter State
  const [activeTab, setActiveTab] = useState<
    'sales' | 'customers' | 'products' | 'inventory' | 'low_stock' | 'purchases' | 'grn' | 'tasks' | 'services'
  >('sales');

  const [timePreset, setTimePreset] = useState<'today' | '7d' | 'this_month' | 'last_month' | 'ytd' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const calculateDateRange = (preset: string) => {
    const now = new Date();
    let s = '';
    let e = now.toISOString().split('T')[0];

    if (preset === 'today') {
      s = e;
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      s = d.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      s = d.toISOString().split('T')[0];
    } else if (preset === 'last_month') {
      const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
      s = startLast.toISOString().split('T')[0];
      e = endLast.toISOString().split('T')[0];
    } else if (preset === 'ytd') {
      const d = new Date(now.getFullYear(), 0, 1);
      s = d.toISOString().split('T')[0];
    }
    return { s, e };
  };

  const loadReports = async () => {
    try {
      setIsLoading(true);
      let s = startDate;
      let e = endDate;
      if (timePreset !== 'custom') {
        const range = calculateDateRange(timePreset);
        s = range.s;
        e = range.e;
      }

      const params: any = {};
      if (selectedBranchId !== 'all') params.branchId = selectedBranchId;
      if (s) params.startDate = s;
      if (e) params.endDate = e;

      const res = await api.get<any>('/reports/shop', params);
      setReportsData(res.data);
    } catch (err) {
      console.error('Failed to load shop reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeBranch?.id && selectedBranchId === 'all') {
      setSelectedBranchId(activeBranch.id);
    }
  }, [activeBranch]);

  useEffect(() => {
    loadReports();
  }, [timePreset, startDate, endDate, selectedBranchId]);

  const handlePresetChange = (preset: any) => {
    setTimePreset(preset);
    if (preset !== 'custom') {
      const range = calculateDateRange(preset);
      setStartDate(range.s);
      setEndDate(range.e);
    }
  };

  const handleExportCSV = () => {
    if (!reportsData) return;
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'sales') {
      csvContent += 'Order Number,Customer,Items,Total Amount,Payment Method,Status,Date\n';
      reportsData.salesReport?.recentOrders?.forEach((o: any) => {
        csvContent += `"${o.orderNumber}","${o.customerName}",${o.items?.length || 0},${o.totalAmount},"${o.paymentMethod}","${o.status}","${o.createdAt}"\n`;
      });
    } else if (activeTab === 'products') {
      csvContent += 'Product Name,SKU,Units Sold,Total Revenue\n';
      reportsData.productReport?.topSellingProducts?.forEach((p: any) => {
        csvContent += `"${p.name}","${p.sku}",${p.unitsSold},${p.totalRevenue}\n`;
      });
    } else if (activeTab === 'customers') {
      csvContent += 'Customer Name,Phone,Email,Orders Count,Total Spent\n';
      reportsData.customerReport?.topCustomers?.forEach((c: any) => {
        csvContent += `"${c.name}","${c.phone}","${c.email || ''}",${c.totalOrdersCount || 0},${c.totalSpent || 0}\n`;
      });
    } else if (activeTab === 'low_stock') {
      csvContent += 'Product Name,SKU,Current Stock,Minimum Threshold\n';
      reportsData.inventoryReport?.lowStockItems?.forEach((i: any) => {
        csvContent += `"${i.productName}","${i.sku}",${i.quantity},${i.minimumStockLevel}\n`;
      });
    } else {
      csvContent += 'Report,Export Timestamp\n';
      csvContent += `"${activeTab}","${new Date().toISOString()}"\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Export Complete', `Exported ${activeTab} data to CSV.`);
  };

  const sales = reportsData?.salesReport;
  const prodRep = reportsData?.productReport;
  const custRep = reportsData?.customerReport;
  const invRep = reportsData?.inventoryReport;
  const purchRep = reportsData?.purchaseReport;
  const grnRep = reportsData?.grnReport;
  const taskRep = reportsData?.taskReport;
  const srvRep = reportsData?.serviceReport;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Reports & Financial Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete business visibility across Sales, Products, Customers, Inventory, Procurement, and Staff productivity
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Printer className="h-4 w-4 text-slate-600" /> Print Report
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Global Filter Bar (Date Range & Branch) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Preset Date Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'ytd', label: 'Year to Date' },
            { id: 'custom', label: 'Custom' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                timePreset === p.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs & Branch Select */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
          {timePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          )}

          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Branches Context</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 9 Report Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
        {[
          { id: 'sales', label: 'Sales & Orders', icon: ShoppingCart },
          { id: 'customers', label: 'Customer Analytics', icon: Users },
          { id: 'products', label: 'Product Sales', icon: Package },
          { id: 'inventory', label: 'Stock & Inventory', icon: Boxes },
          { id: 'low_stock', label: 'Low Stock Alerts', icon: AlertTriangle },
          { id: 'purchases', label: 'Purchasing & POs', icon: Truck },
          { id: 'grn', label: 'Goods Received (GRN)', icon: FileCheck2 },
          { id: 'tasks', label: 'Employee & Tasks', icon: CheckSquare },
          { id: 'services', label: 'Services Analytics', icon: Wrench },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === t.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-3" />
          <p className="text-xs font-semibold">Generating real-time analytics report...</p>
        </div>
      ) : (
        <>
          {/* ===================== TAB 1: SALES & ORDERS REPORT ===================== */}
          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Revenue</span>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-1">{formatCurrency(sales?.grossSales || 0)}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{sales?.paidOrdersCount || 0} paid transactions</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Average Order Value</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(sales?.aov || 0)}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Per order average spend</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tax Collected</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(sales?.taxCollected || 0)}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Total statutory tax</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Discounts Applied</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(sales?.discountGiven || 0)}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Promotional reductions</span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Payment Methods Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sales?.paymentMethods?.map((m: any) => (
                    <div key={m.method} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 capitalize">{m.method.replace('_', ' ')}</span>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(m.total)}</p>
                      <span className="text-[10px] text-slate-500">{m.count} orders</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Order Transactions Ledger</h3>
                  <span className="text-xs text-slate-400">{sales?.totalOrdersCount || 0} total records</span>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Items Count</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales?.recentOrders?.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">#{o.orderNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{o.customerName}</td>
                        <td className="py-3 px-4">{o.items?.length || 0} items</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{formatCurrency(o.totalAmount)}</td>
                        <td className="py-3 px-4 capitalize font-semibold">{o.paymentMethod} &bull; {o.paymentStatus}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-[10px] capitalize">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{formatDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 2: CUSTOMER ANALYTICS ===================== */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Registered Customers</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{custRep?.totalCustomers || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Top 15 Lifetime Spend</span>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-1">
                    {formatCurrency(custRep?.topCustomers?.reduce((s: any, c: any) => s + (c.totalSpent || 0), 0) || 0)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Top 15 Customer Spenders Ranking</h3>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone / Contact</th>
                      <th className="py-3 px-4">Total Orders</th>
                      <th className="py-3 px-4">Lifetime Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {custRep?.topCustomers?.map((c: any, idx: number) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-4">{c.phone}</td>
                        <td className="py-3 px-4 font-bold">{c.totalOrdersCount || 0} orders</td>
                        <td className="py-3 px-4 font-extrabold text-indigo-600">{formatCurrency(c.totalSpent || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 3: PRODUCT SALES REPORT ===================== */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Best-Selling Products by Revenue</h3>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4 text-center">Units Sold</th>
                      <th className="py-3 px-4 text-right">Total Generated Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prodRep?.topSellingProducts?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{p.sku}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">{p.unitsSold} units</td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600">{formatCurrency(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 4: STOCK & INVENTORY REPORT ===================== */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Stock Units</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{invRep?.totalStockUnits || 0} units</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Asset Cost Valuation</span>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-1">{formatCurrency(invRep?.totalInventoryCost || 0)}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Potential Retail Value</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(invRep?.totalInventoryRetail || 0)}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Profit Margin</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {formatCurrency(Math.max(0, (invRep?.totalInventoryRetail || 0) - (invRep?.totalInventoryCost || 0)))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 5: LOW STOCK ALERTS REPORT ===================== */}
          {activeTab === 'low_stock' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/50">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Low Stock Threshold Warnings</span>
                  <p className="text-2xl font-extrabold text-amber-700 mt-1">{invRep?.lowStockCount || 0} products</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-rose-200 bg-rose-50/50">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Out of Stock Lines</span>
                  <p className="text-2xl font-extrabold text-rose-700 mt-1">{invRep?.outOfStockCount || 0} products</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Urgent Replenishment List</h3>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Minimum Threshold</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invRep?.lowStockItems?.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{i.productName}</td>
                        <td className="py-3 px-4 font-mono">{i.sku}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-amber-600">{i.quantity} units</td>
                        <td className="py-3 px-4 text-center font-semibold">{i.minimumStockLevel} units</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px] border border-amber-200">
                            Low Stock
                          </span>
                        </td>
                      </tr>
                    ))}
                    {invRep?.outOfStockItems?.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{i.productName}</td>
                        <td className="py-3 px-4 font-mono">{i.sku}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-rose-600">0 units</td>
                        <td className="py-3 px-4 text-center font-semibold">{i.minimumStockLevel} units</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-bold text-[10px] border border-rose-200">
                            Out of Stock
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 6: PURCHASING & PO REPORT ===================== */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total POs Issued</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{purchRep?.totalPOCount || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Purchase Expenditure</span>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-1">{formatCurrency(purchRep?.totalPOSpend || 0)}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Spend by Supplier Breakdown</h3>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4 text-center">POs Count</th>
                      <th className="py-3 px-4 text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchRep?.supplierSpendBreakdown?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                        <td className="py-3 px-4 text-center font-bold">{s.poCount} POs</td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-600">{formatCurrency(s.totalSpend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 7: GRN REPORT ===================== */}
          {activeTab === 'grn' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">GRNs Finalized</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{grnRep?.totalGRNCount || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Inventory Value Received</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(grnRep?.totalGRNValue || 0)}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Damaged / Missing Units</span>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">{grnRep?.totalDamagedUnits || 0} units</p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 8: TASKS REPORT ===================== */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Assigned Tasks</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{taskRep?.totalTasks || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Completed Tasks</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{taskRep?.tasksCompleted || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pending / In Progress</span>
                  <p className="text-2xl font-extrabold text-amber-600 mt-1">{taskRep?.tasksPending || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 9: SERVICES REPORT ===================== */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Services Bookings & Revenue Contribution</h3>
                </div>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Service Offering</th>
                      <th className="py-3 px-4 text-center">Completed Bookings</th>
                      <th className="py-3 px-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {srvRep?.topServices?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                        <td className="py-3 px-4 text-center font-bold">{s.bookingsCount} bookings</td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-600">{formatCurrency(s.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
