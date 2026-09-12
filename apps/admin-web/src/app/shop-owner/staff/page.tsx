'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { User, Branch } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  UserCheck,
  Plus,
  Shield,
  Trash2,
  Power,
  Phone,
  Mail,
  UserPlus,
  KeyRound,
  History,
  CheckCircle2,
  XCircle,
  Building2,
  Lock,
  X,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  Eye,
  Edit3,
} from 'lucide-react';

const MODULE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard & Overview', category: 'General' },
  { id: 'orders', label: 'Order Processing & POS', category: 'Sales' },
  { id: 'products', label: 'Product Catalog', category: 'Inventory' },
  { id: 'services', label: 'Services Catalog', category: 'Sales' },
  { id: 'inventory', label: 'Inventory & Stock Adjustments', category: 'Inventory' },
  { id: 'procurement', label: 'Procurement (POs & GRNs)', category: 'Procurement' },
  { id: 'customers', label: 'Customer Directory', category: 'Sales' },
  { id: 'tasks', label: 'Employee Tasks', category: 'Operations' },
  { id: 'branches', label: 'Branch Access & Locations', category: 'Administration' },
  { id: 'staff', label: 'Staff Management', category: 'Administration' },
  { id: 'communication', label: 'Admin Support Tickets', category: 'General' },
];

