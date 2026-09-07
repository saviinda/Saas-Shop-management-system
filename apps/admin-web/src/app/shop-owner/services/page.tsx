'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ServiceItem, User } from '@saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Wrench,
  Plus,
  Clock,
  Edit2,
  Trash2,
  Search,
  Users,
  Calendar,
  Sparkles,
  UploadCloud,
  Check,
  X,
  Power,
  CheckCircle2,
  Globe,
  Tag,
  AlertTriangle,
  FolderPlus,
  Sliders,
} from 'lucide-react';

const DEFAULT_SERVICE_CATEGORIES = [
  'General Maintenance & Repairs',
  'Consulting & Professional',
  'Beauty & Grooming',
  'Health & Wellness',
  'Custom Fabrication & Tailoring',
  'Cleaning & Sanitation',
  'Installation & Assembly',
  'Delivery & Express Logistics',
  'Other Specialized Services',
];

const DURATION_PRESETS = [
  { label: '15 Mins', value: 15 },
  { label: '30 Mins', value: 30 },
  { label: '45 Mins', value: 45 },
  { label: '60 Mins (1 hr)', value: 60 },
  { label: '90 Mins (1.5 hrs)', value: 90 },
  { label: '120 Mins (2 hrs)', value: 120 },
  { label: '180 Mins (3 hrs)', value: 180 },
  { label: '240 Mins (4 hrs)', value: 240 },
];

