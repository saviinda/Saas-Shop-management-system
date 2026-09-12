'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Role, RolePermission, PermissionAction } from '@saas/types';
import { useModal } from '@/lib/modal-context';
import { formatDate } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  Layers,
  Lock,
  Eye,
  PlusCircle,
  Pencil,
  XCircle,
  AlertCircle,
  Copy,
  Sparkles,
} from 'lucide-react';

interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  actions: PermissionAction[];
}

const AVAILABLE_MODULES: ModuleConfig[] = [
  // Platform & Governance
  { id: 'dashboard', name: 'Dashboard Telemetry', description: 'Platform analytics and real-time live performance', category: 'Platform Governance', actions: ['view'] },
  { id: 'shops', name: 'Shops & Multi-Tenants', description: 'Tenant store registration, approval, and quota adjustments', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'roles', name: 'Roles & Permissions', description: 'Custom role definitions and granular access control matrix', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'users', name: 'User Directory', description: 'Super admins, shop owners, and operational staff management', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'packages', name: 'Subscription Packages', description: 'Tier limits, feature toggles, and pricing configurations', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'change_requests', name: 'Account Change Requests', description: 'Sensitive tenant parameter modifications review', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'audit_logs', name: 'System Security Audit Logs', description: 'Immutable record of security and administrative actions', category: 'Platform Governance', actions: ['view', 'create', 'edit', 'delete'] },

  // Commerce & Finance
  { id: 'subscriptions', name: 'Tenant Subscriptions', description: 'Shop tier lifecycles, upgrades, and expirations', category: 'Commerce & Billing', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'payments', name: 'Payment Transactions', description: 'Bank transfer slip reviews, reconciliations, and invoicing', category: 'Commerce & Billing', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reports', name: 'Reports & Business Intelligence', description: 'Intake charts, sales breakdowns, and growth analytics', category: 'Commerce & Billing', actions: ['view', 'create', 'edit', 'delete'] },

  // Tenant Operations
  { id: 'branches', name: 'Store Branches & Outlets', description: 'Branch locations, manager assignments, and operational hours', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'products', name: 'Products & Inventory Items', description: 'Catalog items, SKU numbers, barcode data, and retail pricing', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'services', name: 'Services Management', description: 'Service catalog, duration blocks, and labor charge rates', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'customers', name: 'Customer Directory', description: 'Client CRM records, purchase histories, and credit status', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'orders', name: 'Sales Orders & POS Terminal', description: 'Point of sale billing, receipt generation, and refunds', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'inventory', name: 'Stock & Stock Movements', description: 'Inventory stock levels, reconciliations, and transfers', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'procurement', name: 'Procurement (PO & GRN)', description: 'Purchase orders, supplier shipments, and goods receipts', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'tasks', name: 'Staff Task Assignments', description: 'Operational duty assignments and employee checklist items', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'communication', name: 'Tenant Support Messaging', description: 'Support chat tickets and cross-system notifications', category: 'Store Operations', actions: ['view', 'create', 'edit', 'delete'] },
];

export default function RolesManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [roles, setRoles] = useState<(Role & { userCount?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissionState, setPermissionState] = useState<Record<string, Set<PermissionAction>>>({});
  const [permissionFilter, setPermissionFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // View Matrix Modal State
  const [inspectRole, setInspectRole] = useState<(Role & { userCount?: number }) | null>(null);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<any[]>('/roles');
      setRoles(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch roles:', err);
      showError('Error Loading Roles', err.message || 'Could not fetch system roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openCreateModal = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRoleDescription('');
    setPermissionFilter('');

    // Default permissions: View on Dashboard and basic modules
    const initial: Record<string, Set<PermissionAction>> = {};
    AVAILABLE_MODULES.forEach(m => {
      initial[m.id] = new Set<PermissionAction>();
    });
    initial['dashboard'] = new Set<PermissionAction>(['view']);
    setPermissionState(initial);
    setIsModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setPermissionFilter('');

    const currentPerms: Record<string, Set<PermissionAction>> = {};
    AVAILABLE_MODULES.forEach(m => {
      currentPerms[m.id] = new Set<PermissionAction>();
    });

    if (Array.isArray(role.permissions)) {
      role.permissions.forEach(p => {
        if (currentPerms[p.module]) {
          p.actions.forEach(a => currentPerms[p.module].add(a));
        }
      });
    }

    setPermissionState(currentPerms);
    setIsModalOpen(true);
  };

  const togglePermission = (moduleId: string, action: PermissionAction) => {
    setPermissionState(prev => {
      const next = { ...prev };
      const actions = new Set(next[moduleId] || []);
      if (actions.has(action)) {
        actions.delete(action);
      } else {
        actions.add(action);
      }
      next[moduleId] = actions;
      return next;
    });
  };

  const toggleAllModuleActions = (module: ModuleConfig) => {
    setPermissionState(prev => {
      const next = { ...prev };
      const current = next[module.id] || new Set();
      const allSelected = module.actions.every(a => current.has(a));

      if (allSelected) {
        next[module.id] = new Set();
      } else {
        next[module.id] = new Set(module.actions);
      }
      return next;
    });
  };

  const applyPreset = (preset: 'all' | 'read_only' | 'clear') => {
    setPermissionState(prev => {
      const next: Record<string, Set<PermissionAction>> = {};
      AVAILABLE_MODULES.forEach(m => {
        if (preset === 'all') {
          next[m.id] = new Set<PermissionAction>(m.actions);
        } else if (preset === 'read_only') {
          next[m.id] = new Set<PermissionAction>(['view']);
        } else {
          next[m.id] = new Set<PermissionAction>();
        }
      });
      return next;
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      showError('Validation Error', 'Please provide a role name.');
      return;
    }

    // Convert permissionState back to RolePermission[]
    const formattedPermissions: RolePermission[] = [];
    Object.entries(permissionState).forEach(([module, actionsSet]) => {
      if (actionsSet.size > 0) {
        formattedPermissions.push({
          module,
          actions: Array.from(actionsSet),
        });
      }
    });

    setIsSaving(true);
    try {
      if (editingRoleId) {
        await api.patch(`/roles/${editingRoleId}`, {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: formattedPermissions,
        });
        showSuccess('Role Updated', `Role "${roleName}" has been successfully updated.`);
      } else {
        await api.post('/roles', {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: formattedPermissions,
        });
        showSuccess('Role Created', `New role "${roleName}" has been successfully created.`);
      }
      setIsModalOpen(false);
      await fetchRoles();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Could not save role permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = (role: Role & { userCount?: number }) => {
    if (role.isSystem) {
      showError('Protected Role', 'System default roles cannot be deleted to ensure platform stability.');
      return;
    }

    if (role.userCount && role.userCount > 0) {
      showError('Role in Use', `Cannot delete this role because it is currently assigned to ${role.userCount} active user(s). Please reassign them first.`);
      return;
    }

    showConfirm(
      'Delete Role',
      `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/roles/${role.id}`);
          showSuccess('Role Deleted', `The role "${role.name}" has been removed.`);
          await fetchRoles();
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete role.');
        }
      },
      'Delete Role',
      true
    );
  };

  const filteredRoles = roles.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.slug && r.slug.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  const filteredModules = AVAILABLE_MODULES.filter(m => {
    if (!permissionFilter.trim()) return true;
    const q = permissionFilter.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  // Calculate total assigned permissions count for a role
  const getPermissionCount = (role: Role) => {
    if (!Array.isArray(role.permissions)) return 0;
    return role.permissions.reduce((sum, p) => sum + (p.actions?.length || 0), 0);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Roles & Permissions Management</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              RBAC Matrix
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Define system and custom roles with granular feature-level actions (View, Create, Edit, Delete)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create New Role
          </button>
        </div>
      </div>

      {/* KPI Stats & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-400">Total Configured Roles</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{roles.length}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-400">System Built-In Roles</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {roles.filter(r => r.isSystem).length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Lock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-400">Custom Admin Roles</p>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">
              {roles.filter(r => !r.isSystem).length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter / Search Row */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search roles by name, slug, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors shadow-2xs"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredRoles.length} of {roles.length} roles
        </span>
      </div>

      {/* Roles Grid Cards */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
          <p className="text-xs font-medium">Loading system roles and permissions...</p>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Shield className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No roles match your search.</p>
          <p className="text-xs text-slate-400 mt-1">Try refining your keyword query or create a new role.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map(role => {
            const permCount = getPermissionCount(role);
            return (
              <div
                key={role.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 hover:shadow-md hover:border-indigo-200/80 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                        role.isSystem
                          ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                          : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                      }`}>
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight">{role.name}</h3>
                        <p className="font-mono text-[10px] text-slate-400">{role.slug || role.id}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      role.isSystem
                        ? 'bg-slate-50 text-slate-600 border-slate-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {role.isSystem ? 'System' : 'Custom'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium line-clamp-2 min-h-[32px] mb-4">
                    {role.description || 'No specific description provided for this role.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{role.userCount || 0} Users Assigned</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium justify-end">
                      <Layers className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="font-bold text-slate-800">{permCount} Permissions</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setInspectRole(role)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Inspect Matrix
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(role)}
                      title="Edit role and permissions"
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 shadow-2xs transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {!role.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role)}
                        title="Delete role"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ROLE MODAL WITH FULL PERMISSIONS MATRIX */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingRoleId ? 'Edit Role & Permissions' : 'Create New System Role'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure role identifier and assign granular action sub-permissions across modules
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Regional Store Auditor"
                    value={roleName}
                    onChange={e => setRoleName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Can view shop telemetry and audit trails but cannot modify orders"
                    value={roleDescription}
                    onChange={e => setRoleDescription(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Permissions Header & Presets */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Feature & Action Permissions Matrix</h3>
                    <p className="text-[11px] text-slate-500">
                      Select specific capabilities (View, Create, Edit/Update, Delete) allowed for this role
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('read_only')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                    >
                      Read-Only (View)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('clear')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search / Filter Modules within Matrix */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter permissions by module name..."
                    value={permissionFilter}
                    onChange={e => setPermissionFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                {/* Modules Permissions Matrix Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200 shadow-2xs">
                        <tr>
                          <th className="py-3 px-4 bg-slate-100">Module / Feature</th>
                          <th className="py-3 px-3 text-center bg-slate-100 w-24">View</th>
                          <th className="py-3 px-3 text-center bg-slate-100 w-24">Create</th>
                          <th className="py-3 px-3 text-center bg-slate-100 w-24">Edit / Update</th>
                          <th className="py-3 px-3 text-center bg-slate-100 w-24">Delete</th>
                          <th className="py-3 px-4 text-center bg-slate-100 w-24">Toggle All</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredModules.map(module => {
                          const activeSet = permissionState[module.id] || new Set();
                          const allSelected = module.actions.every(a => activeSet.has(a));

                          return (
                            <tr key={module.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <p className="font-bold text-slate-900">{module.name}</p>
                                <p className="text-[10px] text-slate-400">{module.description}</p>
                              </td>

                              {/* View Action */}
                              <td className="py-3 px-3 text-center">
                                {module.actions.includes('view') ? (
                                  <input
                                    type="checkbox"
                                    checked={activeSet.has('view')}
                                    onChange={() => togglePermission(module.id, 'view')}
                                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>

                              {/* Create Action */}
                              <td className="py-3 px-3 text-center">
                                {module.actions.includes('create') ? (
                                  <input
                                    type="checkbox"
                                    checked={activeSet.has('create')}
                                    onChange={() => togglePermission(module.id, 'create')}
                                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>

                              {/* Edit Action */}
                              <td className="py-3 px-3 text-center">
                                {module.actions.includes('edit') ? (
                                  <input
                                    type="checkbox"
                                    checked={activeSet.has('edit')}
                                    onChange={() => togglePermission(module.id, 'edit')}
                                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>

                              {/* Delete Action */}
                              <td className="py-3 px-3 text-center">
                                {module.actions.includes('delete') ? (
                                  <input
                                    type="checkbox"
                                    checked={activeSet.has('delete')}
                                    onChange={() => togglePermission(module.id, 'delete')}
                                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>

                              {/* Toggle All Module Actions */}
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleAllModuleActions(module)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                    allSelected
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {allSelected ? 'All On' : 'Select'}
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
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSaving && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  {editingRoleId ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT PERMISSIONS MATRIX DRAWER / MODAL */}
      {inspectRole && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{inspectRole.name} Permissions</h3>
                  <p className="text-xs text-slate-500 font-mono">{inspectRole.slug || inspectRole.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRole(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {inspectRole.description || 'No description provided for this role.'}
            </p>

            {/* Matrix Display */}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 bg-slate-100">Module</th>
                    <th className="py-2.5 px-4 bg-slate-100">Granted Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {AVAILABLE_MODULES.map(module => {
                    const rolePerm = inspectRole.permissions?.find(p => p.module === module.id);
                    const actions = rolePerm?.actions || [];

                    return (
                      <tr key={module.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900">{module.name}</span>
                          <span className="text-[10px] text-slate-400 block">{module.category}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          {actions.length === 0 ? (
                            <span className="text-slate-300 text-xs italic">No access</span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {actions.map(action => (
                                <span
                                  key={action}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                    action === 'view'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : action === 'create'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : action === 'edit'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {action}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Last updated: {formatDate(inspectRole.updatedAt || inspectRole.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => setInspectRole(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
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
