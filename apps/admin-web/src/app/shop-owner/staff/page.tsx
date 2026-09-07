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

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  shop_owner: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'communication'],
  manager: ['dashboard', 'branches', 'staff', 'products', 'services', 'customers', 'orders', 'inventory', 'procurement', 'tasks', 'communication'],
  sales_staff: ['dashboard', 'products', 'services', 'customers', 'orders', 'tasks'],
  inventory_staff: ['dashboard', 'products', 'inventory', 'procurement', 'tasks'],
  purchasing_staff: ['dashboard', 'inventory', 'procurement', 'tasks'],
  worker: ['dashboard', 'orders', 'tasks'],
};

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
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      branchIds: user.branchIds || [],
      permissions: user.permissions || DEFAULT_ROLE_PERMISSIONS[user.role] || [],
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

  const togglePermission = (permId: string) => {
    setFormData(prev => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(p => p !== permId)
          : [...prev.permissions, permId],
      };
    });
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
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to save staff member.');
      }
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees & Staff Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision staff, assign roles, configure module permissions, and view employee activity (BR-03, BR-09)
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all capitalize ${
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
                <th className="py-3.5 px-6">Module Permissions</th>
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
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-sm">{u.name}</p>
                            {u.role === 'shop_owner' && (
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
                                {b ? b.name : 'Main Branch'}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(u.permissions || []).slice(0, 3).map(p => (
                          <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono capitalize">
                            {p}
                          </span>
                        ))}
                        {(u.permissions || []).length > 3 && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">
                            +{(u.permissions || []).length - 3} more
                          </span>
                        )}
                      </div>
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
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Edit & Roles
                        </button>

                        {/* Reset Password / Access Button */}
                        <button
                          onClick={() => setResetModalUser(u)}
                          title="Reset Login Password"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>

                        {/* View Activity Logs */}
                        <button
                          onClick={() => handleViewActivity(u)}
                          title="View Employee Activity Logs"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>

                        {/* Activate / Deactivate Toggle (Only for staff, not owner) */}
                        {u.role !== 'shop_owner' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === 'active' ? 'Deactivate Staff' : 'Activate Staff'}
                            className={`p-1.5 rounded-lg border transition-colors ${
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
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
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
      </div>

      {/* ADD / EDIT STAFF MODAL WITH CONFIGURABLE PERMISSIONS */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {modalMode === 'create' ? 'Add New Employee / Staff Member' : `Edit Staff: ${selectedUser?.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">Configure operational role, assigned branches, and granular module permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs capitalize"
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
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
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

              {/* Granular Configurable Permissions Grid */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-indigo-600" /> Configurable Module Permissions
                  </span>
                  <span className="text-[10px] text-slate-500">Customize access beyond default role presets</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  {MODULE_PERMISSIONS.map(perm => {
                    const isChecked = formData.permissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-white border-indigo-500 text-slate-900 shadow-2xs ring-1 ring-indigo-500/20'
                            : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-semibold">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98]"
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
                className="p-1 text-slate-400 hover:text-slate-600"
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
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
                className="p-1 text-slate-400 hover:text-slate-600"
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
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
