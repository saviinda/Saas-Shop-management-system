'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { User, Shop } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Search,
  UserCheck,
  Building2,
  Users,
  Shield,
  KeyRound,
  Trash2,
  Filter,
  CheckCircle2,
  Ban,
  ShieldAlert,
  Mail,
  Phone,
  Store,
  ChevronDown,
  ChevronRight,
  Sparkles,
  UserPlus,
  RefreshCw,
} from 'lucide-react';

interface ShopGroup {
  shop: Shop;
  owner: any;
  workers: any[];
}

export default function UsersManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [shopGroups, setShopGroups] = useState<ShopGroup[]>([]);
  const [superAdmins, setSuperAdmins] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'shop_wise' | 'all_users'>('shop_wise');
  const [collapsedShops, setCollapsedShops] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Edit User Modal
  const [editModalUser, setEditModalUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: '', status: '' });
  const [isEditing, setIsEditing] = useState(false);

  const fetchUsersData = async () => {
    try {
      setIsLoading(true);
      const [groupedRes, shopsRes] = await Promise.all([
        api.get<any>('/users', { groupBy: 'shop', search, role: roleFilter, status: statusFilter }),
        api.get<Shop[]>('/shops'),
      ]);

      if (groupedRes.data?.shopGroups) {
        setShopGroups(groupedRes.data.shopGroups);
        setSuperAdmins(groupedRes.data.superAdmins || []);
        setAllUsers(groupedRes.data.allUsers || []);
      } else {
        setAllUsers(Array.isArray(groupedRes.data) ? groupedRes.data : []);
      }
      setShops(shopsRes.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, [roleFilter, statusFilter]);

  const toggleShopCollapse = (shopId: string) => {
    setCollapsedShops(prev => ({ ...prev, [shopId]: !prev[shopId] }));
  };

  const handleStatusChange = async (user: any, newStatus: string) => {
    showConfirm(
      `${newStatus === 'active' ? 'Activate' : newStatus === 'suspended' ? 'Suspend' : 'Deactivate'} User`,
      `Are you sure you want to change status of ${user.name} (${user.email}) to ${newStatus.toUpperCase()}?`,
      async () => {
        try {
          await api.patch(`/users/${user.id}`, { status: newStatus });
          await fetchUsersData();
          showSuccess('Status Updated', `User account status changed to ${newStatus}.`);
        } catch (err: any) {
          showError('Update Failed', err.message || 'Failed to update user status.');
        }
      },
      newStatus === 'active' ? 'Activate' : 'Update Status',
      newStatus !== 'active'
    );
  };

  const handleOpenResetModal = (user: any) => {
    setResetModalUser(user);
    setCustomPassword('');
    setResetReason('Super Administrator password reset');
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
      await fetchUsersData();
      showSuccess(
        'Access Reset Successful',
        `New temporary password is: "${res.data.temporaryPassword}". An email notification with the login credentials has been sent to ${resetModalUser.email}.`
      );
    } catch (err: any) {
      showError('Reset Failed', err.message || 'Failed to reset access credentials.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenEditModal = (user: any) => {
    setEditModalUser(user);
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      role: user.role || 'sales_staff',
      status: user.status || 'active',
    });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    setIsEditing(true);
    try {
      await api.patch(`/users/${editModalUser.id}`, editForm);
      setEditModalUser(null);
      await fetchUsersData();
      showSuccess('User Updated', `User details for "${editForm.name}" have been updated.`);
    } catch (err: any) {
      showError('Update Failed', err.message || 'Failed to update user details.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteUser = (user: any) => {
    showConfirm(
      'Delete User Account',
      `Are you sure you want to permanently delete user "${user.name}" (${user.email})?`,
      async () => {
        try {
          await api.delete(`/users/${user.id}`);
          await fetchUsersData();
          showSuccess('User Deleted', `User ${user.name} has been deleted.`);
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete user.');
        }
      },
      'Delete User',
      true
    );
  };

  // Filter shop groups by selectedShopFilter
  const filteredShopGroups = shopGroups.filter(g => {
    if (selectedShopFilter !== 'all' && g.shop.id !== selectedShopFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const shopMatches = g.shop.name.toLowerCase().includes(q) || g.shop.category?.toLowerCase().includes(q);
      const ownerMatches = g.owner?.name?.toLowerCase().includes(q) || g.owner?.email?.toLowerCase().includes(q);
      const workerMatches = g.workers.some(w => w.name?.toLowerCase().includes(q) || w.email?.toLowerCase().includes(q));
      return shopMatches || ownerMatches || workerMatches;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User & Staff Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Shop-wise organization of tenant stores, primary shop owners, and operational workers (BR-01, BR-09)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('shop_wise')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'shop_wise'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shop-Wise View
            </button>
            <button
              onClick={() => setViewMode('all_users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'all_users'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flat Table View
            </button>
          </div>

          <button
            onClick={fetchUsersData}
            title="Refresh user records"
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user name, email, shop..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsersData()}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Shop Selector Filter */}
          <div className="flex items-center gap-1.5">
            <Store className="h-4 w-4 text-slate-400" />
            <select
              value={selectedShopFilter}
              onChange={e => setSelectedShopFilter(e.target.value)}
              className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs"
            >
              <option value="all">All Shops</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs"
          >
            <option value="all">All Roles</option>
            <option value="shop_owner">Shop Owners</option>
            <option value="manager">Managers</option>
            <option value="sales_staff">Sales Staff</option>
            <option value="inventory_staff">Inventory Staff</option>
            <option value="purchasing_staff">Purchasing Staff</option>
            <option value="worker">Workers</option>
            <option value="super_admin">Super Admins</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: SHOP-WISE DISPLAY */}
      {viewMode === 'shop_wise' && (
        <div className="space-y-6">
          {/* Platform Super Administrators Section */}
          {superAdmins.length > 0 && selectedShopFilter === 'all' && (
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Platform Super Administrators</h3>
                    <p className="text-[11px] text-slate-400">Root level management accounts with full system governance</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                  {superAdmins.length} Super Admin{superAdmins.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {superAdmins.map(admin => (
                  <div key={admin.id} className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/70 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-bold text-xs text-white truncate">{admin.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{admin.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      Active Root
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shop-Wise Cards */}
          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200/80 font-medium">
              Loading shops and user accounts...
            </div>
          ) : filteredShopGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200/80 font-medium">
              No shops or users found matching the selected filter criteria.
            </div>
          ) : (
            filteredShopGroups.map(({ shop, owner, workers }) => {
              const isCollapsed = collapsedShops[shop.id];
              return (
                <div
                  key={shop.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden transition-all duration-200"
                >
                  {/* Shop Header Banner */}
                  <div
                    onClick={() => toggleShopCollapse(shop.id)}
                    className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200/80 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-200">
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-slate-900 text-base tracking-tight">{shop.name}</h2>
                          <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-200">
                            {shop.category || 'Retail Store'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              shop.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                : shop.status === 'restricted'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                                : 'bg-rose-50 text-rose-700 border-rose-200/70'
                            }`}
                          >
                            <span className="capitalize">{shop.status}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tier: <span className="font-semibold text-slate-700">{shop.packageName || 'Standard Plan'}</span> | Contact: {shop.contactNumber || shop.email} | Address: {shop.address || 'Main Branch'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-3 py-1 bg-white border border-slate-200/80 rounded-xl text-slate-700 shadow-2xs">
                        {(owner ? 1 : 0) + workers.length} Total Users
                      </span>
                      <button className="text-slate-400 hover:text-slate-600">
                        {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {!isCollapsed && (
                    <div className="p-6 space-y-6">
                      {/* SECTION 1: Shop Owner Card */}
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-indigo-600" /> Primary Shop Owner Account
                        </h4>

                        {owner ? (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                {owner.name?.charAt(0) || 'O'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900 text-sm">{owner.name}</p>
                                  <span className="px-2 py-0.5 bg-indigo-200/70 text-indigo-900 rounded-md text-[10px] font-bold">
                                    SHOP OWNER
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                      owner.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {owner.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {owner.email}
                                  </span>
                                  {owner.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {owner.phone}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-400">Created: {formatDate(owner.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Owner Action Buttons */}
                            <div className="flex items-center gap-2 self-end md:self-auto">
                              <button
                                onClick={() => handleOpenResetModal(owner)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-amber-600" /> Reset Access
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(owner)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                              >
                                Edit Details
                              </button>
                              {owner.status === 'active' ? (
                                <button
                                  onClick={() => handleStatusChange(owner, 'suspended')}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(owner, 'active')}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                            No primary owner account registered for this shop.
                          </div>
                        )}
                      </div>

                      {/* SECTION 2: Shop Workers & Staff Members */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-indigo-600" /> Shop Workers & Operational Staff ({workers.length})
                          </h4>
                        </div>

                        {workers.length === 0 ? (
                          <div className="p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                            No staff or workers currently added to this shop.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                            <table className="w-full text-left text-xs text-slate-600">
                              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                                <tr>
                                  <th className="py-2.5 px-4">Staff Member</th>
                                  <th className="py-2.5 px-4">Email</th>
                                  <th className="py-2.5 px-4">Role</th>
                                  <th className="py-2.5 px-4">Assigned Branches</th>
                                  <th className="py-2.5 px-4">Status</th>
                                  <th className="py-2.5 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {workers.map(worker => (
                                  <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                      <p className="font-bold text-slate-900">{worker.name}</p>
                                      {worker.phone && <p className="text-[10px] text-slate-400">{worker.phone}</p>}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{worker.email}</td>
                                    <td className="py-3 px-4">
                                      <span className="capitalize px-2.5 py-0.5 bg-slate-100 rounded-full text-slate-700 text-[10px] font-semibold border border-slate-200/60">
                                        {worker.role.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      {worker.branchNames && worker.branchNames.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {worker.branchNames.map((bn: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-slate-50 rounded-md text-[10px] border border-slate-200 text-slate-600">
                                              {bn}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">All Branches</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          worker.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                        }`}
                                      >
                                        {worker.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => handleOpenResetModal(worker)}
                                          title="Reset Credentials"
                                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200/80 transition-colors"
                                        >
                                          <KeyRound className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleOpenEditModal(worker)}
                                          title="Edit Staff User"
                                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200/80 transition-colors"
                                        >
                                          <UserCheck className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteUser(worker)}
                                          title="Delete Worker Account"
                                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200/80 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: FLAT TABLE OF ALL USERS */}
      {viewMode === 'all_users' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">User / Account</th>
                <th className="py-3.5 px-6">Associated Shop</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Created Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : allUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                allUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{u.shopName}</p>
                      {u.shopCategory && <p className="text-[10px] text-slate-400">{u.shopCategory}</p>}
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize px-2.5 py-1 bg-slate-100 rounded-full text-slate-700 font-semibold text-[11px] border border-slate-200/60">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            : 'bg-rose-50 text-rose-700 border-rose-200/70'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenResetModal(u)}
                          title="Reset Password & Access"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          title="Edit User"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </button>
                        {u.role !== 'super_admin' && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      )}

      {/* MODAL 1: RESET PASSWORD & ACCESS */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reset User Account Access</h3>
                <p className="text-xs text-slate-500">Generate credentials and email user</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1 border border-slate-200/80">
              <p><span className="font-semibold text-slate-900">User:</span> {resetModalUser.name}</p>
              <p><span className="font-semibold text-slate-900">Email:</span> {resetModalUser.email}</p>
              <p><span className="font-semibold text-slate-900">Role:</span> {resetModalUser.role?.replace('_', ' ')}</p>
            </div>

            <form onSubmit={handleExecuteResetAccess} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Temporary Password (leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TempSecure@2026"
                  value={customPassword}
                  onChange={e => setCustomPassword(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Reset
                </label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                Notice: Submitting will update the password, unlock/reactivate the account if it was disabled, and automatically dispatch an email with the login credentials to <b>{resetModalUser.email}</b>.
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

      {/* MODAL 2: EDIT USER DETAILS */}
      {editModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-900 text-base">Edit User Account</h3>

            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {editModalUser.role !== 'super_admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="shop_owner">Shop Owner</option>
                    <option value="manager">Manager</option>
                    <option value="sales_staff">Sales Staff</option>
                    <option value="inventory_staff">Inventory Staff</option>
                    <option value="purchasing_staff">Purchasing Staff</option>
                    <option value="worker">Worker</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