export default function ServicesPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { shop } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Manage Categories Modal State
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  // Inline Category & Custom Duration Mode in Service Modal
  const [isAddingInlineCategory, setIsAddingInlineCategory] = useState(false);
  const [inlineCategoryInput, setInlineCategoryInput] = useState('');
  const [isCustomDuration, setIsCustomDuration] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'General Maintenance & Repairs',
    imageUrl: '',
    price: 45,
    durationMinutes: 60,
    availability: 'Monday - Saturday: 9:00 AM - 7:00 PM',
    assignedStaffIds: [] as string[],
    isPublic: true,
    isFeatured: false,
    status: 'active' as 'active' | 'inactive',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom categories from storage
  useEffect(() => {
    if (typeof window !== 'undefined' && shop?.id) {
      try {
        const stored = localStorage.getItem(`saas_custom_service_categories_${shop.id}`);
        if (stored) {
          setCustomCategories(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load custom service categories:', e);
      }
    }
  }, [shop?.id]);

  const saveCustomCategories = (updatedCategories: string[]) => {
    setCustomCategories(updatedCategories);
    if (typeof window !== 'undefined' && shop?.id) {
      try {
        localStorage.setItem(`saas_custom_service_categories_${shop.id}`, JSON.stringify(updatedCategories));
      } catch (e) {
        console.error('Failed to persist custom service categories:', e);
      }
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [srvRes, usrRes] = await Promise.all([
        api.get<ServiceItem[]>('/services'),
        api.get<User[]>('/users').catch(() => ({ data: [] })),
      ]);
      setServices(srvRes.data || []);
      setStaffUsers(usrRes.data || []);

      // Discover any categories from existing services
      const existingCats = new Set<string>();
      (srvRes.data || []).forEach(s => {
        if (s.category && !DEFAULT_SERVICE_CATEGORIES.includes(s.category)) {
          existingCats.add(s.category);
        }
      });
      if (existingCats.size > 0) {
        setCustomCategories(prev => Array.from(new Set([...prev, ...Array.from(existingCats)])));
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allCategories = Array.from(new Set([...DEFAULT_SERVICE_CATEGORIES, ...customCategories]));

  const handleCreateCustomCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (allCategories.includes(trimmed)) {
      showError('Category Exists', `Category "${trimmed}" already exists.`);
      return;
    }
    const updated = [...customCategories, trimmed];
    saveCustomCategories(updated);
    showSuccess('Category Added', `Service category "${trimmed}" created.`);
    setNewCategoryNameInput('');
  };

  const handleDeleteCustomCategory = (catName: string) => {
    const countInUse = services.filter(s => s.category === catName).length;
    if (countInUse > 0) {
      showError('Category In Use', `Cannot delete "${catName}" because ${countInUse} service(s) are currently assigned to it.`);
      return;
    }
    const updated = customCategories.filter(c => c !== catName);
    saveCustomCategories(updated);
    showSuccess('Category Removed', `Category "${catName}" removed.`);
  };

  const handleApplyInlineCategory = () => {
    const trimmed = inlineCategoryInput.trim();
    if (!trimmed) {
      setIsAddingInlineCategory(false);
      return;
    }
    if (!allCategories.includes(trimmed)) {
      saveCustomCategories([...customCategories, trimmed]);
    }
    setFormData(prev => ({ ...prev, category: trimmed }));
    setInlineCategoryInput('');
    setIsAddingInlineCategory(false);
    showSuccess('Category Selected', `Selected "${trimmed}".`);
  };

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please upload an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setFormData(prev => ({ ...prev, imageUrl: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const openAddModal = () => {
    setEditingService(null);
    setModalError(null);
    setIsAddingInlineCategory(false);
    setInlineCategoryInput('');
    setIsCustomDuration(false);
    setFormData({
      name: '',
      description: '',
      category: allCategories[0] || 'General Maintenance & Repairs',
      imageUrl: '',
      price: 45,
      durationMinutes: 60,
      availability: 'Monday - Saturday: 9:00 AM - 7:00 PM',
      assignedStaffIds: staffUsers.length > 0 ? [staffUsers[0].id] : [],
      isPublic: true,
      isFeatured: false,
      status: 'active',
    });
    setShowModal(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setModalError(null);
    setIsAddingInlineCategory(false);
    setInlineCategoryInput('');
    const isPreset = DURATION_PRESETS.some(p => p.value === service.durationMinutes);
    setIsCustomDuration(!isPreset);
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      imageUrl: service.imageUrl || '',
      price: service.price,
      durationMinutes: service.durationMinutes,
      availability: service.availability || 'Monday - Saturday: 9:00 AM - 7:00 PM',
      assignedStaffIds: service.assignedStaffIds || [],
      isPublic: service.isPublic !== false,
      isFeatured: !!service.isFeatured,
      status: service.status || 'active',
    });
    setShowModal(true);
  };

  const toggleStaffAssignment = (staffId: string) => {
    setFormData(prev => {
      const exists = prev.assignedStaffIds.includes(staffId);
      return {
        ...prev,
        assignedStaffIds: exists
          ? prev.assignedStaffIds.filter(id => id !== staffId)
          : [...prev.assignedStaffIds, staffId],
      };
    });
  };

  const formatDurationDisplay = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} mins (${mins}m)` : `${hrs} hr${hrs > 1 ? 's' : ''} (${mins}m)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Service Name is required');
      return;
    }
    if (formData.durationMinutes <= 0) {
      setModalError('Duration must be greater than 0 minutes');
      return;
    }

    try {
      setIsSubmitting(true);
      const assignedStaffNames = staffUsers
        .filter(u => formData.assignedStaffIds.includes(u.id))
        .map(u => u.name);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        imageUrl: formData.imageUrl || undefined,
        price: Number(formData.price),
        durationMinutes: Number(formData.durationMinutes),
        availability: formData.availability.trim(),
        assignedStaffIds: formData.assignedStaffIds,
        assignedStaffNames,
        isPublic: formData.isPublic,
        isFeatured: formData.isFeatured,
        status: formData.status,
      };

      if (editingService) {
        await api.patch(`/services/${editingService.id}`, payload);
        showSuccess('Service Updated', `Service "${formData.name}" has been updated.`);
      } else {
        await api.post('/services', payload);
        showSuccess('Service Created', `Service "${formData.name}" added to your catalog.`);
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (s: ServiceItem) => {
    const nextStatus = s.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${action} Service`,
      `Are you sure you want to ${action.toLowerCase()} "${s.name}"? ${
        nextStatus === 'inactive' ? 'It will no longer appear in new bookings.' : 'It will be made active for bookings.'
      }`,
      async () => {
        try {
          await api.patch(`/services/${s.id}`, { status: nextStatus });
          await loadData();
          showSuccess('Status Updated', `Service is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Failed', err.message || 'Could not update service status.');
        }
      },
      action,
      nextStatus === 'inactive'
    );
  };

  const handleDeleteService = (s: ServiceItem) => {
    showConfirm(
      'Delete Service',
      `Are you sure you want to delete "${s.name}"?`,
      async () => {
        try {
          await api.delete(`/services/${s.id}`);
          await loadData();
          showSuccess('Service Deleted', 'Service record removed.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete service.');
        }
      },
      'Delete Service',
      true
    );
  };

  const filteredServices = services.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Services Catalog & Booking Offerings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure customizable service categories, custom appointment durations, specialist staff, and booking schedules (BR-11)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCategoryManagerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <FolderPlus className="h-4 w-4 text-indigo-600" /> Manage Categories ({allCategories.length})
          </button>

          {/* Create Service Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Create New Service
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search services by title, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Service Categories ({allCategories.length})</option>
            {allCategories.map(c => (
              <option key={c} value={c}>
                {c} {customCategories.includes(c) ? '(Custom)' : ''}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Services Grid & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Service Offering</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Fee & Duration</th>
                <th className="py-3.5 px-6">Assigned Specialists</th>
                <th className="py-3.5 px-6">Availability</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading services catalog...</td></tr>
              ) : filteredServices.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No services found matching filters.</td></tr>
              ) : (
                filteredServices.map(s => (
                  <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden text-indigo-600 font-bold">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                          ) : (
                            <Wrench className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                            {s.isFeatured && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                                FEATURED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px]">{s.description || 'No description'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 text-sm">{formatCurrency(s.price)}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-slate-400" /> {formatDurationDisplay(s.durationMinutes)}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {(!s.assignedStaffIds || s.assignedStaffIds.length === 0) ? (
                          <span className="text-slate-400 text-[11px]">Any Available Staff</span>
                        ) : (
                          s.assignedStaffIds.map(sid => {
                            const u = staffUsers.find(usr => usr.id === sid);
                            return (
                              <span key={sid} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold border border-indigo-100">
                                {u ? u.name : 'Specialist'}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 text-xs">
                      {s.availability || 'Regular Store Hours'}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {s.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        <span className="capitalize">{s.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Service"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            s.status === 'active'
                              ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(s)}
                          title="Delete Service"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
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

      {/* MANAGE CUSTOM SERVICE CATEGORIES MODAL */}
      {showCategoryManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Manage Service Categories</h3>
                  <p className="text-xs text-slate-500">Create, customize, or delete service classification categories</p>
                </div>
              </div>
              <button
                onClick={() => setShowCategoryManagerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add New Custom Category Box */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">Create New Service Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Hair Styling & Spa, Phone Screen Repair..."
                  value={newCategoryNameInput}
                  onChange={e => setNewCategoryNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCustomCategory(newCategoryNameInput);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => handleCreateCustomCategory(newCategoryNameInput)}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shrink-0 shadow-2xs transition-colors"
                >
                  Add Category
                </button>
              </div>
            </div>

            {/* List of Categories */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-800 block">Existing Service Categories ({allCategories.length})</span>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {allCategories.map(cat => {
                  const isCustom = customCategories.includes(cat);
                  const count = services.filter(s => s.category === cat).length;

                  return (
                    <div
                      key={cat}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{cat}</span>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                            Custom
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({count} services)</span>
                      </div>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomCategory(cat)}
                          title="Delete Custom Category"
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCategoryManagerModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SERVICE MODAL WITH CUSTOM CATEGORY & CUSTOM DURATION */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingService ? `Edit Service: ${editingService.name}` : 'Create New Service Offering'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure customizable duration, service category, pricing, and assigned staff</p>
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Service Title */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Service Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Tailoring & Hemming"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-semibold"
                  />
                </div>

                {/* Customizable Category Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Service Category</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingInlineCategory(!isAddingInlineCategory)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      {isAddingInlineCategory ? 'Select Existing' : '+ Custom Category'}
                    </button>
                  </div>

                  {isAddingInlineCategory ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Type custom service category..."
                        value={inlineCategoryInput}
                        onChange={e => setInlineCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyInlineCategory();
                          }
                        }}
                        className="w-full p-2 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleApplyInlineCategory}
                        className="px-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs shrink-0"
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={e => {
                        if (e.target.value === '__add_custom__') {
                          setIsAddingInlineCategory(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                    >
                      {allCategories.map(c => (
                        <option key={c} value={c}>
                          {c} {customCategories.includes(c) ? '(Custom)' : ''}
                        </option>
                      ))}
                      <option value="__add_custom__">+ Create New Custom Category...</option>
                    </select>
                  )}
                </div>

                {/* Service Fee */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Service Fee ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-indigo-700 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                {/* Customizable Duration (Presets + Custom Input Mode) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" /> Duration (Minutes) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomDuration(!isCustomDuration)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      {isCustomDuration ? 'Choose from Presets' : 'Custom Duration'}
                    </button>
                  </div>

                  {isCustomDuration ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          required
                          placeholder="e.g. 25, 75, 105"
                          value={formData.durationMinutes}
                          onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />
                        <span className="text-xs font-semibold text-slate-600 shrink-0">Minutes</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Preview: <b>{formatDurationDisplay(formData.durationMinutes)}</b>
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formData.durationMinutes}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomDuration(true);
                        } else {
                          setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 });
                        }
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                    >
                      {DURATION_PRESETS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                      <option value="__custom__">⚙️ Enter Custom Duration...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Service Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Service Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed breakdown of work performed, inclusions, prerequisites..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Availability Schedule */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Availability Schedule</label>
                <input
                  type="text"
                  placeholder="e.g. Mon - Sat: 9:00 AM - 7:00 PM (By Appointment)"
                  value={formData.availability}
                  onChange={e => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Assigned Staff Specialists Multiselect */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-600" /> Assign Specialist Staff Members
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {staffUsers.map(u => {
                    const isChecked = formData.assignedStaffIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleStaffAssignment(u.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                        {u.name} ({u.role.replace('_', ' ')})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Public Store & Mobile App Flags */}
              <div className="flex flex-wrap items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800 text-xs">Enable Public Online Booking</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800 text-xs">Feature on Homepage</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 text-xs">Status:</span>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Actions */}
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
                  className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
