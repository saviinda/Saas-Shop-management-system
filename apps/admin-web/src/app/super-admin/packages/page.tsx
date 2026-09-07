'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { SubscriptionPackage } from '@saas/types';
import { useModal } from '@/lib/modal-context';
import { Package, Plus, Edit2, Trash2, Check, ShieldCheck, Power, Sliders, X } from 'lucide-react';

const STANDARD_FEATURE_CATALOG: { id: string; label: string }[] = [
  { id: 'inventory_management', label: 'Inventory Management & Stock Alerts' },
  { id: 'advanced_inventory', label: 'Advanced Inventory & Batch Tracking' },
  { id: 'basic_inventory', label: 'Basic Inventory Management' },
  { id: 'order_processing', label: 'Order Processing & POS Entry' },
  { id: 'order_management', label: 'Order Management' },
  { id: 'procurement_grn', label: 'Procurement (PO & GRN Inward)' },
  { id: 'procurement_po_grn', label: 'Purchase Orders & GRN Receiving' },
  { id: 'multi_branch', label: 'Multi-Branch Segregation' },
  { id: 'single_branch', label: 'Single Branch Mode' },
  { id: 'employee_tasks', label: 'Staff Task Assignment & Tracking' },
  { id: 'task_management', label: 'Task Management' },
  { id: 'service_catalog', label: 'Services Catalog & Booking' },
  { id: 'advanced_analytics', label: 'Advanced Financial & Sales Reports' },
  { id: 'full_reports', label: 'Full Executive Reports & Analytics' },
  { id: 'direct_support', label: 'Direct Priority Support with Admin' },
  { id: 'priority_support', label: 'Priority Support Channel' },
  { id: 'standard_support', label: 'Standard Platform Support' },
  { id: 'dedicated_support', label: '24/7 Dedicated Account Support' },
  { id: 'multi_shop', label: 'Multi-Shop Management' },
  { id: 'custom_roles', label: 'Custom Staff Roles & Permissions' },
  { id: 'audit_export', label: 'Audit Logs & Compliance Export' },
];

