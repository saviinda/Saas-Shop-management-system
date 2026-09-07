'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { Subscription, SubscriptionPackage } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { CreditCard, Search, Filter, Edit2, Calendar, CheckCircle2, Clock, Ban, RefreshCw, Power } from 'lucide-react';

interface EnrichedSubscription extends Subscription {
  shopName: string;
  ownerName: string;
  ownerEmail?: string;
}

export default function SubscriptionsListPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [subscriptions, setSubscriptions] = useState<EnrichedSubscription[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<EnrichedSubscription | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    packageId: '',
    packageName: '',
    price: 0,
    status: 'active' as any,
    expiryAt: '',
    autoRenew: true,
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subRes, pkgRes] = await Promise.all([
        api.get<EnrichedSubscription[]>('/subscriptions', { status: statusFilter, search }),
        api.get<SubscriptionPackage[]>('/packages'),
      ]);
      setSubscriptions(subRes.data);
      setPackages(pkgRes.data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const openEditModal = (sub: EnrichedSubscription) => {
    setSelectedSub(sub);
    const expDate = sub.expiryAt ? new Date(sub.expiryAt).toISOString().split('T')[0] : '';
    setFormData({
      packageId: sub.packageId || (packages.length > 0 ? packages[0].id : ''),
      packageName: sub.packageName || 'Standard Plan',
      price: sub.price || 0,
      status: sub.status || 'active',
      expiryAt: expDate,
      autoRenew: sub.autoRenew !== undefined ? sub.autoRenew : true,
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handlePackageChange = (packageId: string) => {
    const selected = packages.find(p => p.id === packageId);
    setFormData(prev => ({
      ...prev,
      packageId,
      packageName: selected?.name || prev.packageName,
      price: selected?.price !== undefined ? selected.price : prev.price,
    }));
  };

  const extendDays = (days: number) => {
    const base = formData.expiryAt ? new Date(formData.expiryAt) : new Date();
    const newDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      expiryAt: newDate.toISOString().split('T')[0],
    }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    setModalError(null);

    setIsSubmitting(true);
    try {
      const fullExpiryIso = formData.expiryAt
        ? new Date(formData.expiryAt + 'T23:59:59.000Z').toISOString()
        : selectedSub.expiryAt;

      await api.patch(`/subscriptions/${selectedSub.id}`, {
        packageId: formData.packageId,
        packageName: formData.packageName,
        price: Number(formData.price),
        status: formData.status,
        expiryAt: fullExpiryIso,
        autoRenew: formData.autoRenew,
      });

      setShowEditModal(false);
      await loadData();
      showSuccess('Subscription Updated', `Subscription details for "${selectedSub.shopName}" have been saved.`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to update subscription.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusToggle = (sub: EnrichedSubscription) => {
    const nextStatus = sub.status === 'active' ? 'cancelled' : 'active';
    const actionLabel = nextStatus === 'active' ? 'Activate' : 'Cancel';

    showConfirm(
      `${actionLabel} Subscription: ${sub.shopName}`,
      `Are you sure you want to change subscription status to "${nextStatus.toUpperCase()}"? ${
        nextStatus === 'active'
          ? 'The tenant will regain full operational limits according to their tier.'
          : 'Tenant store operations will be marked cancelled/inactive.'
      }`,
      async () => {
        try {
          await api.patch(`/subscriptions/${sub.id}/status`, { status: nextStatus });
          await loadData();
          showSuccess('Status Updated', `Subscription for "${sub.shopName}" is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Update Failed', err.message || 'Failed to update subscription status.');
        }
      },
      actionLabel,
      nextStatus === 'cancelled'
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions & Tenant Renewals</h1>
          <p className="text-xs text-slate-500 mt-1">Monitor billing cycles, renewal dates, and package limits across all shops (BR-07)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by shop, owner, plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadData()}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Tenant Shop</th>
                <th className="py-3.5 px-6">Plan Tier</th>
                <th className="py-3.5 px-6">Billing Price</th>
                <th className="py-3.5 px-6">Start Date</th>
                <th className="py-3.5 px-6">Expiry / Renewal</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400 font-medium">Loading subscriptions...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No subscriptions found matching filter</td></tr>
              ) : (
                subscriptions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 text-sm tracking-tight">{s.shopName}</p>
                      <p className="text-[11px] text-slate-400">{s.ownerName}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold text-[11px] rounded-full border border-indigo-100/80">
                        {s.packageName || 'Standard Plan'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">${s.price}/mo</td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(s.startAt)}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(s.expiryAt)}</span>
                      </div>
                      {s.autoRenew && (
                        <span className="text-[10px] text-indigo-600 font-medium mt-0.5 inline-block">Auto-renews</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        s.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                          : s.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                          : 'bg-rose-50 text-rose-700 border-rose-200/70'
                      }`}>
                        {s.status === 'active' && <CheckCircle2 className="h-3 w-3" />}
                        {s.status === 'pending' && <Clock className="h-3 w-3" />}
                        {s.status === 'expired' && <Ban className="h-3 w-3" />}
                        {s.status === 'cancelled' && <Power className="h-3 w-3" />}
                        <span className="capitalize">{s.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Subscription & Renew"
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200/80 active:scale-[0.98] transition-all duration-200 flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" /> Update
                        </button>
                        <button
                          onClick={() => handleQuickStatusToggle(s)}
                          title={s.status === 'active' ? 'Cancel Subscription' : 'Activate Subscription'}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-lg border active:scale-[0.98] transition-all duration-200 ${
                            s.status === 'active'
                              ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200/80'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/80'
                          }`}
                        >
                          {s.status === 'active' ? 'Cancel' : 'Activate'}
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

      {/* EDIT SUBSCRIPTION MODAL */}
      {showEditModal && selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Update Subscription & Renewal</h2>
            <p className="text-xs text-slate-500">Managing billing and plan tier for tenant: <span className="font-bold text-slate-800">{selectedSub.shopName}</span></p>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Package Tier</label>
                    <select
                      value={formData.packageId}
                      onChange={e => handlePackageChange(e.target.value)}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    >
                      {packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} (${pkg.price}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Monthly Billing Price ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Subscription Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Expiry / Renewal Date</label>
                    <input
                      type="date"
                      required
                      value={formData.expiryAt}
                      onChange={e => setFormData({ ...formData, expiryAt: e.target.value })}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>

                {/* Quick Extend Buttons */}
                <div>
                  <label className="block font-medium text-slate-600 mb-1.5 text-[11px]">Quick Extend Expiry / Renewal:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => extendDays(30)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-lg transition-colors"
                    >
                      +30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDays(90)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-lg transition-colors"
                    >
                      +90 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDays(365)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-lg transition-colors"
                    >
                      +1 Year
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.autoRenew}
                      onChange={e => setFormData({ ...formData, autoRenew: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Enable Auto-Renewal for this tenant
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold active:scale-[0.98] transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
