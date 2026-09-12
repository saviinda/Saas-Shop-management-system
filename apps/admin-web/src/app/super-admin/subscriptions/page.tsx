'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { Subscription, SubscriptionPackage } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  CreditCard,
  Search,
  Filter,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
  Power,
  Store,
  ExternalLink,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Eye,
  X,
} from 'lucide-react';

interface EnrichedSubscription extends Subscription {
  shop?: any;
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

  // Edit Subscription Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<EnrichedSubscription | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Shop Details Modal State
  const [selectedShopModal, setSelectedShopModal] = useState<any | null>(null);
  const [isLoadingShopDetails, setIsLoadingShopDetails] = useState(false);

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

  const handleOpenShopModal = async (sub: EnrichedSubscription) => {
    setIsLoadingShopDetails(true);
    try {
      if (sub.shopId) {
        const res = await api.get<any>(`/shops/${sub.shopId}`);
        setSelectedShopModal({
          ...res.data,
          subscription: sub,
        });
      } else if (sub.shop) {
        setSelectedShopModal({
          ...sub.shop,
          subscription: sub,
        });
      } else {
        setSelectedShopModal({
          id: sub.shopId,
          name: sub.shopName,
          ownerName: sub.ownerName,
          ownerEmail: sub.ownerEmail,
          packageName: sub.packageName,
          subscription: sub,
        });
      }
    } catch (err) {
      console.error('Failed to load shop details:', err);
      setSelectedShopModal({
        id: sub.shopId,
        name: sub.shopName,
        ownerName: sub.ownerName,
        ownerEmail: sub.ownerEmail,
        packageName: sub.packageName,
        subscription: sub,
      });
    } finally {
      setIsLoadingShopDetails(false);
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions & Tenant Renewals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor billing cycles, renewal dates, and click on any tenant shop to view its profile and details (BR-07)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/super-admin/shops"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-colors"
          >
            <Store className="h-4 w-4 text-indigo-600" />
            <span>View All Shops</span>
          </Link>
          <button
            onClick={loadData}
            title="Refresh subscriptions"
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
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
                <th className="py-3.5 px-6">Tenant Shop (Click to View)</th>
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
                    {/* Tenant Shop Column - Clickable to View Shop Profile */}
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => handleOpenShopModal(s)}
                        className="group text-left focus:outline-none flex items-start gap-2.5 p-1 -ml-1 rounded-xl hover:bg-indigo-50/50 transition-colors"
                        title="Click to view full shop details"
                      >
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-indigo-600 transition-colors">
                              {s.shopName}
                            </span>
                            <Eye className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:text-indigo-600 transition-all" />
                          </div>
                          <p className="text-[11px] text-slate-400">{s.ownerName}</p>
                        </div>
                      </button>
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
                          onClick={() => handleOpenShopModal(s)}
                          title="View Shop Details"
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-indigo-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200/90 active:scale-[0.98] transition-all duration-200 flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="h-3 w-3 text-indigo-600" /> View Shop
                        </button>
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

      {/* MODAL 1: VIEW SHOP DETAILS MODAL */}
      {selectedShopModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-200">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{selectedShopModal.name}</h3>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {selectedShopModal.category || 'Retail Store'}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedShopModal.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {selectedShopModal.status || 'active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    ID: {selectedShopModal.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShopModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shop Core Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Primary Contact Info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" /> Store Contact & Location
                </p>
                <div className="space-y-1 text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{selectedShopModal.email || 'No email specified'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{selectedShopModal.contactNumber || 'No phone specified'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{selectedShopModal.address || 'Headquarters / Main Branch'}</span>
                  </p>
                </div>
              </div>

              {/* Owner Profile */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-600" /> Primary Shop Owner
                </p>
                <div className="space-y-1 text-slate-600">
                  <p className="font-bold text-slate-900 text-xs">
                    {selectedShopModal.ownerName || selectedShopModal.owner?.name || 'Primary Franchisee'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{selectedShopModal.ownerEmail || selectedShopModal.owner?.email || 'N/A'}</span>
                  </p>
                  {selectedShopModal.owner?.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>{selectedShopModal.owner?.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Active Subscription Details */}
            {selectedShopModal.subscription && (
              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-600" /> Active Subscription Plan
                  </p>
                  <span className="px-2.5 py-0.5 bg-indigo-200/70 text-indigo-900 font-bold text-[11px] rounded-full">
                    {selectedShopModal.subscription.packageName || selectedShopModal.packageName || 'Standard Plan'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                    <p className="text-[10px] text-slate-400">Monthly Price</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">${selectedShopModal.subscription.price}/mo</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                    <p className="text-[10px] text-slate-400">Status</p>
                    <p className="font-bold text-emerald-700 capitalize text-sm mt-0.5">{selectedShopModal.subscription.status}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                    <p className="text-[10px] text-slate-400">Start Date</p>
                    <p className="font-semibold text-slate-700 text-xs mt-0.5">{formatDate(selectedShopModal.subscription.startAt)}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                    <p className="text-[10px] text-slate-400">Renewal Date</p>
                    <p className="font-semibold text-indigo-700 text-xs mt-0.5">{formatDate(selectedShopModal.subscription.expiryAt)}</p>
                  </div>
                </div>

                {selectedShopModal.subscription.autoRenew && (
                  <p className="text-[11px] text-indigo-700 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Auto-renewal is enabled for this tenant.
                  </p>
                )}
              </div>
            )}

            {/* Operational Stats if available */}
            {selectedShopModal.branches && selectedShopModal.branches.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Registered Branches ({selectedShopModal.branches.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedShopModal.branches.map((b: any) => (
                    <span key={b.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                      {b.name} ({b.city || 'Main'})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <Link
                href={`/super-admin/shops?search=${encodeURIComponent(selectedShopModal.name)}`}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                <span>Open Full Profile in Shops Page</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </Link>

              <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sub = selectedShopModal.subscription;
                    setSelectedShopModal(null);
                    if (sub) openEditModal(sub);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors flex items-center gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Update Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShopModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SUBSCRIPTION MODAL */}
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
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.price}/mo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Monthly Billing Price ($)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
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
                      value={formData.expiryAt}
                      onChange={e => setFormData(prev => ({ ...prev, expiryAt: e.target.value }))}
                      className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Quick Validity Extension</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => extendDays(30)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                    >
                      +30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDays(90)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                    >
                      +90 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDays(365)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                    >
                      +1 Year
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoRenew"
                    checked={formData.autoRenew}
                    onChange={e => setFormData(prev => ({ ...prev, autoRenew: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="autoRenew" className="font-medium text-slate-700">
                    Enable automatic renewal for this billing cycle
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
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
