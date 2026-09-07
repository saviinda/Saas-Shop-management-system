'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { PaymentTransaction, Shop } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  CreditCard,
  Image as ImageIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Mail,
  Store,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  FileText,
  Download,
  ShieldAlert,
  ShieldCheck,
  Ban,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export default function PaymentsReviewPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [payments, setPayments] = useState<any[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Payment Details & Review Window Modal State
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<string>('successful');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slipModalUrl, setSlipModalUrl] = useState<string | null>(null);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const [paymentsRes, shopsRes] = await Promise.all([
        api.get<any[]>('/payments', {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          shopId: shopFilter !== 'all' ? shopFilter : undefined,
          method: methodFilter !== 'all' ? methodFilter : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: search || undefined,
        }),
        api.get<Shop[]>('/shops'),
      ]);
      setPayments(paymentsRes.data || []);
      setShops(shopsRes.data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, shopFilter, methodFilter, dateFrom, dateTo]);

  const handleOpenPaymentDetails = (payment: any) => {
    setSelectedPayment(payment);
    setNewStatus(payment.status || 'successful');
    setReviewNotes(payment.notes || '');
  };

  const handleUpdatePaymentStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setIsSubmitting(true);
    try {
      const res = await api.patch<any>(`/payments/${selectedPayment.id}/review`, {
        status: newStatus,
        notes: reviewNotes,
      });

      const recipientEmail = res.data?.recipient || selectedPayment.ownerEmail || 'Shop Owner';
      const statusLabel = newStatus.toUpperCase();

      setSelectedPayment(null);
      await fetchPayments();

      showSuccess(
        'Payment Status Updated',
        `Payment status changed to ${statusLabel}. An email notification has been dispatched to ${recipientEmail}.`
      );
    } catch (err: any) {
      showError('Update Failed', err.message || 'Failed to update payment transaction status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaymentRestriction = async (payment: any) => {
    const isCurrentlyRestricted = payment.isPaymentRestricted;
    const actionLabel = isCurrentlyRestricted ? 'Restore Payment Access' : 'Restrict Payment Processing';

    showConfirm(
      `${actionLabel} for "${payment.shopName}"`,
      `Are you sure you want to ${isCurrentlyRestricted ? 'restore' : 'restrict'} payment processing for shop "${payment.shopName}"? The store owner will receive an email notification.`,
      async () => {
        try {
          await api.patch(`/payments/shops/${payment.shopId}/restrict`, {
            isRestricted: !isCurrentlyRestricted,
            reason: !isCurrentlyRestricted ? 'Payment processing restricted by Super Admin' : undefined,
          });
          await fetchPayments();
          if (selectedPayment && selectedPayment.shopId === payment.shopId) {
            setSelectedPayment((prev: any) => ({ ...prev, isPaymentRestricted: !isCurrentlyRestricted }));
          }
          showSuccess(
            'Payment Access Updated',
            `Payment processing for "${payment.shopName}" is now ${!isCurrentlyRestricted ? 'RESTRICTED' : 'RESTORED'}. Owner notified.`
          );
        } catch (err: any) {
          showError('Action Failed', err.message || 'Could not update payment restriction.');
        }
      },
      actionLabel,
      !isCurrentlyRestricted
    );
  };

  const handleOpenReportModal = async () => {
    setShowReportModal(true);
    setIsLoadingReport(true);
    try {
      const res = await api.get<any>('/payments/report', {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        shopId: shopFilter !== 'all' ? shopFilter : undefined,
        method: methodFilter !== 'all' ? methodFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReportData(res.data);
    } catch (err: any) {
      showError('Report Failed', err.message || 'Failed to generate payment report.');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleExportReportCSV = () => {
    const listToExport = reportData?.transactions || payments;
    if (!listToExport.length) return;

    const headers = ['Transaction ID', 'Shop Name', 'Owner Name', 'Owner Email', 'Amount', 'Currency', 'Method', 'Status', 'Date', 'Notes'];
    const rows = listToExport.map((p: any) => [
      `"${p.id}"`,
      `"${p.shopName || ''}"`,
      `"${p.ownerName || ''}"`,
      `"${p.ownerEmail || ''}"`,
      p.amount,
      `"${p.currency || 'USD'}"`,
      `"${p.method}"`,
      `"${p.status}"`,
      `"${p.createdAt}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusTabList = [
    { label: 'All Payments', value: 'all' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Successful / Approved', value: 'successful' },
    { label: 'Failed', value: 'failed' },
    { label: 'Processing', value: 'processing' },
    { label: 'Refunded', value: 'refunded' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment & Bank Slip Verification Suite</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review transactions, inspect bank slips, approve/reject payments, filter by shop/date, and generate financial reports (BR-08)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPayments}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleOpenReportModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            <FileText className="h-4 w-4" /> Generate Payment Report
          </button>
        </div>
      </div>

      {/* Status Pills Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {statusTabList.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by shop, owner, ref ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPayments()}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs transition-all"
          />
        </div>

        {/* Multi-Filters: Shop, Method, Dates */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Shop Selector */}
          <div className="flex items-center gap-1">
            <Store className="h-4 w-4 text-slate-400" />
            <select
              value={shopFilter}
              onChange={e => setShopFilter(e.target.value)}
              className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
            >
              <option value="all">All Shops</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          >
            <option value="all">All Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card Payment</option>
          </select>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From Date"
              className="py-1.5 px-2 text-xs border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 focus:bg-white focus:outline-none shadow-2xs"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To Date"
              className="py-1.5 px-2 text-xs border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 focus:bg-white focus:outline-none shadow-2xs"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-[10px] text-rose-600 hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Shop Entity & Owner</th>
                <th className="py-3.5 px-6">Plan Tier</th>
                <th className="py-3.5 px-6">Amount</th>
                <th className="py-3.5 px-6">Method / Gateway</th>
                <th className="py-3.5 px-6">Bank Slip Proof</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading payment records...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No payment transactions found matching the selected filters.</td>
                </tr>
              ) : (
                payments.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => handleOpenPaymentDetails(p)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900">{p.shopName || 'Shop'}</p>
                            {p.isPaymentRestricted && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-rose-100 text-rose-800 font-bold rounded">
                                RESTRICTED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{p.ownerName} ({p.ownerEmail})</p>
                          <p className="text-[10px] text-slate-400 font-mono">Ref: {p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 rounded-full text-slate-700 text-[11px] font-semibold border border-slate-200/60">
                        {p.packageName || 'Standard Tier'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 text-sm">
                      {formatCurrency(p.amount, p.currency || 'USD')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="capitalize text-slate-700 font-semibold text-[11px]">
                          {p.method?.replace('_', ' ')}
                        </span>
                        {p.cardLast4 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.cardBrand || 'Card'} •••• {p.cardLast4}
                          </span>
                        )}
                        {p.gatewayRef && !p.cardLast4 && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            {p.gatewayRef}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6" onClick={e => e.stopPropagation()}>
                      {p.bankSlipUrl ? (
                        <button
                          onClick={() => setSlipModalUrl(p.bankSlipUrl)}
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100"
                        >
                          <ImageIcon className="h-3.5 w-3.5" /> View Slip
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A (Card/Gateway)</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          p.status === 'successful'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            : p.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                            : p.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                            : p.status === 'refunded'
                            ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                            : 'bg-rose-50 text-rose-700 border-rose-200/70'
                        }`}
                      >
                        {p.status === 'successful' && <CheckCircle2 className="h-3 w-3" />}
                        {p.status === 'pending' && <AlertCircle className="h-3 w-3" />}
                        {p.status === 'failed' && <XCircle className="h-3 w-3" />}
                        <span className="capitalize">{p.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPaymentDetails(p)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-[0.98]"
                        >
                          Review & Update
                        </button>
                        <button
                          onClick={() => handleTogglePaymentRestriction(p)}
                          title={p.isPaymentRestricted ? 'Restore Payment Access' : 'Restrict Payment Processing'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            p.isPaymentRestricted
                              ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200'
                          }`}
                        >
                          {p.isPaymentRestricted ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL PAYMENT DETAILS & STATUS UPDATE WINDOW / MODAL */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Payment & Transaction Inspection</h2>
                  <p className="text-xs text-slate-500">Inspect bank slip proof, update status lifecycle, and notify store owner</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid of details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shop Information</span>
                <p className="font-bold text-slate-900 text-sm">{selectedPayment.shopName}</p>
                <p className="text-slate-600"><span className="text-slate-400">Category:</span> {selectedPayment.category || 'Specialty Store'}</p>
                <p className="text-slate-600"><span className="text-slate-400">Address:</span> {selectedPayment.shopAddress || 'Main Branch'}</p>
                {selectedPayment.isPaymentRestricted && (
                  <p className="text-rose-600 font-bold flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Payment Access Restricted
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shop Owner Contact</span>
                <p className="font-bold text-slate-900 text-sm">{selectedPayment.ownerName}</p>
                <p className="text-slate-600 flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {selectedPayment.ownerEmail}</p>
                {selectedPayment.shopContact && (
                  <p className="text-slate-600"><span className="text-slate-400">Phone:</span> {selectedPayment.shopContact}</p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Financial Amount</span>
                <p className="font-bold text-slate-900 text-base text-indigo-600">
                  {formatCurrency(selectedPayment.amount, selectedPayment.currency || 'USD')}
                </p>
                <p className="text-slate-600"><span className="text-slate-400">Plan:</span> {selectedPayment.packageName || 'Standard Tier'}</p>
                <p className="text-slate-600"><span className="text-slate-400">Method:</span> <span className="capitalize">{selectedPayment.method?.replace('_', ' ')}</span></p>
                {selectedPayment.cardLast4 && (
                  <p className="text-slate-600"><span className="text-slate-400">Card:</span> {selectedPayment.cardBrand} •••• {selectedPayment.cardLast4}</p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transaction ID & Timeline</span>
                <p className="font-mono text-slate-800 text-[11px]">{selectedPayment.id}</p>
                <p className="text-slate-600 flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /> {formatDate(selectedPayment.createdAt)}</p>
                <p className="text-slate-600"><span className="text-slate-400">Current Status:</span> <b className="uppercase">{selectedPayment.status}</b></p>
              </div>
            </div>

            {/* Bank Slip Viewer Section */}
            {selectedPayment.bankSlipUrl ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-indigo-600" /> Submitted Bank Transfer Slip
                  </span>
                  <a
                    href={selectedPayment.bankSlipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    Open in Full Screen <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="relative h-48 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                  <img
                    src={selectedPayment.bankSlipUrl}
                    alt="Bank Slip Proof"
                    className="object-contain w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" /> Secure Card / Gateway transaction (sanitized token stored; no raw CVV/PAN in database).
              </div>
            )}

            {/* Status Update Form with Dropdown Covering Full Lifecycle */}
            <form onSubmit={handleUpdatePaymentStatus} className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Update Payment Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                  >
                    <option value="successful">Approve Payment (Successful & Active)</option>
                    <option value="pending">Pending (Awaiting Slip Review)</option>
                    <option value="processing">Processing (Gateway in Progress)</option>
                    <option value="failed">Failed (Declined / Rejected)</option>
                    <option value="refunded">Refunded (Issue Full Refund)</option>
                    <option value="cancelled">Cancelled (Order Cancelled)</option>
                  </select>
                </div>

                {/* Status Explanation Badge */}
                <div className="flex flex-col justify-end">
                  <div
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                      newStatus === 'successful'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : newStatus === 'pending' || newStatus === 'processing'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : newStatus === 'refunded'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {newStatus === 'successful' && <CheckCircle2 className="h-4 w-4" />}
                    {newStatus === 'pending' && <AlertCircle className="h-4 w-4" />}
                    {newStatus === 'failed' && <XCircle className="h-4 w-4" />}
                    <span>
                      {newStatus === 'successful'
                        ? 'Action: Approves payment and activates shop subscription'
                        : newStatus === 'refunded'
                        ? 'Action: Marks transaction as refunded'
                        : newStatus === 'pending'
                        ? 'Action: Keeps transaction in pending review queue'
                        : 'Action: Marks transaction as failed/cancelled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reviewer Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Verification Notes / Reason (Included in email sent to Shop Owner)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bank slip verified. Subscription plan is active."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              {/* Email dispatch notice alert */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>
                  An automated email notice will be immediately dispatched to <b>{selectedPayment.ownerEmail || 'Shop Owner'}</b>.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleTogglePaymentRestriction(selectedPayment)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    selectedPayment.isPaymentRestricted
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {selectedPayment.isPaymentRestricted ? 'Restore Shop Payment Access' : 'Restrict Shop Payment Processing'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? 'Updating & Sending Email...' : 'Save & Send Email to Shop Owner'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Payment Financial Report Summary</h2>
                  <p className="text-xs text-slate-500">Platform billing intake, volume breakdown, and verification rates</p>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingReport ? (
              <div className="py-12 text-center text-slate-400">Generating report...</div>
            ) : reportData ? (
              <div className="space-y-4 text-xs">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Volume</span>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCurrency(reportData.summary?.totalVolume || 0, 'USD')}
                    </p>
                    <p className="text-[10px] text-slate-500">{reportData.summary?.totalTransactions} transactions</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Successful Paid</span>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">
                      {formatCurrency(reportData.summary?.successfulVolume || 0, 'USD')}
                    </p>
                    <p className="text-[10px] text-slate-500">{reportData.summary?.statusCounts?.successful?.count} approved</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Pending Review</span>
                    <p className="text-lg font-bold text-amber-600 mt-0.5">
                      {formatCurrency(reportData.summary?.pendingVolume || 0, 'USD')}
                    </p>
                    <p className="text-[10px] text-slate-500">{reportData.summary?.statusCounts?.pending?.count} pending</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Verification Rate</span>
                    <p className="text-lg font-bold text-indigo-600 mt-0.5">
                      {reportData.summary?.verificationRate}%
                    </p>
                    <p className="text-[10px] text-slate-500">approval accuracy</p>
                  </div>
                </div>

                {/* Status Breakdown Table */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">Lifecycle Status Breakdown</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(reportData.summary?.statusCounts || {}).map(([st, val]: [string, any]) => (
                      <div key={st} className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="capitalize text-slate-600 font-semibold">{st}</span>
                        <p className="font-bold text-slate-900">{formatCurrency(val.volume, 'USD')} ({val.count})</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Method Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bank Transfer Volume</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(reportData.summary?.methodCounts?.bank_transfer?.volume || 0, 'USD')}
                    </p>
                    <p className="text-[10px] text-slate-500">{reportData.summary?.methodCounts?.bank_transfer?.count} slips</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Card Gateway Volume</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(reportData.summary?.methodCounts?.card?.volume || 0, 'USD')}
                    </p>
                    <p className="text-[10px] text-slate-500">{reportData.summary?.methodCounts?.card?.count} charges</p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">Generated: {formatDate(reportData.generatedAt)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportReportCSV}
                      className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Report CSV
                    </button>
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Slip Zoom Modal */}
      {slipModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Bank Slip High Resolution Proof</h3>
              <button onClick={() => setSlipModalUrl(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-100 rounded-xl p-2">
              <img src={slipModalUrl} alt="Slip Full View" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