const CRUD_ACTIONS = [
  { key: 'view', label: 'View', short: 'V', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { key: 'create', label: 'Create', short: 'C', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { key: 'edit', label: 'Edit', short: 'E', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { key: 'delete', label: 'Delete', short: 'D', color: 'rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
] as const;

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete'];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  shop_owner: MODULE_PERMISSIONS.flatMap(m => ALL_ACTIONS.map(a => `${m.id}:${a}`)),
  manager: MODULE_PERMISSIONS.flatMap(m => ALL_ACTIONS.map(a => `${m.id}:${a}`)),
  sales_staff: [
    'dashboard:view',
    'orders:view', 'orders:create', 'orders:edit',
    'products:view',
    'services:view',
    'customers:view', 'customers:create', 'customers:edit',
    'tasks:view', 'tasks:create', 'tasks:edit',
    'communication:view', 'communication:create',
  ],
  inventory_staff: [
    'dashboard:view',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'inventory:view', 'inventory:create', 'inventory:edit',
    'procurement:view', 'procurement:create', 'procurement:edit',
    'tasks:view', 'tasks:create', 'tasks:edit',
  ],
  purchasing_staff: [
    'dashboard:view',
    'procurement:view', 'procurement:create', 'procurement:edit', 'procurement:delete',
    'inventory:view',
    'products:view',
    'tasks:view', 'tasks:create',
    'communication:view', 'communication:create',
  ],
  worker: [
    'dashboard:view',
    'orders:view', 'orders:create',
    'tasks:view', 'tasks:create', 'tasks:edit',
  ],
};

// Normalize permissions (expand legacy strings e.g. 'products' to all 4 CRUD actions)
function normalizePermissions(perms?: string[]): string[] {
  if (!perms || !Array.isArray(perms)) return [];
  const normalized = new Set<string>();
  for (const p of perms) {
    if (p.includes(':')) {
      normalized.add(p);
    } else {
      // Legacy module ID without action -> expand to all 4
      ALL_ACTIONS.forEach(a => normalized.add(`${p}:${a}`));
    }
  }
  return Array.from(normalized);
}

function hasPermission(perms: string[], moduleId: string, action: string): boolean {
  return perms.includes(`${moduleId}:${action}`) || perms.includes(moduleId);
}

export default function StaffManagementPage() {
  const { activeBranch } = useBranch();
  const { showSuccess, showError, showConfirm } = useModal();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subInfo, setSubInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Role Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sales_staff' as any,
    phone: '',
    branchIds: [] as string[],
    permissions: [] as string[],
  });

  // Reset Access Modal State
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Employee Activity Logs Modal State
  const [activityModalUser, setActivityModalUser] = useState<User | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const [uRes, bRes, subRes] = await Promise.all([
        api.get<User[]>('/users'),
        api.get<Branch[]>('/branches').catch(() => ({ data: [] })),
        api.get<any>('/subscriptions/my').catch(() => ({ data: null })),
      ]);
      setUsers(uRes.data || []);
      setBranches(bRes.data || []);
      setSubInfo(subRes.data);
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const openAddModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'sales_staff',
      phone: '',
      branchIds: activeBranch ? [activeBranch.id] : branches.length > 0 ? [branches[0].id] : [],
      permissions: DEFAULT_ROLE_PERMISSIONS['sales_staff'] || [],
    });
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setSelectedUser(user);
    const initialPerms = normalizePermissions(user.permissions || DEFAULT_ROLE_PERMISSIONS[user.role] || []);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      branchIds: user.branchIds || [],
      permissions: initialPerms,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleRoleChange = (newRole: string) => {
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || prev.permissions,
    }));
  };

  // Granular Sub-Permission Toggles
  const toggleSubPermission = (moduleId: string, action: string) => {
    const key = `${moduleId}:${action}`;
    setFormData(prev => {
      const normalized = normalizePermissions(prev.permissions);
      const exists = normalized.includes(key);
      const next = exists ? normalized.filter(p => p !== key) : [...normalized, key];
      return { ...prev, permissions: next };
    });
  };

  const toggleModuleAll = (moduleId: string) => {
    setFormData(prev => {
      const normalized = normalizePermissions(prev.permissions);
      const moduleKeys = ALL_ACTIONS.map(a => `${moduleId}:${a}`);
      const allActive = moduleKeys.every(k => normalized.includes(k));

      let next: string[];
      if (allActive) {
        // Remove all for this module
        next = normalized.filter(p => !p.startsWith(`${moduleId}:`) && p !== moduleId);
      } else {
        // Add all 4 for this module
        const filtered = normalized.filter(p => !p.startsWith(`${moduleId}:`) && p !== moduleId);
        next = [...filtered, ...moduleKeys];
      }
      return { ...prev, permissions: next };
    });
  };

  const selectAllPermissions = () => {
    const all = MODULE_PERMISSIONS.flatMap(m => ALL_ACTIONS.map(a => `${m.id}:${a}`));
    setFormData(prev => ({ ...prev, permissions: all }));
  };

  const selectViewOnlyPermissions = () => {
    const viewOnly = MODULE_PERMISSIONS.map(m => `${m.id}:view`);
    setFormData(prev => ({ ...prev, permissions: viewOnly }));
  };

  const resetToRolePreset = () => {
    const preset = DEFAULT_ROLE_PERMISSIONS[formData.role] || [];
    setFormData(prev => ({ ...prev, permissions: preset }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }));
  };

  const toggleBranch = (branchId: string) => {
    setFormData(prev => {
      const exists = prev.branchIds.includes(branchId);
      return {
        ...prev,
        branchIds: exists
          ? prev.branchIds.filter(b => b !== branchId)
          : [...prev.branchIds, branchId],
      };
    });
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Full Name is required');
      return;
    }

    if (modalMode === 'create') {
      if (!formData.email.trim()) {
        setModalError('Email address is required');
        return;
      }
      if (formData.password.length < 6) {
        setModalError('Password must be at least 6 characters');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api.post('/users/staff', {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password.trim(),
          role: formData.role,
          phone: formData.phone.trim(),
          branchIds: formData.branchIds,
          permissions: formData.permissions,
        });
        showSuccess('Staff Member Added', `Employee "${formData.name}" has been provisioned.`);
      } else if (selectedUser) {
        await api.patch(`/users/${selectedUser.id}`, {
          name: formData.name.trim(),
          role: formData.role,
          phone: formData.phone.trim(),
          branchIds: formData.branchIds,
          permissions: formData.permissions,
        });
        showSuccess('Staff Member Updated', `Account details for "${formData.name}" have been updated.`);
      }

      setShowModal(false);
      await fetchStaff();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save staff member.';
      setModalError(errMsg);
      showError(
        err?.code === 'PACKAGE_LIMIT_EXCEEDED' || err?.code === 'LIMIT_EXCEEDED' ? 'Staff Limit Reached' : 'Action Failed',
        errMsg
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const actionLabel = newStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${actionLabel} Staff Member`,
      `Are you sure you want to ${actionLabel.toLowerCase()} access for "${user.name}"? ${
        newStatus === 'inactive' ? 'They will no longer be able to log in.' : 'They will regain portal access.'
      }`,
      async () => {
        try {
          await api.patch(`/users/${user.id}`, { status: newStatus });
          await fetchStaff();
          showSuccess('Status Updated', `Staff member is now ${newStatus}.`);
        } catch (err: any) {
          showError('Action Failed', err.message || 'Failed to update user status.');
        }
      },
      actionLabel,
      newStatus === 'inactive'
    );
  };

  const handleResetAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    setIsResetting(true);
    try {
      const res = await api.post<any>(`/users/${resetModalUser.id}/reset-access`, {
        newPassword: tempPassword.trim() || undefined,
        reason: resetReason.trim() || 'Store owner updated staff credentials',
      });
      setResetModalUser(null);
      setTempPassword('');
      setResetReason('');
      await fetchStaff();
      showSuccess(
        'Access Reset Successful',
        `New temporary password is: "${res.data?.temporaryPassword}". An email has been dispatched to ${resetModalUser.email}.`
      );
    } catch (err: any) {
      showError('Reset Failed', err.message || 'Failed to reset access credentials.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleViewActivity = async (user: User) => {
    setActivityModalUser(user);
    setIsLoadingLogs(true);
    try {
      const res = await api.get<any[]>(`/users/${user.id}/activity`);
      setActivityLogs(res.data || []);
    } catch (err: any) {
      showError('Failed to Load Logs', err.message || 'Could not load employee activity logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDeleteStaff = (user: User) => {
    showConfirm(
      'Delete Staff Account',
      `Are you sure you want to permanently delete employee account "${user.name}" (${user.email})? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/users/${user.id}`);
          await fetchStaff();
          showSuccess('Staff Deleted', 'Employee record removed successfully.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Failed to delete staff member.');
        }
      },
      'Delete Staff',
      true
    );
  };

  const userUsage = subInfo?.usage?.users || { current: users.length, limit: 10 };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  });

  // Helper to format permissions for table display
  const getPermissionSummary = (userPerms?: string[]) => {
    const normalized = normalizePermissions(userPerms);
    const groups: Array<{ module: typeof MODULE_PERMISSIONS[0]; actions: string[] }> = [];

    MODULE_PERMISSIONS.forEach(mod => {
      const activeActions = ALL_ACTIONS.filter(a => hasPermission(normalized, mod.id, a));
      if (activeActions.length > 0) {
        groups.push({ module: mod, actions: activeActions });
      }
    });

    return groups;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees & Staff Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision staff, assign roles, configure granular CRUD module permissions, and inspect employee activity (BR-03, BR-09)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Package Limit Badge */}
          <div className="px-3.5 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2">
            <span>Staff Quota:</span>
            <span className={`font-bold ${userUsage.current >= userUsage.limit ? 'text-amber-600' : 'text-indigo-600'}`}>
              {userUsage.current} / {userUsage.limit} Users
            </span>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'manager', 'sales_staff', 'inventory_staff', 'purchasing_staff', 'worker'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all capitalize cursor-pointer ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {r === 'all' ? 'All Roles' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-6">Assigned Role</th>
                <th className="py-3.5 px-6">Assigned Branches</th>
                <th className="py-3.5 px-6">Configured CRUD Permissions</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Joined Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading staff records...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No employees found matching the filters.</td></tr>
              ) : (
                filteredUsers.map(u => {
                  const permSummary = getPermissionSummary(u.permissions);
                  const isOwner = u.role === 'shop_owner';
                  return (
                    <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 text-sm">{u.name}</p>
                              {isOwner && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-800 rounded">
                                  OWNER
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-400" /> {u.email}
                            </p>
                            {u.phone && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="h-2.5 w-2.5 text-slate-400" /> {u.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg capitalize border border-slate-200/80 text-[11px]">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(!u.branchIds || u.branchIds.length === 0) ? (
                            <span className="text-slate-400 text-[11px]">All Branches</span>
                          ) : (
                            u.branchIds.map(bid => {
                              const b = branches.find(br => br.id === bid);
                              return (
                                <span key={bid} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold border border-indigo-100">
                                  {b ? b.name : 'Branch'}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {isOwner ? (
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200">
                            Full Unrestricted Access
                          </span>
                        ) : permSummary.length === 0 ? (
                          <span className="text-slate-400 text-[11px]">No module access</span>
                        ) : (
                          <div className="flex flex-col gap-1 max-w-[280px]">
                            <div className="flex flex-wrap gap-1">
                              {permSummary.slice(0, 3).map(({ module, actions }) => (
                                <div
                                  key={module.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 text-[10px]"
                                  title={`${module.label}: ${actions.join(', ')}`}
                                >
                                  <span className="font-semibold text-slate-700">
                                    {module.label.split(' ')[0]}
                                  </span>
                                  <div className="flex items-center gap-0.5 font-mono text-[9px] font-bold">
                                    <span className={actions.includes('create') ? 'text-blue-600' : 'text-slate-300'}>C</span>
                                    <span className={actions.includes('view') ? 'text-emerald-600' : 'text-slate-300'}>V</span>
                                    <span className={actions.includes('edit') ? 'text-amber-600' : 'text-slate-300'}>E</span>
                                    <span className={actions.includes('delete') ? 'text-rose-600' : 'text-slate-300'}>D</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {permSummary.length > 3 && (
                              <span className="text-[10px] text-indigo-600 font-semibold">
                                +{permSummary.length - 3} more modules configured
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {u.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          <span className="capitalize">{u.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Edit & Permissions
                          </button>

                          {/* Reset Password / Access Button */}
                          <button
                            onClick={() => setResetModalUser(u)}
                            title="Reset Login Password"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          {/* View Activity Logs */}
                          <button
                            onClick={() => handleViewActivity(u)}
                            title="View Employee Activity Logs"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {/* Activate / Deactivate Toggle (Only for staff, not owner) */}
                          {u.role !== 'shop_owner' && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.status === 'active' ? 'Deactivate Staff' : 'Activate Staff'}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                u.status === 'active'
                                  ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                                  : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete Staff Member */}
                          {u.role !== 'shop_owner' && (
                            <button
                              onClick={() => handleDeleteStaff(u)}
                              title="Delete Staff Member"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT STAFF MODAL WITH GRANULAR CRUD PERMISSIONS MATRIX */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {modalMode === 'create' ? 'Add New Employee / Staff Member' : `Edit Staff: ${selectedUser?.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">Configure operational role, assigned branches, and granular CRUD sub-permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-5 text-xs">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 555 234 5678"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="e.g. alex@urbancafe.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full p-2.5 border border-slate-200 rounded-xl shadow-2xs ${
                      modalMode === 'edit' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500'
                    }`}
                  />
                </div>

                {modalMode === 'create' && (
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Operational Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => handleRoleChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs capitalize cursor-pointer"
                  >
                    <option value="manager">Manager (Full Branch Authority)</option>
                    <option value="sales_staff">Sales Staff (POS, Orders, Customers)</option>
                    <option value="inventory_staff">Inventory Staff (Stock, Products, GRN)</option>
                    <option value="purchasing_staff">Purchasing Staff (PO, Suppliers)</option>
                    <option value="worker">Worker (Tasks, POS Execution)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Assigned Branch Access</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {branches.map(b => {
                      const isChecked = formData.branchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* GRANULAR CRUD SUB-PERMISSIONS MATRIX */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div>
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-indigo-600" /> Configurable Module Permissions
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Configure granular CRUD access (Create, View, Edit, Delete) for each system module
                    </p>
                  </div>

                  {/* Preset Buttons Toolbar */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="h-3 w-3 text-indigo-600" /> Select All CRUD
                    </button>
                    <button
                      type="button"
                      onClick={selectViewOnlyPermissions}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-emerald-600" /> View Only
                    </button>
                    <button
                      type="button"
                      onClick={resetToRolePreset}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Reset to recommended preset for current role"
                    >
                      <RotateCcw className="h-3 w-3 text-slate-500" /> Preset
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="h-3 w-3 text-rose-500" /> Clear All
                    </button>
                  </div>
                </div>

                {/* Permissions Matrix Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 w-1/3">Module</th>
                          <th className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> View
                            </span>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                              <span className="h-2 w-2 rounded-full bg-blue-500"></span> Create
                            </span>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              <span className="h-2 w-2 rounded-full bg-amber-500"></span> Edit
                            </span>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                              <span className="h-2 w-2 rounded-full bg-rose-500"></span> Delete
                            </span>
                          </th>
                          <th className="py-2.5 px-3 text-right">Row Toggle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {MODULE_PERMISSIONS.map(mod => {
                          const isView = hasPermission(formData.permissions, mod.id, 'view');
                          const isCreate = hasPermission(formData.permissions, mod.id, 'create');
                          const isEdit = hasPermission(formData.permissions, mod.id, 'edit');
                          const isDelete = hasPermission(formData.permissions, mod.id, 'delete');
                          const allModuleChecked = isView && isCreate && isEdit && isDelete;

                          return (
                            <tr key={mod.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{mod.label}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                    {mod.category}
                                  </span>
                                </div>
                              </td>

                              {/* View Action */}
                              <td className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                  <input
                                    type="checkbox"
                                    checked={isView}
                                    onChange={() => toggleSubPermission(mod.id, 'view')}
                                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                                  />
                                </label>
                              </td>

                              {/* Create Action */}
                              <td className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                  <input
                                    type="checkbox"
                                    checked={isCreate}
                                    onChange={() => toggleSubPermission(mod.id, 'create')}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                  />
                                </label>
                              </td>

                              {/* Edit Action */}
                              <td className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                  <input
                                    type="checkbox"
                                    checked={isEdit}
                                    onChange={() => toggleSubPermission(mod.id, 'edit')}
                                    className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                                  />
                                </label>
                              </td>

                              {/* Delete Action */}
                              <td className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                  <input
                                    type="checkbox"
                                    checked={isDelete}
                                    onChange={() => toggleSubPermission(mod.id, 'delete')}
                                    className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                                  />
                                </label>
                              </td>

                              {/* Row Toggle All */}
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleModuleAll(mod.id)}
                                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                    allModuleChecked
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {allModuleChecked ? 'Clear' : 'All CRUD'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Provision Employee' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET ACCESS CREDENTIALS MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reset Access Credentials</h3>
                  <p className="text-xs text-slate-500">{resetModalUser.name} ({resetModalUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResetAccessSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Temporary Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate a secure random password"
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Credential Reset</label>
                <input
                  type="text"
                  placeholder="e.g. Employee forgot password or security rotation"
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900">
                The new login credentials will be updated in the system and automatically emailed to <b>{resetModalUser.email}</b>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isResetting ? 'Resetting...' : 'Reset & Email Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMPLOYEE ACTIVITY LOGS MODAL */}
      {activityModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Employee Activity Logs</h3>
                  <p className="text-xs text-slate-500">{activityModalUser.name} ({activityModalUser.role.replace('_', ' ')})</p>
                </div>
              </div>
              <button
                onClick={() => setActivityModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading activity logs...</div>
            ) : activityLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No recent recorded activity for this employee.</div>
            ) : (
              <div className="space-y-2 text-xs max-h-[400px] overflow-y-auto pr-1">
                {activityLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 font-mono text-[11px] bg-slate-200/80 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                      <p className="text-slate-600 mt-1 text-[11px]">
                        Target Entity: <b className="capitalize">{log.entity}</b> ({log.entityId})
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{formatDate(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivityModalUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
