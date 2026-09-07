'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { Shop, SubscriptionPackage, User, PaymentTransaction, AuditLog, Branch } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Ban,
  Lock,
  Sliders,
  ExternalLink,
  Store,
  Users,
  CreditCard,
  Activity,
  Calendar,
  KeyRound,
  Mail,
  Phone,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  UserCheck,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function ShopsManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<'shops' | 'owners'>('shops');
  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Shop Details Modal State
  const [selectedShopDetails, setSelectedShopDetails] = useState<any | null>(null);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'subscription' | 'usage' | 'payments' | 'users' | 'activity'>('overview');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Access Modal State
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const defaultFormData = {
    name: '',
    category: 'Coffee Beans & Roastery',
    address: '',
    contactNumber: '',
    email: '',
    ownerName: '',
    ownerEmail: '',
    password: '',
    packageId: '',
    status: 'active' as any,
    description: '',
  };

  const [formData, setFormData] = useState(defaultFormData);

  const fetchShopsAndOwners = async () => {
    try {
      setIsLoading(true);
      const [shopRes, pkgRes, ownersRes] = await Promise.all([
        api.get<Shop[]>('/shops', { status: statusFilter, search }),
        api.get<SubscriptionPackage[]>('/packages'),
        api.get<any[]>('/users/owners'),
      ]);
      setShops(shopRes.data || []);
      setPackages(pkgRes.data || []);
      setOwners(ownersRes.data || []);
      if (pkgRes.data.length > 0 && !formData.packageId) {
        setFormData(prev => ({ ...prev, packageId: pkgRes.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShopsAndOwners();
  }, [statusFilter]);

  // Open Full Shop Details Modal
  const handleOpenShopDetails = async (shop: Shop) => {
    try {
      setIsLoadingDetails(true);
      setDetailsTab('overview');
      const res = await api.get<any>(`/shops/${shop.id}`);
      setSelectedShopDetails(res.data);
    } catch (err: any) {
      showError('Could Not Load Shop Details', err.message || 'Failed to retrieve full shop payload.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      ...defaultFormData,
      packageId: packages.length > 0 ? packages[0].id : '',
    });
    setModalError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (shop: Shop) => {
    setSelectedShop(shop);
    setFormData({
      name: shop.name,
      category: shop.category || 'Retail Store',
      address: shop.address || '',
      contactNumber: shop.contactNumber || '',
      email: shop.email || '',
      ownerName: shop.ownerName || '',
      ownerEmail: shop.ownerEmail || shop.email || '',
      password: '',
      packageId: shop.packageId || (packages.length > 0 ? packages[0].id : ''),
      status: shop.status || 'active',
      description: shop.description || '',
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Business / Shop Name is required');
      return;
    }
    if (!formData.ownerEmail.trim()) {
      setModalError('Owner Email is required');
      return;
    }
    if (!formData.packageId) {
      setModalError('Please select a valid subscription tier');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/shops', formData);
      setShowCreateModal(false);
      await fetchShopsAndOwners();
      showSuccess('Shop & Owner Created', `Shop "${formData.name}" and Owner Account "${formData.ownerEmail}" have been created successfully. Welcome email with credentials dispatched.`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to create shop. Please verify form fields.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    setModalError(null);

    setIsSubmitting(true);
    try {
      await api.patch(`/shops/${selectedShop.id}`, formData);
      setShowEditModal(false);
      await fetchShopsAndOwners();
      showSuccess('Shop Details Updated', `Shop "${formData.name}" and business category "${formData.category}" updated successfully.`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to update shop details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (shop: Shop, newStatus: string) => {
    const actionLabel = newStatus === 'active' ? 'Activate' : newStatus === 'suspended' ? 'Suspend' : 'Deactivate';

    showConfirm(
      `${actionLabel} Shop: ${shop.name}`,
      `Are you sure you want to change status of "${shop.name}" to ${newStatus.toUpperCase()}? An email notice will be sent to the store owner.`,
      async () => {
        try {
          await api.patch(`/shops/${shop.id}/status`, { status: newStatus });
          await fetchShopsAndOwners();
          showSuccess('Status Updated', `Shop "${shop.name}" status is now ${newStatus}. Owner notified.`);
        } catch (err: any) {
          showError('Status Update Failed', err.message || 'Could not update shop status.');
        }
      },
      actionLabel,
      newStatus !== 'active'
    );
  };

  const handleApproveRegistration = async (shop: Shop) => {
    showConfirm(
      `Approve Registration: ${shop.name}`,
      `Approve registration for "${shop.name}" and activate owner account "${shop.ownerEmail || shop.email}"? This will activate their subscription and send a confirmation email.`,
      async () => {
        try {
          await api.post(`/shops/${shop.id}/approve`, {});
          await fetchShopsAndOwners();
          showSuccess('Registration Approved', `Shop "${shop.name}" is now active! Confirmation email sent to ${shop.ownerEmail || shop.email}.`);
        } catch (err: any) {
          showError('Approval Failed', err.message || 'Failed to approve shop registration.');
        }
      },
      'Approve & Activate',
      false
    );
  };

  const handleOpenResetAccess = (user: any) => {
    setResetModalUser(user);
    setCustomPassword('');
    setResetReason('Super Admin generated temporary access credentials');
  };

  const handleExecuteResetAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setIsResetting(true);
    try {
      const res = await api.post<any>(`/users/${resetModalUser.id}/reset-access`, {
        newPassword: customPassword || undefined,
        reason: resetReason,
      });
      setResetModalUser(null);
      await fetchShopsAndOwners();
      showSuccess(
        'Access Reset Successful',
        `New password: "${res.data.temporaryPassword}". Sent via email to ${resetModalUser.email}.`
      );
    } catch (err: any) {
      showError('Reset Failed', err.message || 'Failed to reset access credentials.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteShop = (shop: Shop) => {
    showConfirm(
      'Delete Shop & Associated Data',
      `Are you sure you want to permanently delete "${shop.name}"? This will remove all owner, staff, branches, and subscription records.`,
      async () => {
        try {
          await api.delete(`/shops/${shop.id}`);
          await fetchShopsAndOwners();
          showSuccess('Shop Deleted', `Shop "${shop.name}" has been deleted.`);
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete shop.');
        }
      },
      'Delete Shop',
      true
    );
  };

  const filteredShops = shops.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.ownerName?.toLowerCase().includes(q) ||
        s.ownerEmail?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredOwners = owners.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.shopName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shop & Owner Accounts Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage tenant stores, shop owner accounts, registrations, subscription limits, and operational statuses (BR-01, BR-04)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('shops')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'shops'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shops View ({shops.length})
            </button>
            <button
              onClick={() => setActiveTab('owners')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'owners'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shop Owners View ({owners.length})
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Create Shop & Owner
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'shops' ? 'Search shops, categories, owners...' : 'Search shop owners by name, email, shop...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending Approval</option>
            <option value="restricted">Restricted</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* TAB 1: SHOPS TABLE */}
      {activeTab === 'shops' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-6">Business / Shop</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Owner Account</th>
                  <th className="py-3.5 px-6">Plan Tier</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Registration Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">Loading shops and accounts...</td>
                  </tr>
                ) : filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">No shops found matching your search or filters.</td>
                  </tr>
                ) : (
                  filteredShops.map(shop => (
                    <tr
                      key={shop.id}
                      onClick={() => handleOpenShopDetails(shop)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 overflow-hidden bg-white">
                            {shop.logoUrl ? (
                              <img src={shop.logoUrl} alt={shop.name} className="h-full w-full object-cover" />
                            ) : (
                              <Store className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{shop.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {shop.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 bg-slate-100 rounded-md text-slate-700 text-[11px] font-semibold border border-slate-200">
                          {shop.category || 'Retail Shop'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-slate-900 font-bold">{shop.ownerName || 'Shop Owner'}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{shop.ownerEmail || shop.email}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold text-[11px] border border-indigo-100">
                          {shop.packageName || 'Standard Plan'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            shop.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                              : shop.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                              : shop.status === 'restricted'
                              ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                              : 'bg-rose-50 text-rose-700 border-rose-200/70'
                          }`}
                        >
                          {shop.status === 'active' && <CheckCircle2 className="h-3 w-3" />}
                          {shop.status === 'pending' && <AlertTriangle className="h-3 w-3" />}
                          {shop.status === 'suspended' && <Ban className="h-3 w-3" />}
                          <span className="capitalize">{shop.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{formatDate(shop.createdAt)}</td>
                      <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {shop.status === 'pending' && (
                            <button
                              onClick={() => handleApproveRegistration(shop)}
                              title="Approve Registration"
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenShopDetails(shop)}
                            title="View Full Shop Details"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(shop)}
                            title="Edit Details"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteShop(shop)}
                            title="Delete Shop"
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      )}

      {/* TAB 2: SHOP OWNERS TABLE */}
      {activeTab === 'owners' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-6">Owner Account</th>
                  <th className="py-3.5 px-6">Associated Shop</th>
                  <th className="py-3.5 px-6">Plan Tier</th>
                  <th className="py-3.5 px-6">Staff Workers</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6">Joined Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">Loading shop owners...</td>
                  </tr>
                ) : filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">No shop owners found.</td>
                  </tr>
                ) : (
                  filteredOwners.map(owner => (
                    <tr key={owner.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                            {owner.name?.charAt(0) || 'O'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{owner.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{owner.email}</p>
                            {owner.phone && <p className="text-[10px] text-slate-400">{owner.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900">{owner.shopName}</p>
                        <p className="text-[10px] text-slate-400">{owner.shopCategory}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold text-[10px] border border-indigo-100">
                          {owner.packageName}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-800">{owner.workersCount} workers</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            owner.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {owner.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{formatDate(owner.createdAt)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {owner.status !== 'active' ? (
                            <button
                              onClick={() => handleStatusChange(owner.shop || { id: owner.shopId, name: owner.shopName } as any, 'active')}
                              title="Activate Account"
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(owner.shop || { id: owner.shopId, name: owner.shopName } as any, 'suspended')}
                              title="Suspend Account"
                              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenResetAccess(owner)}
                            title="Reset Password / Access"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          {owner.shop && (
                            <button
                              onClick={() => handleOpenShopDetails(owner.shop)}
                              title="View Associated Shop"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                            >
                              <Store className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE SHOP DETAILS MODAL (6-SECTION VIEWER) */}
      {selectedShopDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-200 overflow-hidden bg-white border border-slate-200">
                  {selectedShopDetails.shop.logoUrl ? (
                    <img src={selectedShopDetails.shop.logoUrl} alt={selectedShopDetails.shop.name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">{selectedShopDetails.shop?.name}</h2>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100">
                      {selectedShopDetails.shop?.category || 'Retail Store'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                        selectedShopDetails.shop?.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {selectedShopDetails.shop?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registration Date: <b>{formatDate(selectedShopDetails.shop?.createdAt)}</b> | Owner: {selectedShopDetails.owner?.name} ({selectedShopDetails.owner?.email})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedShopDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs for the 6 Details Sections */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setDetailsTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Overview & Registration
              </button>
              <button
                onClick={() => setDetailsTab('subscription')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'subscription'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Shop Subscription
              </button>
              <button
                onClick={() => setDetailsTab('usage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'usage'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Package Usage Quota
              </button>
              <button
                onClick={() => setDetailsTab('payments')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'payments'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Payment History ({selectedShopDetails.payments?.length || 0})
              </button>
              <button
                onClick={() => setDetailsTab('users')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'users'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Shop Users & Workers ({selectedShopDetails.users?.length || 0})
              </button>
              <button
                onClick={() => setDetailsTab('activity')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detailsTab === 'activity'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Shop Activity Logs
              </button>
            </div>

            {/* TAB CONTENT 1: OVERVIEW & REGISTRATION */}
            {detailsTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Shop Metadata</span>
                    <p><span className="font-semibold text-slate-900">Name:</span> {selectedShopDetails.shop?.name}</p>
                    <p><span className="font-semibold text-slate-900">Business Category:</span> {selectedShopDetails.shop?.category}</p>
                    <p><span className="font-semibold text-slate-900">Contact Number:</span> {selectedShopDetails.shop?.contactNumber || 'N/A'}</p>
                    <p><span className="font-semibold text-slate-900">Email:</span> {selectedShopDetails.shop?.email}</p>
                    <p><span className="font-semibold text-slate-900">Address:</span> {selectedShopDetails.shop?.address}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Registration & Timeline</span>
                    <p><span className="font-semibold text-slate-900">Registration Date:</span> {formatDate(selectedShopDetails.shop?.createdAt)}</p>
                    <p><span className="font-semibold text-slate-900">Last Profile Update:</span> {formatDate(selectedShopDetails.shop?.updatedAt)}</p>
                    <p><span className="font-semibold text-slate-900">Total Branches:</span> {selectedShopDetails.branches?.length || 1} registered</p>
                    <p><span className="font-semibold text-slate-900">Primary Branch:</span> {selectedShopDetails.branches?.[0]?.name || 'Main Branch'}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description / Notes</span>
                  <p className="text-slate-700">{selectedShopDetails.shop?.description || 'No description provided.'}</p>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: SHOP SUBSCRIPTION */}
            {detailsTab === 'subscription' && (
              <div className="p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {selectedShopDetails.subscription?.packageName || selectedShopDetails.shop?.packageName || 'Standard Tier'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pricing: <b>${selectedShopDetails.subscription?.price || 129}/month</b> | Status: <b className="uppercase text-indigo-700">{selectedShopDetails.subscription?.status || 'Active'}</b>
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold">
                    {selectedShopDetails.subscription?.autoRenew ? 'Auto-Renew Active' : 'Manual Renewal'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Start Date</span>
                    <p className="font-bold text-slate-900 mt-0.5">{formatDate(selectedShopDetails.subscription?.startAt)}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Expiry Date</span>
                    <p className="font-bold text-slate-900 mt-0.5">{formatDate(selectedShopDetails.subscription?.expiryAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: PACKAGE USAGE */}
            {detailsTab === 'usage' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Real-Time Quota Consumption</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(selectedShopDetails.usage || {}).map(([key, value]: [string, any]) => {
                    const pct = Math.min(100, Math.round((value.current / Math.max(1, value.limit)) * 100));
                    return (
                      <div key={key} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold capitalize text-slate-700">{key}</span>
                          <span className="font-mono text-slate-900">{value.current} / {value.limit}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct > 85 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 text-right">{pct}% consumed</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: PAYMENT HISTORY */}
            {detailsTab === 'payments' && (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Shop Payment Records</h3>
                {!selectedShopDetails.payments || selectedShopDetails.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payment transactions recorded for this shop.</p>
                ) : (
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="p-3">Ref ID</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedShopDetails.payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-[11px]">{p.id}</td>
                          <td className="p-3 font-bold text-slate-900">{formatCurrency(p.amount, p.currency || 'USD')}</td>
                          <td className="p-3 capitalize">{p.method?.replace('_', ' ')}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200">
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{formatDate(p.createdAt)}</td>
                          <td className="p-3">
                            {p.bankSlipUrl ? (
                              <a href={p.bankSlipUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                                View Slip
                              </a>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB CONTENT 5: SHOP USERS */}
            {detailsTab === 'users' && (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Shop Accounts & Staff Members</h3>
                <div className="space-y-2">
                  {selectedShopDetails.users?.map((u: any) => (
                    <div key={u.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{u.name} {u.role === 'shop_owner' && '(Owner)'}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-md font-semibold text-[10px] capitalize">
                          {u.role.replace('_', ' ')}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold text-[10px]">
                          {u.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 6: SHOP ACTIVITY */}
            {detailsTab === 'activity' && (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Audit & Operational Logs</h3>
                {!selectedShopDetails.activity || selectedShopDetails.activity.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No activity logs recorded for this shop.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedShopDetails.activity.map((act: any) => (
                      <div key={act.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{act.action?.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-slate-500">Performed by: {act.actorName} ({act.actorRole})</p>
                        </div>
                        <span className="text-[11px] text-slate-400">{formatDate(act.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE SHOP & OWNER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">Create New Shop & Owner Account</h2>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateShop} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business / Shop Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Electronics"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Consumer Tech & Accessories"
                    value={formData.category}
                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johnathan Doe"
                    value={formData.ownerName}
                    onChange={e => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Owner Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. owner@apextech.com"
                    value={formData.ownerEmail}
                    onChange={e => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 555 999 0000"
                    value={formData.contactNumber}
                    onChange={e => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subscription Package Tier *</label>
                  <select
                    value={formData.packageId}
                    onChange={e => setFormData(prev => ({ ...prev, packageId: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {packages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} (${pkg.price}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shop Address</label>
                <input
                  type="text"
                  placeholder="e.g. 42 Tech Boulevard, District 7"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Password (Default: Shop@123456)</label>
                <input
                  type="password"
                  placeholder="Leave blank to default to Shop@123456"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Shop...' : 'Create Shop & Notify Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHOP MODAL */}
      {showEditModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">Edit Shop & Business Category Details</h2>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditShop} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business / Shop Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={e => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Owner Email</label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={e => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={e => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subscription Package Tier</label>
                  <select
                    value={formData.packageId}
                    onChange={e => setFormData(prev => ({ ...prev, packageId: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {packages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} (${pkg.price}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Operational Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending Approval</option>
                  <option value="restricted">Restricted</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET ACCESS MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-900 text-base">Reset Owner Access Credentials</h3>
            <p className="text-xs text-slate-500">Reset password and email new temporary login credentials to the owner</p>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
              <p><span className="font-semibold text-slate-900">Owner:</span> {resetModalUser.name}</p>
              <p><span className="font-semibold text-slate-900">Email:</span> {resetModalUser.email}</p>
              <p><span className="font-semibold text-slate-900">Shop:</span> {resetModalUser.shopName || 'Assigned Store'}</p>
            </div>

            <form onSubmit={handleExecuteResetAccess} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Custom Temporary Password (leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. OwnerSecure@2026"
                  value={customPassword}
                  onChange={e => setCustomPassword(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isResetting ? 'Dispatching...' : 'Reset & Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
