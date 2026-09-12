'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { User, Shop, Role, PermissionAction } from '@saas/types';
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
  Eye,
  ShieldCheck,
  Plus,
  X,
  Lock,
  Check,
} from 'lucide-react';

interface ShopGroup {
  shop: Shop;
  owner: any;
  workers: any[];
}

const ALL_SYSTEM_MODULES = [
  'dashboard',
  'shops',
  'subscriptions',
  'packages',
  'users',
  'roles',
  'audit_logs',
  'inventory',
  'pos_sales',
  'repair_tickets',
  'accounting',
  'customer_crm',
  'branch_management',
  'communication',
  'analytics_reports',
  'system_settings',
  'security_mfa',
  'data_export',
  'notifications',
];

export default function UsersManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [shopGroups, setShopGroups] = useState<ShopGroup[]>([]);
  const [superAdmins, setSuperAdmins] = useState<any[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
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
  const [editForm, setEditForm] = useState<{
    name: string;
    phone: string;
    roles: string[];
    status: string;
  }>({ name: '', phone: '', roles: [], status: 'active' });
  const [isEditing, setIsEditing] = useState(false);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    password: string;
    phone: string;
    status: 'active' | 'inactive' | 'suspended';
    shopId: string;
    roles: string[];
  }>({
    name: '',
    email: '',
    password: '',
    phone: '',
    status: 'active',
    shopId: '',
    roles: ['sales_staff'],
  });
  const [isCreating, setIsCreating] = useState(false);

  // Inspect Permissions Modal
  const [inspectPermissionsUser, setInspectPermissionsUser] = useState<any | null>(null);

  const fetchUsersData = async () => {
    try {
      setIsLoading(true);
      const [groupedRes, shopsRes, rolesRes] = await Promise.all([
        api.get<any>('/users', { groupBy: 'shop', search, role: roleFilter, status: statusFilter }),
        api.get<Shop[]>('/shops'),
        api.get<Role[]>('/roles').catch(() => ({ data: [] })),
      ]);

      const data = groupedRes.data;
      if (data && typeof data === 'object') {
        const groups = data.shopGroups || data.grouped || [];
        const admins = data.superAdmins || [];
        const unassigned = data.unassignedUsers || [];
        const list = data.allUsers || data.all || (Array.isArray(data) ? data : []);
        setShopGroups(groups);
        setSuperAdmins(admins);
        setUnassignedUsers(unassigned);
        setAllUsers(list);
      } else if (Array.isArray(data)) {
        setAllUsers(data);
      } else {
        setAllUsers([]);
      }
      setShops(shopsRes.data || []);
      setAvailableRoles(rolesRes.data || []);
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

  const getUserRolesList = (user: any): string[] => {
    if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
    if (user.role) return [user.role];
    return ['worker'];
  };

  const getRoleDisplayName = (roleKey: string): string => {
    const found = availableRoles.find(r => r.id === roleKey);
    if (found) return found.name;
    return roleKey
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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
      roles: getUserRolesList(user),
      status: user.status || 'active',
    });
  };

  const toggleEditFormRole = (roleId: string) => {
    setEditForm(prev => {
      const exists = prev.roles.includes(roleId);
      if (exists) {
        if (prev.roles.length === 1) return prev; // Keep at least one
        return { ...prev, roles: prev.roles.filter(r => r !== roleId) };
      }
      return { ...prev, roles: [...prev.roles, roleId] };
    });
  };

  const toggleCreateFormRole = (roleId: string) => {
    setCreateForm(prev => {
      const exists = prev.roles.includes(roleId);
      if (exists) {
        if (prev.roles.length === 1) return prev; // Keep at least one
        return { ...prev, roles: prev.roles.filter(r => r !== roleId) };
      }
      return { ...prev, roles: [...prev.roles, roleId] };
    });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    if (editForm.roles.length === 0) {
      showError('Role Required', 'User must be assigned at least one role.');
      return;
    }
    setIsEditing(true);
    try {
      await api.patch(`/users/${editModalUser.id}`, {
        name: editForm.name,
        phone: editForm.phone,
        status: editForm.status,
        roles: editForm.roles,
        role: editForm.roles[0],
      });
      setEditModalUser(null);
      await fetchUsersData();
      showSuccess('User Updated', `Account details and assigned roles for "${editForm.name}" updated successfully.`);
    } catch (err: any) {
      showError('Update Failed', err.message || 'Failed to update user details.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.roles.length === 0) {
      showError('Role Required', 'Please select at least one role for this new user.');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/users', {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        phone: createForm.phone || undefined,
        status: createForm.status,
        shopId: createForm.shopId || undefined,
        roles: createForm.roles,
        role: createForm.roles[0],
      });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        status: 'active',
        shopId: '',
        roles: ['sales_staff'],
      });
      await fetchUsersData();
      showSuccess('User Account Created', `User "${createForm.name}" created and assigned ${createForm.roles.length} role(s).`);
    } catch (err: any) {
      showError('User Creation Failed', err.message || 'Could not create new user account.');
    } finally {
      setIsCreating(false);
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
      const shopMatches = g.shop.name?.toLowerCase().includes(q) || g.shop.category?.toLowerCase().includes(q);
      const ownerMatches = g.owner?.name?.toLowerCase().includes(q) || g.owner?.email?.toLowerCase().includes(q);
      const workerMatches = g.workers.some(w => w.name?.toLowerCase().includes(q) || w.email?.toLowerCase().includes(q));
      return shopMatches || ownerMatches || workerMatches;
    }
    return true;
  });

  // Calculate aggregated permissions for inspect modal
  const getAggregatedPermissions = (user: any): { isSuperAdmin: boolean; matrix: Record<string, Set<PermissionAction>> } => {
    if (!user) return { isSuperAdmin: false, matrix: {} };
    const rolesList = getUserRolesList(user);
    const isSuperAdmin = rolesList.includes('super_admin') || user.role === 'super_admin';

    const matrix: Record<string, Set<PermissionAction>> = {};

    if (isSuperAdmin) {
      ALL_SYSTEM_MODULES.forEach(mod => {
        matrix[mod] = new Set<PermissionAction>(['view', 'create', 'edit', 'delete']);
      });
      return { isSuperAdmin: true, matrix };
    }

    rolesList.forEach(roleKey => {
      const roleObj = availableRoles.find(r => r.id === roleKey);
      if (roleObj && Array.isArray(roleObj.permissions)) {
        roleObj.permissions.forEach(p => {
          if (!matrix[p.module]) {
            matrix[p.module] = new Set<PermissionAction>();
          }
          p.actions.forEach(act => matrix[p.module].add(act));
        });
      }
    });

    return { isSuperAdmin: false, matrix };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Users & Access Management</h1>
            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-[11px] font-semibold">
              RBAC Enabled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage tenant shop owners, operational workers, assign granular roles, and inspect active permission matrices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Link to Roles Management */}
          <Link
            href="/super-admin/roles"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Manage Roles</span>
          </Link>

          {/* Create User Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create User</span>
          </button>

          {/* View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('shop_wise')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'shop_wise'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shop-Wise
            </button>
            <button
              onClick={() => setViewMode('all_users')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'all_users'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flat Table
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
          {/* Shop Filter */}
          {viewMode === 'shop_wise' && (
            <select
              value={selectedShopFilter}
              onChange={e => setSelectedShopFilter(e.target.value)}
              className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs max-w-[200px]"
            >
              <option value="all">All Shops ({shops.length})</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-xs"
          >
            <option value="all">All Roles</option>
            {availableRoles.length > 0 ? (
              availableRoles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))
            ) : (
              <>
                <option value="shop_owner">Shop Owners</option>
                <option value="manager">Managers</option>
                <option value="sales_staff">Sales Staff</option>
                <option value="inventory_staff">Inventory Staff</option>
                <option value="worker">Workers</option>
                <option value="super_admin">Super Admins</option>
              </>
            )}
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
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-xs text-white truncate">{admin.name}</p>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          ROOT
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{admin.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setInspectPermissionsUser(admin)}
                        title="View Full Permissions Matrix"
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-indigo-300 rounded-lg border border-slate-600 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Platform Staff & Unassigned Users Section */}
          {unassignedUsers.length > 0 && selectedShopFilter === 'all' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/20 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Platform Staff & Global / Unassigned Users</h3>
                    <p className="text-[11px] text-slate-500">Cross-tenant personnel, auditors, and staff not tied to a single shop location</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-white border border-slate-200/80 rounded-xl text-slate-700 shadow-2xs">
                  {unassignedUsers.length} User{unassignedUsers.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Email / Phone</th>
                      <th className="py-2.5 px-4">Assigned Roles</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {unassignedUsers
                      .filter(u => {
                        if (!search) return true;
                        const q = search.toLowerCase();
                        return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || (u.phone && u.phone.toLowerCase().includes(q));
                      })
                      .map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">{user.name}</p>
                            <span className="text-[10px] text-indigo-600 font-medium">Platform Global</span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-mono text-[11px] text-slate-600">{user.email}</p>
                            {user.phone && <p className="text-[10px] text-slate-400">{user.phone}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {getUserRolesList(user).map(r => (
                                <span
                                  key={r}
                                  className="capitalize px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-200/60"
                                >
                                  {getRoleDisplayName(r)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                user.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                              }`}
                            >
                              {user.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectPermissionsUser(user)}
                                title="View Assigned Roles & Permissions Matrix"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200/80 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenResetModal(user)}
                                title="Reset Credentials"
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200/80 transition-colors"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(user)}
                                title="Edit User & Roles"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200/80 transition-colors"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete User Account"
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-slate-900 text-sm">{owner.name}</p>
                                  {getUserRolesList(owner).map(r => (
                                    <span key={r} className="px-2 py-0.5 bg-indigo-200/70 text-indigo-900 rounded-md text-[10px] font-bold uppercase">
                                      {getRoleDisplayName(r)}
                                    </span>
                                  ))}
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
                            <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                              <button
                                onClick={() => setInspectPermissionsUser(owner)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-600" /> View Permissions
                              </button>
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
                                  <th className="py-2.5 px-4">Assigned Roles</th>
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
                                      <div className="flex flex-wrap gap-1">
                                        {getUserRolesList(worker).map(r => (
                                          <span
                                            key={r}
                                            className="capitalize px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-200/60"
                                          >
                                            {getRoleDisplayName(r)}
                                          </span>
                                        ))}
                                      </div>
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
                                          onClick={() => setInspectPermissionsUser(worker)}
                                          title="View Assigned Roles & Permissions Matrix"
                                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200/80 transition-colors"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleOpenResetModal(worker)}
                                          title="Reset Credentials"
                                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200/80 transition-colors"
                                        >
                                          <KeyRound className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleOpenEditModal(worker)}
                                          title="Edit Staff User & Roles"
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
                <th className="py-3.5 px-6">Assigned Roles</th>
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
                      <p className="font-bold text-slate-900">{u.shopName || 'Platform Root / Global'}</p>
                      {u.shopCategory && <p className="text-[10px] text-slate-400">{u.shopCategory}</p>}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {getUserRolesList(u).map(r => (
                          <span
                            key={r}
                            className="capitalize px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-200/60"
                          >
                            {getRoleDisplayName(r)}
                          </span>
                        ))}
                      </div>
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
                          onClick={() => setInspectPermissionsUser(u)}
                          title="View Permissions Matrix"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenResetModal(u)}
                          title="Reset Password & Access"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          title="Edit User & Roles"
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
                <p className="text-xs text-slate-500">Generate credentials and dispatch notification</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1 border border-slate-200/80">
              <p><span className="font-semibold text-slate-900">User:</span> {resetModalUser.name}</p>
              <p><span className="font-semibold text-slate-900">Email:</span> {resetModalUser.email}</p>
              <p>
                <span className="font-semibold text-slate-900">Roles:</span>{' '}
                {getUserRolesList(resetModalUser).map(r => getRoleDisplayName(r)).join(', ')}
              </p>
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
                Notice: Submitting will update the password, unlock/reactivate the account if disabled, and automatically dispatch an email with the login credentials to <b>{resetModalUser.email}</b>.
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

      {/* MODAL 2: EDIT USER DETAILS & ROLES */}
      {editModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Edit User Account & Assigned Roles</h3>
              <button
                onClick={() => setEditModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
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

              {/* Multi-Role Assignment Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Assigned Roles (Select one or more)
                  </label>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    {editForm.roles.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                  {availableRoles.length > 0 ? (
                    availableRoles.map(role => {
                      const isSelected = editForm.roles.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          onClick={() => toggleEditFormRole(role.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs leading-tight">{role.name}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{role.description}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    ['shop_owner', 'manager', 'sales_staff', 'inventory_staff', 'purchasing_staff', 'worker'].map(rk => {
                      const isSelected = editForm.roles.includes(rk);
                      return (
                        <div
                          key={rk}
                          onClick={() => toggleEditFormRole(rk)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2.5 ${
                            isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded flex items-center justify-center border ${isSelected ? 'bg-indigo-600 text-white' : 'border-slate-300'}`}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="capitalize font-medium">{rk.replace('_', ' ')}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
                  {isEditing ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE USER ACCOUNT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Create New User Account</h3>
                <p className="text-xs text-slate-500">Add a platform administrator, shop owner, or staff member</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Fernando"
                    value={createForm.name}
                    onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. user@shopdomain.com"
                    value={createForm.email}
                    onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+94 77 123 4567"
                    value={createForm.phone}
                    onChange={e => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Shop</label>
                  <select
                    value={createForm.shopId}
                    onChange={e => setCreateForm(prev => ({ ...prev, shopId: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">None (Platform Super Admin / Global)</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={createForm.status}
                    onChange={e => setCreateForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Multi-Role Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Assign Roles <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    {createForm.roles.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                  {availableRoles.length > 0 ? (
                    availableRoles.map(role => {
                      const isSelected = createForm.roles.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          onClick={() => toggleCreateFormRole(role.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs leading-tight">{role.name}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{role.description}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    ['shop_owner', 'manager', 'sales_staff', 'inventory_staff', 'purchasing_staff', 'worker'].map(rk => {
                      const isSelected = createForm.roles.includes(rk);
                      return (
                        <div
                          key={rk}
                          onClick={() => toggleCreateFormRole(rk)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2.5 ${
                            isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded flex items-center justify-center border ${isSelected ? 'bg-indigo-600 text-white' : 'border-slate-300'}`}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="capitalize font-medium">{rk.replace('_', ' ')}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isCreating ? 'Creating User...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW ROLES & PERMISSIONS MATRIX */}
      {inspectPermissionsUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {inspectPermissionsUser.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{inspectPermissionsUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{inspectPermissionsUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectPermissionsUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Assigned Roles Summary */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Assigned Roles & Tiers
              </p>
              <div className="flex flex-wrap gap-2">
                {getUserRolesList(inspectPermissionsUser).map(r => {
                  const roleObj = availableRoles.find(item => item.id === r);
                  return (
                    <div
                      key={r}
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl flex items-center gap-2 shadow-2xs"
                    >
                      <Shield className="h-3.5 w-3.5 text-indigo-600" />
                      <div>
                        <p className="font-bold text-xs text-indigo-900 leading-none">
                          {roleObj ? roleObj.name : getRoleDisplayName(r)}
                        </p>
                        {roleObj?.description && (
                          <p className="text-[10px] text-indigo-600 mt-0.5">{roleObj.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Effective Matrix */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Aggregated Effective Permissions Matrix
                </p>
                <span className="text-[11px] text-slate-500">
                  Calculated from all active assigned roles
                </span>
              </div>

              {(() => {
                const { isSuperAdmin, matrix } = getAggregatedPermissions(inspectPermissionsUser);
                const modules = Object.keys(matrix);

                return (
                  <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {isSuperAdmin && (
                      <div className="p-3 bg-amber-50/80 border-b border-amber-200 flex items-center gap-2.5 text-amber-800 text-xs font-semibold">
                        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Root Super Administrator: Unrestricted View, Create, Edit, and Delete access across all system features.</span>
                      </div>
                    )}

                    {modules.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No permissions currently granted by the assigned role(s).
                      </div>
                    ) : (
                      modules.map(mod => {
                        const actions = matrix[mod];
                        const allActions: PermissionAction[] = ['view', 'create', 'edit', 'delete'];
                        const formattedMod = mod
                          .split('_')
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ');

                        return (
                          <div
                            key={mod}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-slate-900">{formattedMod}</p>
                              <p className="text-[10px] text-slate-400 font-mono">module: {mod}</p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {allActions.map(act => {
                                const isAllowed = actions.has(act);
                                return (
                                  <span
                                    key={act}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                                      isAllowed
                                        ? act === 'delete'
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : act === 'edit'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : act === 'create'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-300 line-through'
                                    }`}
                                  >
                                    {act}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectPermissionsUser(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
