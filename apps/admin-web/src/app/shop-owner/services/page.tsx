'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ServiceItem, ServiceCategory, User } from '@saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  Search,
  Users,
  CheckCircle2,
  Power,
  Globe,
  Tag,
  AlertTriangle,
  FolderTree,
  Eye,
  RotateCcw,
  X,
} from 'lucide-react';

export default function ServicesPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { shop } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
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

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: 45,
    availability: 'Monday - Saturday: 9:00 AM - 7:00 PM',
    assignedStaffIds: [] as string[],
    isPublic: true,
    isFeatured: false,
    status: 'active' as 'active' | 'inactive',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [srvRes, catRes, usrRes] = await Promise.all([
        api.get<ServiceItem[]>('/services'),
        api.get<ServiceCategory[]>('/service-categories'),
        api.get<User[]>('/users').catch(() => ({ data: [] })),
      ]);
      setServices(srvRes.data || []);
      setCategories(catRes.data || []);
      setStaffUsers(usrRes.data || []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingService(null);
    setModalError(null);
    setFormData({
      name: '',
      description: '',
      category: categories[0]?.name || '',
      price: 45,
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
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      price: service.price,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Service Name is required');
      return;
    }
    if (!formData.category.trim()) {
      setModalError('Please select or create a category first.');
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
        price: Number(formData.price),
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
        nextStatus === 'inactive' ? 'It will no longer appear in new orders.' : 'It will be made active for orders.'
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
      `Are you sure you want to permanently delete "${s.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/services/${s.id}`);
          if (viewingService?.id === s.id) {
            setViewingService(null);
          }
          await loadData();
          showSuccess('Service Deleted', `Service "${s.name}" removed from catalog.`);
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete service.');
        }
      },
      'Delete Service',
      true
    );
  };

  const filteredServices = services.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const activeServicesCount = services.filter(s => s.status === 'active').length;
  const avgPrice = services.length > 0
    ? services.reduce((acc, s) => acc + s.price, 0) / services.length
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wrench className="h-6 w-6 text-indigo-600" />
            Service Catalog & Work Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure service offerings, pricing, assigned specialists, and category classifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Dedicated Category Page Link */}
          <Link
            href="/shop-owner/services/categories"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-2xs transition-all active:scale-[0.98]"
          >
            <FolderTree className="h-4 w-4 text-indigo-600" />
            <span>Manage Categories</span>
            {categories.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                {categories.length}
              </span>
            )}
          </Link>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Add New Service
          </button>
        </div>
      </div>

      {/* Top 3 Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <span>Total Catalog Services</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wrench className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{services.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{activeServicesCount} currently active</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <span>Active Categories</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FolderTree className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-600">{categories.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            <Link href="/shop-owner/services/categories" className="text-indigo-600 hover:underline">
              View and edit categories &rarr;
            </Link>
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <span>Average Fee</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="font-extrabold text-xs">$</span>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(avgPrice)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mean catalog base price</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search services, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Service Offering</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Service Fee</th>
                <th className="py-3.5 px-6">Assigned Specialists</th>
                <th className="py-3.5 px-6">Availability</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading services catalog...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No services found</p>
                      <p className="text-slate-400 text-xs">
                        {search || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters or search keywords.'
                          : 'Get started by creating your first service offering.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map(s => (
                  <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-bold">
                          <Wrench className="h-5 w-5" />
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
                          <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[240px]">
                            {s.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-200">
                        {s.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-extrabold text-slate-900 text-sm">{formatCurrency(s.price)}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {!s.assignedStaffIds || s.assignedStaffIds.length === 0 ? (
                          <span className="text-slate-400 text-[11px]">Any Staff</span>
                        ) : (
                          s.assignedStaffIds.map(sid => {
                            const u = staffUsers.find(usr => usr.id === sid);
                            return (
                              <span
                                key={sid}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold border border-indigo-100"
                              >
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
                          onClick={() => setViewingService(s)}
                          title="View Full Service Details"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Service Details"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

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

      {/* DEDICATED SERVICE DETAILS VIEW MODAL */}
      {viewingService && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-bold">
                  <Wrench className="h-6 w-6" />
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
                      {viewingService.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    {viewingService.isPublic && (
                      <>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Public Catalog
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
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Standard Service Fee</span>
                <span className="text-2xl font-extrabold text-slate-900 block">
                  {formatCurrency(viewingService.price)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Catalog base rate</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Assigned Specialists</span>
                <span className="text-2xl font-extrabold text-indigo-600 block flex items-center gap-1.5">
                  <Users className="h-5 w-5 text-indigo-600" />
                  {(viewingService.assignedStaffIds || []).length || 'All'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Staff assigned</span>
              </div>
            </div>

            {/* Availability Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">Operating Hours & Availability</span>
              <p className="font-bold text-slate-900 text-xs">{viewingService.availability || 'Regular Store Hours'}</p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                Service Description & Scope
              </span>
              <p className="text-slate-700 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                {viewingService.description || 'No detailed description provided for this service offering.'}
              </p>
            </div>

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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              <span>Created: {formatDate(viewingService.createdAt)}</span>
              <span>Updated: {formatDate(viewingService.updatedAt)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
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

      {/* CREATE / EDIT SERVICE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingService ? `Edit Service: ${editingService.name}` : 'Create New Service Offering'}
                  </h3>
                  <p className="text-xs text-slate-500">Define service title, category, pricing, and specialist staff</p>
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
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Service Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Spiral Binding & Document Lamination"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Service Category *</label>
                    <Link
                      href="/shop-owner/services/categories"
                      target="_blank"
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      + Manage Categories
                    </Link>
                  </div>

                  {categories.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
                      <span>No categories available. Please add one first.</span>
                      <Link
                        href="/shop-owner/services/categories"
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px]"
                      >
                        Add Category
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      required
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">Select a Category...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Standard Service Fee ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Service Description</label>
                  <textarea
                    rows={3}
                    placeholder="Details about standard deliverables, instructions, terms..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-normal"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Working Availability Window</label>
                  <input
                    type="text"
                    placeholder="e.g. Monday - Saturday: 9:00 AM - 7:00 PM"
                    value={formData.availability}
                    onChange={e => setFormData({ ...formData, availability: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Staff Assignment */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">Assign Qualified Specialists</label>
                  <span className="text-[10px] text-slate-400">
                    {formData.assignedStaffIds.length} specialist(s) selected
                  </span>
                </div>

                {staffUsers.length === 0 ? (
                  <p className="text-slate-400 italic">No staff users registered yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {staffUsers.map(user => {
                      const isSelected = formData.assignedStaffIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => toggleStaffAssignment(user.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <p className="text-xs truncate">{user.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal capitalize">
                              {user.role.replace('_', ' ')}
                            </p>
                          </div>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status and Visibility Settings */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.status === 'active'}
                    onChange={e =>
                      setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })
                    }
                    className="rounded text-indigo-600 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">Service is Active in Catalog</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="rounded text-indigo-600 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">Visible on Public Shop Portal</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="rounded text-indigo-600 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">Mark as Featured Service</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
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