export default function PackagesManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFeatureInput, setCustomFeatureInput] = useState('');

  const defaultFormData = {
    name: '',
    description: '',
    price: 99,
    durationDays: 30,
    limits: {
      shops: 1,
      branches: 2,
      users: 10,
      products: 250,
      services: 25,
      storageMb: 1000,
    },
    features: ['inventory_management', 'order_processing', 'direct_support'],
    status: 'active' as 'active' | 'inactive',
  };

  const [formData, setFormData] = useState(defaultFormData);

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<SubscriptionPackage[]>('/packages');
      setPackages(res.data);
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setCustomFeatureInput('');
    setModalError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (pkg: SubscriptionPackage) => {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price,
      durationDays: pkg.durationDays || 30,
      limits: {
        shops: pkg.limits?.shops || 1,
        branches: pkg.limits?.branches || 1,
        users: pkg.limits?.users || 5,
        products: pkg.limits?.products || 100,
        services: pkg.limits?.services || 10,
        storageMb: pkg.limits?.storageMb || 500,
      },
      features: Array.isArray(pkg.features) ? [...pkg.features] : [],
      status: pkg.status || 'active',
    });
    setCustomFeatureInput('');
    setModalError(null);
    setShowEditModal(true);
  };

  const openQuotaModal = (pkg: SubscriptionPackage) => {
    setSelectedPackage(pkg);
    setFormData({
      ...defaultFormData,
      name: pkg.name,
      price: pkg.price,
      description: pkg.description,
      limits: {
        shops: pkg.limits?.shops || 1,
        branches: pkg.limits?.branches || 1,
        users: pkg.limits?.users || 5,
        products: pkg.limits?.products || 100,
        services: pkg.limits?.services || 10,
        storageMb: pkg.limits?.storageMb || 500,
      },
      features: Array.isArray(pkg.features) ? [...pkg.features] : [],
      status: pkg.status || 'active',
    });
    setModalError(null);
    setShowQuotaModal(true);
  };

  const handleToggleFeature = (featureId: string) => {
    setFormData(prev => {
      const exists = prev.features.includes(featureId);
      return {
        ...prev,
        features: exists
          ? prev.features.filter(f => f !== featureId)
          : [...prev.features, featureId],
      };
    });
  };

  const handleAddCustomFeature = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customFeatureInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;

    if (!formData.features.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, trimmed],
      }));
    }
    setCustomFeatureInput('');
  };

  const handleRemoveFeature = (featureId: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== featureId),
    }));
  };

  // Build combined feature list for the modal
  const getAllDisplayFeatures = () => {
    const featureMap = new Map<string, string>();
    STANDARD_FEATURE_CATALOG.forEach(f => {
      featureMap.set(f.id, f.label);
    });

    formData.features.forEach(f => {
      if (!featureMap.has(f)) {
        featureMap.set(
          f,
          f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        );
      }
    });

    return Array.from(featureMap.entries()).map(([id, label]) => ({ id, label }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Package name is required');
      return;
    }
    if (formData.description.trim().length < 5) {
      setModalError('Description must be at least 5 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/packages', formData);
      setShowCreateModal(false);
      await fetchPackages();
      showSuccess('Package Created', `Subscription plan "${formData.name}" has been provisioned successfully.`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to create package. Please check inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    setModalError(null);

    setIsSubmitting(true);
    try {
      await api.patch(`/packages/${selectedPackage.id}`, formData);
      setShowEditModal(false);
      setShowQuotaModal(false);
      await fetchPackages();
      showSuccess('Package Updated', `Subscription plan "${formData.name}" has been updated successfully.`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to update package.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (pkg: SubscriptionPackage) => {
    const nextStatus = pkg.status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${actionLabel} Package`,
      `Are you sure you want to ${actionLabel.toLowerCase()} "${pkg.name}"? ${
        nextStatus === 'inactive'
          ? 'New shops will not be able to select this tier during registration or upgrades.'
          : 'This plan will become available for all shops.'
      }`,
      async () => {
        try {
          await api.patch(`/packages/${pkg.id}`, { status: nextStatus });
          await fetchPackages();
          showSuccess('Status Updated', `Package "${pkg.name}" is now ${nextStatus}.`);
        } catch (err) {
          showError('Update Failed', 'Unable to change package status.');
        }
      },
      actionLabel,
      nextStatus === 'inactive'
    );
  };

  const handleDeletePackage = (pkg: SubscriptionPackage) => {
    showConfirm(
      'Delete Subscription Package',
      `Are you sure you want to permanently delete the "${pkg.name}" tier? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/packages/${pkg.id}`);
          await fetchPackages();
          showSuccess('Package Deleted', `The package "${pkg.name}" was successfully removed.`);
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete package.');
        }
      },
      'Delete Package',
      true
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscription Packages & Plan Limits</h1>
          <p className="text-xs text-slate-500 mt-1">Configure tier pricing, resource quotas, included features, and tenant limitations (BR-02)</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create Package
        </button>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-3 text-center py-16 text-slate-400 text-xs">Loading subscription packages...</div>
        ) : packages.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 text-xs">No subscription packages found. Click "Create Package" to provision one.</div>
        ) : (
          packages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border transition-all duration-300 shadow-sm p-6 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 ${
                pkg.status === 'active'
                  ? 'border-slate-200/80 shadow-slate-200/50'
                  : 'border-slate-200/50 bg-slate-50/40 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-3 py-1 rounded-full">
                    {pkg.name}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      pkg.status === 'active'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
                        : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}
                  >
                    {pkg.status === 'active' ? 'Active Plan' : 'Inactive'}
                  </span>
                </div>

                <p className="text-3xl font-extrabold text-slate-900 mt-4 tracking-tight">
                  ${pkg.price}
                  <span className="text-sm text-slate-400 font-normal">/month</span>
                </p>
                <p className="text-xs text-slate-500 mt-2 min-h-[32px] font-medium leading-relaxed">
                  {pkg.description || 'Full-featured shop management tier'}
                </p>

                {/* Resource Quotas Box */}
                <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">Resource Quotas</p>
                    <button
                      onClick={() => openQuotaModal(pkg)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Sliders className="h-3 w-3" /> Adjust
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div className="p-2.5 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Branches</p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{pkg.limits?.branches || 1} Branch{pkg.limits?.branches > 1 ? 'es' : ''}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Staff Users</p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{pkg.limits?.users || 5} Max Users</p>
                    </div>
                    <div className="p-2.5 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Product SKUs</p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{pkg.limits?.products || 100} SKUs</p>
                    </div>
                    <div className="p-2.5 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Services</p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{pkg.limits?.services || 10} Services</p>
                    </div>
                  </div>
                </div>

                {/* Features list */}
                {pkg.features && pkg.features.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-700">Included Features ({pkg.features.length}):</p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {pkg.features.map(f => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium"
                        >
                          <Check className="h-2.5 w-2.5 text-indigo-600" />
                          {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-200"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" /> Edit Plan
                  </button>
                  <button
                    onClick={() => handleToggleStatus(pkg)}
                    className={`py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-200 ${
                      pkg.status === 'active'
                        ? 'text-amber-700 bg-amber-50/70 hover:bg-amber-100 border-amber-200/70'
                        : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200/70'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {pkg.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>

                <button
                  onClick={() => handleDeletePackage(pkg)}
                  className="w-full py-1.5 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Delete Package
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE PACKAGE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create Subscription Plan</h2>
            <p className="text-xs text-slate-500">Define tier parameters, resource quotas, and platform features for shops.</p>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Package Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Growth Pro Tier"
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Monthly Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Designed for growing multi-location retailers with high inventory velocity."
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              {/* Resource Quotas Section */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                <p className="font-bold text-slate-800">Resource Quota Allocations</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Branches</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.branches}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, branches: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Staff Users</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.users}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, users: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Products (SKUs)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.products}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, products: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Services</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.services}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, services: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Storage (MB)</label>
                    <input
                      type="number"
                      min="50"
                      required
                      value={formData.limits.storageMb}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, storageMb: parseInt(e.target.value) || 500 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Initial Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feature Toggles & Custom Features */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-medium text-slate-700">Included Features & Modules ({formData.features.length} selected)</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto">
                  {getAllDisplayFeatures().map(f => {
                    const isChecked = formData.features.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center justify-between gap-2 text-[11px] p-1.5 rounded-lg border transition-colors cursor-pointer select-none ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFeature(f.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          {f.label}
                        </span>
                        {isChecked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFeature(f.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Add Custom Feature Row */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom feature (e.g. loyalty_rewards, ai_insights)..."
                    value={customFeatureInput}
                    onChange={e => setCustomFeatureInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFeature(e);
                      }
                    }}
                    className="flex-1 p-2 text-xs border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomFeature}
                    className="px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 rounded-xl transition-colors shrink-0"
                  >
                    + Add Feature
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {isSubmitting ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PACKAGE MODAL */}
      {showEditModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Edit Subscription Plan</h2>
            <p className="text-xs text-slate-500">Updating parameters & features for <span className="font-bold text-slate-800">{selectedPackage.name}</span></p>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Package Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Monthly Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              {/* Resource Quotas Section */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                <p className="font-bold text-slate-800">Resource Quota Allocations</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Branches</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.branches}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, branches: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Staff Users</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.users}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, users: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Products (SKUs)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.products}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, products: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Services</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.limits.services}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, services: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Storage (MB)</label>
                    <input
                      type="number"
                      min="50"
                      required
                      value={formData.limits.storageMb}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          limits: { ...formData.limits, storageMb: parseInt(e.target.value) || 500 },
                        })
                      }
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full p-2 border border-slate-200/90 rounded-lg bg-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feature Toggles & Custom Features */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-medium text-slate-700">Included Features & Modules ({formData.features.length} selected)</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto">
                  {getAllDisplayFeatures().map(f => {
                    const isChecked = formData.features.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center justify-between gap-2 text-[11px] p-1.5 rounded-lg border transition-colors cursor-pointer select-none ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFeature(f.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          {f.label}
                        </span>
                        {isChecked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFeature(f.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Add Custom Feature Row */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom feature (e.g. loyalty_rewards, ai_insights)..."
                    value={customFeatureInput}
                    onChange={e => setCustomFeatureInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFeature(e);
                      }
                    }}
                    className="flex-1 p-2 text-xs border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomFeature}
                    className="px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 rounded-xl transition-colors shrink-0"
                  >
                    + Add Feature
                  </button>
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

      {/* QUICK QUOTA MODAL */}
      {showQuotaModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Configure Quotas: {selectedPackage.name}</h2>
            <p className="text-xs text-slate-500">Fine-tune maximum branch, staff, inventory SKU, and service limits.</p>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Max Branches</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.limits.branches}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits, branches: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Max Staff Users</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.limits.users}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits, users: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Max Products (SKUs)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.limits.products}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits, products: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Max Services</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.limits.services}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits, services: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuotaModal(false)}
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
                  {isSubmitting ? 'Saving...' : 'Apply Quotas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
