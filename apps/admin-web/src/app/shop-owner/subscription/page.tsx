'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api-client';
import { SubscriptionPackage, PaymentTransaction } from '@saas/types';
import { useModal } from '@/lib/modal-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Check,
  ShieldCheck,
  UploadCloud,
  FileImage,
  X,
  CreditCard,
  Building2,
  Sparkles,
  Info,
  CheckCircle2,
  Receipt,
  Printer,
  Calendar,
  Clock,
  ExternalLink,
  Store,
  History,
  AlertCircle,
  XCircle,
} from 'lucide-react';

export default function ShopSubscriptionPage() {
  const { showSuccess, showError } = useModal();
  const [subInfo, setSubInfo] = useState<any>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upgrade Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<SubscriptionPackage | null>(null);

  // Bank Slip Upload & Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    method: 'bank_transfer' as 'bank_transfer' | 'card',
    bankSlipUrl: '',
    slipFileName: '',
    slipFileSize: '',
    notes: '',
  });

  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invoice / Receipt Modal State
  const [selectedInvoicePayment, setSelectedInvoicePayment] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subRes, pkgRes, paymentsRes] = await Promise.all([
        api.get<any>('/subscriptions/my'),
        api.get<SubscriptionPackage[]>('/packages'),
        api.get<PaymentTransaction[]>('/payments'),
      ]);
      setSubInfo(subRes.data);
      setPackages(pkgRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err) {
      console.error('Failed to load subscription info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showError('Invalid File Type', 'Please upload an image file (PNG, JPG, JPEG, WEBP) or PDF bank slip receipt.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Maximum bank slip file size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const sizeKb = Math.round(file.size / 1024);
      setPaymentForm(prev => ({
        ...prev,
        bankSlipUrl: dataUrl,
        slipFileName: file.name,
        slipFileSize: `${sizeKb} KB`,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkg) return;

    if (paymentForm.method === 'bank_transfer' && !paymentForm.bankSlipUrl) {
      showError('Bank Slip Required', 'Please upload or provide your bank transfer slip proof before submitting.');
      return;
    }

    try {
      await api.post('/payments/request', {
        packageId: selectedPkg.id,
        amount: selectedPkg.price,
        method: paymentForm.method,
        bankSlipUrl: paymentForm.method === 'bank_transfer' ? paymentForm.bankSlipUrl : undefined,
        notes: paymentForm.notes,
      });

      setShowPaymentModal(false);
      setPaymentForm({
        method: 'bank_transfer',
        bankSlipUrl: '',
        slipFileName: '',
        slipFileSize: '',
        notes: '',
      });

      showSuccess(
        'Payment Submitted',
        paymentForm.method === 'card'
          ? 'Payment processed successfully! Your subscription tier has been activated.'
          : 'Bank slip submitted! The Super Admin has been notified to verify and approve your upgrade.'
      );
      loadData();
    } catch (err: any) {
      showError('Payment Request Failed', err.message || 'Failed to submit payment request.');
    }
  };

  const usage = subInfo?.usage || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscription & Financial Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Plan quotas, tier upgrades, bank slip payment submissions, payment history, and tax invoices (BR-03, BR-04)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (packages.length > 0) {
                setSelectedPkg(packages[0]);
                setShowPaymentModal(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-4 w-4" /> Upgrade / Renew Plan
          </button>
        </div>
      </div>

      {/* Current Active Plan Card */}
      {subInfo && (
        <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-sm shadow-indigo-100/50 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs uppercase rounded-full border border-indigo-100/80">
                  Active Subscription Plan
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Renews: {subInfo.subscription?.expiryAt ? formatDate(subInfo.subscription.expiryAt) : 'Monthly'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-2.5 tracking-tight">{subInfo.package?.name || 'Standard Tier'}</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subInfo.package?.description}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">${subInfo.package?.price}<span className="text-xs text-slate-400 font-normal">/month</span></p>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold mt-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
                <Check className="h-3.5 w-3.5" /> Active & Verified
              </span>
            </div>
          </div>

          {/* Usage Meters */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Real-time Resource Quota Consumption
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {usage.branches && (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>Branches</span>
                    <span className="font-bold text-slate-900">{usage.branches.current} / {usage.branches.limit}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usage.branches.current >= usage.branches.limit ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (usage.branches.current / usage.branches.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {usage.users && (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>Staff Users</span>
                    <span className="font-bold text-slate-900">{usage.users.current} / {usage.users.limit}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usage.users.current >= usage.users.limit ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (usage.users.current / usage.users.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {usage.products && (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>Product Catalog</span>
                    <span className="font-bold text-slate-900">{usage.products.current} / {usage.products.limit}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usage.products.current >= usage.products.limit ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (usage.products.current / usage.products.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {usage.services && (
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>Services</span>
                    <span className="font-bold text-slate-900">{usage.services.current} / {usage.services.limit}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usage.services.current >= usage.services.limit ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (usage.services.current / usage.services.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Plans for Upgrade */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Upgrade Subscription Package</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 ${
                subInfo?.package?.id === pkg.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-base">{pkg.name}</h3>
                  {subInfo?.package?.id === pkg.id && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Current Plan
                    </span>
                  )}
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mb-2">
                  ${pkg.price}<span className="text-xs text-slate-400 font-normal"> /month</span>
                </p>
                <p className="text-xs text-slate-500">{pkg.description}</p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600 font-medium">
                  <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-600" /> {pkg.limits.branches} Branch Quota</p>
                  <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-600" /> {pkg.limits.users} Max Staff Users</p>
                  <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-600" /> {pkg.limits.products} Product SKUs</p>
                  <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-600" /> {pkg.limits.services} Service Items</p>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => {
                    setSelectedPkg(pkg);
                    setShowPaymentModal(true);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200"
                >
                  Select & Submit Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History & Tax Invoices Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Payment History & Tax Invoices</h2>
            <p className="text-xs text-slate-500">View past transaction submissions, verification status, and official payment receipts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-6">Transaction Ref</th>
                  <th className="py-3.5 px-6">Tier Plan</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Payment Method</th>
                  <th className="py-3.5 px-6">Payment Status</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Invoice Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading payment history...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No payment records found.</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-mono text-[11px] text-slate-800 font-bold">
                        {p.id}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {p.packageName || 'Platform Subscription'}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-slate-900 text-sm">
                        {formatCurrency(p.amount, p.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6 capitalize">
                        <span className="text-slate-700 font-medium">
                          {p.method?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            p.status === 'successful'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : p.status === 'processing'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : p.status === 'refunded'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {p.status === 'successful' && <CheckCircle2 className="h-3 w-3" />}
                          {p.status === 'pending' && <Clock className="h-3 w-3" />}
                          {p.status === 'failed' && <XCircle className="h-3 w-3" />}
                          <span className="capitalize">{p.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{formatDate(p.createdAt)}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedInvoicePayment(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl border border-indigo-200 shadow-2xs transition-colors"
                        >
                          <Receipt className="h-3.5 w-3.5" /> View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PAYMENT & BANK SLIP UPLOAD MODAL */}
      {showPaymentModal && selectedPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Upgrade to {selectedPkg.name}</h2>
                <p className="text-xs text-slate-500">Amount due: <span className="font-bold text-indigo-600 text-sm">${selectedPkg.price}.00 USD</span></p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePay} className="space-y-4 text-xs">
              {/* Payment Method Selector */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'bank_transfer' })}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      paymentForm.method === 'bank_transfer'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                        : 'border-slate-200/90 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4" /> Bank Transfer & Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'card' })}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      paymentForm.method === 'card'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                        : 'border-slate-200/90 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" /> Credit / Debit Card
                  </button>
                </div>
              </div>

              {/* BANK TRANSFER WITH BANK DETAILS & SLIP UPLOAD */}
              {paymentForm.method === 'bank_transfer' ? (
                <div className="space-y-3.5">
                  {/* Bank Account Details Container */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-indigo-600" /> Bank Transfer Beneficiary Account:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400">Bank Name:</span>
                        <p className="font-bold text-slate-800">Silicon Valley Commercial Bank</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Account Number:</span>
                        <p className="font-bold text-slate-800 font-mono">9021-8842-1100-3342</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Beneficiary:</span>
                        <p className="font-bold text-slate-800">SaaS Platform Solutions Inc.</p>
                      </div>
                      <div>
                        <span className="text-slate-400">SWIFT / Routing:</span>
                        <p className="font-bold text-slate-800 font-mono">SVCBUSS33</p>
                      </div>
                    </div>
                  </div>

                  {/* Bank Slip Upload Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileImage className="h-4 w-4 text-indigo-600" /> Upload Bank Slip Proof <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setUploadMode('upload')}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            uploadMode === 'upload' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Upload File
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setUploadMode('url')}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            uploadMode === 'url' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Paste URL
                        </button>
                      </div>
                    </div>

                    {uploadMode === 'upload' ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />

                        {!paymentForm.bankSlipUrl ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                              isDragging
                                ? 'border-indigo-500 bg-indigo-50/50'
                                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="h-10 w-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                              <UploadCloud className="h-5 w-5" />
                            </div>
                            <p className="font-bold text-slate-800 text-xs">
                              Click to browse or drag & drop your bank slip
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Supports JPG, PNG, WEBP or PDF receipt (Max 5MB)
                            </p>
                          </div>
                        ) : (
                          /* Slip Preview Card */
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                                  {paymentForm.slipFileName || 'Bank Slip Uploaded'}
                                </span>
                                {paymentForm.slipFileSize && (
                                  <span className="text-[10px] text-slate-400 font-mono">({paymentForm.slipFileSize})</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentForm(prev => ({
                                    ...prev,
                                    bankSlipUrl: '',
                                    slipFileName: '',
                                    slipFileSize: '',
                                  }))
                                }
                                className="text-xs text-rose-600 hover:underline font-semibold"
                              >
                                Remove / Change
                              </button>
                            </div>

                            {/* Image Thumbnail */}
                            {paymentForm.bankSlipUrl.startsWith('data:image') || paymentForm.bankSlipUrl.startsWith('http') ? (
                              <div className="h-32 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                                <img
                                  src={paymentForm.bankSlipUrl}
                                  alt="Bank Slip Preview"
                                  className="object-contain w-full h-full"
                                />
                              </div>
                            ) : (
                              <div className="p-4 bg-white rounded border border-slate-200 text-center text-slate-600 text-xs">
                                PDF Document Attached ({paymentForm.slipFileName})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* URL Input Mode */
                      <div>
                        <input
                          type="url"
                          placeholder="https://.../bank-slip-receipt.jpg"
                          value={paymentForm.bankSlipUrl}
                          onChange={e =>
                            setPaymentForm(prev => ({
                              ...prev,
                              bankSlipUrl: e.target.value,
                              slipFileName: 'Remote URL Receipt',
                            }))
                          }
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                        {paymentForm.bankSlipUrl && (
                          <div className="mt-2 h-28 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                            <img
                              src={paymentForm.bankSlipUrl}
                              alt="Slip Preview"
                              className="object-contain w-full h-full"
                              onError={e => {
                                (e.target as any).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Card Gateway Mode */
                <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 text-indigo-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    <span className="font-bold text-xs">Secure Card Gateway Sandbox</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Card payments are simulated with instant tokenization. Your upgraded subscription limits will be activated immediately without waiting for manual verification.
                  </p>
                </div>
              )}

              {/* Reference Notes */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Optional Reference / Transfer Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Bank slip transfer reference #88219 or notes for admin"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200 shadow-2xs"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all"
                >
                  {paymentForm.method === 'card' ? 'Pay Now & Activate Tier' : 'Submit Bank Slip for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL INVOICE / RECEIPT MODAL */}
      {selectedInvoicePayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 space-y-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Invoice Printable Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center">
                    <Store className="h-4 w-4" />
                  </div>
                  <span className="font-extrabold text-slate-900 text-base">SaaS Platform Solutions Inc.</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">100 Tech Enterprise Blvd, Silicon Valley, CA</p>
                <p className="text-[11px] text-slate-500">billing@saasplatform.com | Tax ID: US-9948201</p>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg uppercase tracking-wider block mb-1">
                  Tax Invoice / Receipt
                </span>
                <p className="text-xs font-mono text-slate-600">Inv #: {selectedInvoicePayment.id}</p>
                <p className="text-[11px] text-slate-400">Date: {formatDate(selectedInvoicePayment.createdAt)}</p>
              </div>
            </div>

            {/* Billed To / Billed By Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Billed To (Customer):</span>
                <p className="font-bold text-slate-900 mt-1 text-sm">{selectedInvoicePayment.shopName || subInfo?.shop?.name || 'Your Shop'}</p>
                <p className="text-slate-600">{selectedInvoicePayment.ownerName || subInfo?.user?.name}</p>
                <p className="text-slate-500">{selectedInvoicePayment.ownerEmail || subInfo?.user?.email}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Payment Summary:</span>
                <p className="text-slate-600 mt-1"><span className="text-slate-400">Method:</span> <b className="capitalize">{selectedInvoicePayment.method?.replace('_', ' ')}</b></p>
                <p className="text-slate-600"><span className="text-slate-400">Status:</span> <b className="uppercase text-emerald-600">{selectedInvoicePayment.status}</b></p>
                <p className="text-slate-600"><span className="text-slate-400">Currency:</span> {selectedInvoicePayment.currency || 'USD'}</p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center">Period</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{selectedInvoicePayment.packageName || 'Platform Subscription Tier'}</p>
                      <p className="text-[11px] text-slate-500">Multi-tenant store operations and multi-branch management package</p>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">30 Days</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(selectedInvoicePayment.amount, selectedInvoicePayment.currency || 'USD')}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-4 text-right text-slate-600">Total Amount Paid:</td>
                    <td className="py-2.5 px-4 text-right text-indigo-600 text-sm">
                      {formatCurrency(selectedInvoicePayment.amount, selectedInvoicePayment.currency || 'USD')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Status Footer Badge */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Verified Official Payment Receipt</span>
              </div>
              <span className="font-mono text-[11px]">{selectedInvoicePayment.id}</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </button>

              <button
                type="button"
                onClick={() => setSelectedInvoicePayment(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shadow-2xs transition-colors"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
