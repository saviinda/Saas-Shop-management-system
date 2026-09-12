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
  Eye,
  DollarSign,
  UserCheck,
  Mail,
  Phone,
  CalendarCheck,
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

  // Dedicated Service View Modal State
  const [viewingService, setViewingService] = useState<ServiceItem | null>(null);

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
            Configure customizable service categories, inspect complete service specifications, and assign specialists (BR-11)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCategoryManagerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <FolderPlus className="h-4 w-4 text-indigo-600" /> Manage Categories ({allCategories.length})
          </button>

          {/* Create Service Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all cursor-pointer"
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
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
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
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                        {/* Dedicated Service Details View Button (Eye) */}
                        <button
                          onClick={() => setViewingService(s)}
                          title="View Full Service Details"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Service */}
                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Service Details"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => handleToggleStatus(s)}
                          title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            s.status === 'active'
                              ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Service */}
                        <button
                          onClick={() => handleDeleteService(s)}
                          title="Delete Service"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
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

      {/* ==================== DEDICATED SERVICE DETAILS VIEW MODAL ==================== */}
      {viewingService && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden text-indigo-600 font-bold">
                  {viewingService.imageUrl ? (
                    <img src={viewingService.imageUrl} alt={viewingService.name} className="h-full w-full object-cover" />
                  ) : (
                    <Wrench className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{viewingService.name}</h2>
                    {viewingService.isFeatured && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                        FEATURED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-md text-xs border border-indigo-100">
                      {viewingService.category}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className={`text-xs font-semibold ${viewingService.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {viewingService.status === 'active' ? 'Active for Bookings' : 'Inactive / Hidden'}
                    </span>
                    {viewingService.isPublic && (
                      <>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Online Booking Enabled
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingService(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Standard Service Fee</span>
                <span className="text-2xl font-extrabold text-slate-900 block">
                  {formatCurrency(viewingService.price)}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block">
                  ~{formatCurrency((viewingService.price / (viewingService.durationMinutes || 60)) * 60)}/hr rate
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Estimated Duration</span>
                <span className="text-2xl font-extrabold text-slate-900 block flex items-center gap-1.5">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  {formatDurationDisplay(viewingService.durationMinutes)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {viewingService.durationMinutes} minutes slot
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Assigned Specialists</span>
                <span className="text-2xl font-extrabold text-slate-900 block flex items-center gap-1.5">
                  <Users className="h-5 w-5 text-indigo-600" />
                  {(viewingService.assignedStaffIds || []).length || 'All'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Qualified staff members
                </span>
              </div>
            </div>

            {/* Availability Box */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-indigo-600" /> Availability & Booking Schedule
              </span>
              <p className="text-slate-700 text-xs font-medium pl-5.5">
                {viewingService.availability || 'Regular Store Hours (Monday - Saturday: 9:00 AM - 7:00 PM)'}
              </p>
            </div>

            {/* Description Box */}
            {viewingService.description && (
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                  Service Inclusions & Description
                </span>
                <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  {viewingService.description}
                </p>
              </div>
            )}

            {/* Assigned Specialists Details */}
            <div className="space-y-2.5">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Assigned Staff Specialists ({(viewingService.assignedStaffIds || []).length})
              </span>
              {(!viewingService.assignedStaffIds || viewingService.assignedStaffIds.length === 0) ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                  This service is available to be performed by any active branch staff member.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingService.assignedStaffIds.map(sid => {
                    const u = staffUsers.find(user => user.id === sid);
                    return (
                      <div key={sid} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          {u ? u.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{u ? u.name : 'Staff Member'}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{u ? u.role.replace('_', ' ') : 'Specialist'}</p>
                          {u?.phone && <p className="text-[10px] text-slate-400">{u.phone}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
              <span>Catalog Created: {formatDate(viewingService.createdAt)}</span>
              <span>Last Updated: {formatDate(viewingService.updatedAt)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const s = viewingService;
                  setViewingService(null);
                  openEditModal(s);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Service Details
              </button>

              <button
                type="button"
                onClick={() => setViewingService(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE SERVICE CATEGORIES MODAL */}
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
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add New Custom Category Box */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">Create New Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. VIP Concierge, Premium Tailoring..."
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
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shrink-0 shadow-2xs transition-colors cursor-pointer"
                >
                  Add Category
                </button>
              </div>
            </div>

            {/* List of Categories */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-800 block">Existing Categories ({allCategories.length})</span>
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
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SERVICE MODAL */}
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
                  <p className="text-xs text-slate-500">Define booking fees, durations, specialist staff, and public availability</p>
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Image Upload Box */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800">Cover Photo</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all"
                  >
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Service" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <UploadCloud className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-indigo-600" />
                        <span className="text-[10px] font-semibold block">Click to upload</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    className="hidden"
                  />
                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                      className="text-[10px] text-rose-600 font-semibold hover:underline block text-center w-full cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Primary Info */}
                <div className="sm:col-span-2 space-y-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Service Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Espresso Machine Calibration & Deep Clean"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-800">Service Category</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingInlineCategory(!isAddingInlineCategory)}
                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
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
                          className="px-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs shrink-0 cursor-pointer"
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
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                </div>
              </div>

              {/* Fee & Duration Matrix */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Standard Service Fee ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-800">Duration (Minutes) *</label>
                      <button
                        type="button"
                        onClick={() => setIsCustomDuration(!isCustomDuration)}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {isCustomDuration ? 'Choose Preset' : 'Custom Duration'}
                      </button>
                    </div>

                    {isCustomDuration ? (
                      <input
                        type="number"
                        min="5"
                        step="5"
                        required
                        value={formData.durationMinutes}
                        onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                        placeholder="e.g. 75"
                      />
                    ) : (
                      <select
                        value={formData.durationMinutes}
                        onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                      >
                        {DURATION_PRESETS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Description & Inclusions</label>
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
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
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
