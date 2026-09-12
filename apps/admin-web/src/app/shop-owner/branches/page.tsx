'use client';

import React, { useState } from 'react';
import { useBranch } from '@/lib/branch-context';
import { api, ApiError } from '@/lib/api-client';
import { Branch } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { Building2, Plus, Phone, MapPin, Edit2, Trash2, Power, CheckCircle2, ArrowRightLeft } from 'lucide-react';

export default function BranchesPage() {
  const { branches, refreshBranches, activeBranch, setActiveBranchId } = useBranch();
  const { showSuccess, showError, showConfirm } = useModal();
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFormData = {
    name: '',
    address: '',
    phone: '',
    code: '',
    status: 'active' as 'active' | 'inactive',
  };

  const [formData, setFormData] = useState(defaultFormData);

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setModalError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      code: branch.code || '',
      status: branch.status || 'active',
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Branch name is required');
      return;
    }
    if (!formData.address.trim()) {
      setModalError('Physical address is required');
      return;
    }
    if (!formData.phone.trim()) {
      setModalError('Branch phone is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/branches', {
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        code: formData.code.trim() || undefined,
      });
      setShowCreateModal(false);
      await refreshBranches();
      showSuccess('Branch Created', `Branch "${formData.name}" has been created successfully.`);
    } catch (err: any) {
      const errorMessage = err?.message || 'Branch limit reached. You cannot create a new branch under your current plan.';
      setModalError(errorMessage);
      showError(
        err?.code === 'PACKAGE_LIMIT_EXCEEDED' ? 'Branch Limit Reached' : 'Unable to Create Branch',
        errorMessage
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setModalError(null);

    setIsSubmitting(true);
    try {
      await api.patch(`/branches/${selectedBranch.id}`, {
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
      });
      setShowEditModal(false);
      await refreshBranches();
      showSuccess('Branch Updated', `Branch "${formData.name}" details have been saved.`);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update branch details.';
      setModalError(errorMessage);
      showError('Unable to Update Branch', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (branch: Branch) => {
    if (branch.isDefault && branch.status === 'active') {
      showError('Action Denied', 'The primary default branch cannot be deactivated.');
      return;
    }

    const nextStatus = branch.status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${actionLabel} Branch: ${branch.name}`,
      `Are you sure you want to ${actionLabel.toLowerCase()} this branch? ${
        nextStatus === 'inactive'
          ? 'Staff members assigned exclusively to this branch will not be able to process orders.'
          : 'The branch will resume operations and inventory tracking.'
      }`,
      async () => {
        try {
          await api.patch(`/branches/${branch.id}/status`, { status: nextStatus });
          await refreshBranches();
          showSuccess('Status Updated', `Branch "${branch.name}" is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Update Failed', err.message || 'Could not update branch status.');
        }
      },
      actionLabel,
      nextStatus === 'inactive'
    );
  };

  const handleDeleteBranch = (branch: Branch) => {
    if (branch.isDefault) {
      showError('Action Denied', 'The primary default branch cannot be deleted.');
      return;
    }

    showConfirm(
      'Delete Branch',
      `Are you sure you want to permanently delete "${branch.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/branches/${branch.id}`);
          if (activeBranch?.id === branch.id) {
            const remaining = branches.filter(b => b.id !== branch.id);
            if (remaining.length > 0) setActiveBranchId(remaining[0].id);
          }
          await refreshBranches();
          showSuccess('Branch Deleted', `Branch "${branch.name}" was permanently removed.`);
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete branch.');
        }
      },
      'Delete Branch',
      true
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Branch Management & Segregation</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage operational store branches, update branch status, and switch active context (BR-13, BR-14)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {branches.map(b => (
          <div
            key={b.id}
            className={`p-6 rounded-2xl border transition-all duration-300 bg-white flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 ${
              activeBranch?.id === b.id
                ? 'border-indigo-600 shadow-sm shadow-indigo-100 ring-2 ring-indigo-600/10'
                : 'border-slate-200/80 shadow-sm shadow-slate-200/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 font-bold text-xs shadow-2xs">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">{b.name}</h3>
                    <p className="text-[10px] text-slate-400 uppercase font-mono">{b.code || 'MAIN-01'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {b.isDefault && (
                    <span className="text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100/80">
                      Default
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      b.status === 'active'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
                        : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}
                  >
                    {b.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600 font-medium">
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{b.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{b.phone}</span>
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Created: {formatDate(b.createdAt)}</span>
                {activeBranch?.id === b.id ? (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100/80 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active Context
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveBranchId(b.id)}
                    className="px-3 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg border border-indigo-100/60 active:scale-[0.98] transition-all duration-200 flex items-center gap-1"
                  >
                    <ArrowRightLeft className="h-3 w-3" /> Switch Context
                  </button>
                )}
              </div>

              {/* Action Buttons: Edit, Toggle Status, Delete */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(b)}
                  className="py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-200"
                >
                  <Edit2 className="h-3.5 w-3.5 text-slate-500" /> Edit Branch
                </button>
                
                <button
                  onClick={() => handleToggleStatus(b)}
                  disabled={b.isDefault && b.status === 'active'}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-200 ${
                    b.isDefault && b.status === 'active'
                      ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 border-slate-200'
                      : b.status === 'active'
                      ? 'text-amber-700 bg-amber-50/70 hover:bg-amber-100 border-amber-200/70'
                      : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200/70'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {b.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>

              {!b.isDefault && (
                <button
                  onClick={() => handleDeleteBranch(b)}
                  className="w-full py-1.5 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Delete Branch
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CREATE BRANCH MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add New Operational Branch</h2>
            <p className="text-xs text-slate-500">Provision a distinct location branch with dedicated inventory context.</p>

            {modalError && (
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West End Roastery"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Physical Location Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 504 Sunset Blvd, Arts District"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Branch Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 555 334 9911"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Branch Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. BR-WEST02"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
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
                  {isSubmitting ? 'Provisioning...' : 'Provision Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRANCH MODAL */}
      {showEditModal && selectedBranch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Edit Branch Details</h2>
            <p className="text-xs text-slate-500">Updating parameters for <span className="font-bold text-slate-800">{selectedBranch.name}</span></p>

            {modalError && (
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Physical Location Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Branch Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Branch Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    disabled={selectedBranch.isDefault}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200 disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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
