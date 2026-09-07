'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Supplier, PurchaseOrder, GoodsReceivedNote, Product } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Truck,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Power,
  X,
  CreditCard,
  Package,
  Calendar,
  Layers,
} from 'lucide-react';

export default function SuppliersPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    paymentTerms: 'Net 30',
    productsSupplied: [] as string[],
  });
  const [productTagInput, setProductTagInput] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [supRes, prodRes] = await Promise.all([
        api.get<Supplier[]>('/suppliers'),
        api.get<Product[]>('/products'),
      ]);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const activeSuppliersCount = suppliers.filter(s => s.status === 'active').length;
  const totalPOSpend = suppliers.reduce((sum, s) => sum + ((s as any).totalSpend || 0), 0);
  const totalPOCount = suppliers.reduce((sum, s) => sum + ((s as any).purchaseOrderCount || 0), 0);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      paymentTerms: 'Net 30',
      productsSupplied: [],
    });
    setProductTagInput('');
    setShowModal(true);
  };

  const openEditModal = (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      address: sup.address || '',
      taxId: sup.taxId || '',
      paymentTerms: sup.paymentTerms || 'Net 30',
      productsSupplied: sup.productsSupplied || [],
    });
    setProductTagInput('');
    setShowModal(true);
  };

  const handleOpenSupplier360 = async (sup: Supplier) => {
    try {
      const res = await api.get<any>(`/suppliers/${sup.id}`);
      setSelectedSupplierProfile(res.data);
    } catch (err: any) {
      showError('Profile Error', err.message || 'Could not load supplier profile.');
    }
  };

  const addProductTag = () => {
    const trimmed = productTagInput.trim();
    if (trimmed && !formData.productsSupplied.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        productsSupplied: [...prev.productsSupplied, trimmed],
      }));
      setProductTagInput('');
    }
  };

  const removeProductTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      productsSupplied: prev.productsSupplied.filter(t => t !== tag),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, formData);
        showSuccess('Supplier Updated', `Supplier "${formData.name}" updated successfully.`);
      } else {
        await api.post('/suppliers', formData);
        showSuccess('Supplier Created', `Supplier "${formData.name}" added to your directory.`);
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to save supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = sup.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${action} Supplier`,
      `Are you sure you want to ${action.toLowerCase()} "${sup.name}"?`,
      async () => {
        try {
          await api.patch(`/suppliers/${sup.id}`, { status: nextStatus });
          await loadData();
          showSuccess('Status Updated', `Supplier is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Failed', err.message || 'Could not update status.');
        }
      },
      action,
      nextStatus === 'inactive'
    );
  };

  const handleDelete = (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      'Delete Supplier',
      `Are you sure you want to delete "${sup.name}"? This cannot be undone.`,
      async () => {
        try {
          await api.delete(`/suppliers/${sup.id}`);
          if (selectedSupplierProfile?.supplier?.id === sup.id) {
            setSelectedSupplierProfile(null);
          }
          await loadData();
          showSuccess('Supplier Deleted', 'Supplier removed.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Failed to delete supplier.');
        }
      },
      'Delete Supplier',
      true
    );
  };

  const filteredSuppliers = suppliers.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Enterprise Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain supplier relationships, payment terms, supplied inventory catalogs, and purchase history (BR-14)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Add New Supplier
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Active Suppliers</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{activeSuppliersCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{suppliers.length} total vendors</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Procurement Spend</span>
          <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">{formatCurrency(totalPOSpend)}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Across all completed orders</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Purchase Orders</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalPOCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Issued purchase orders</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Average PO Size</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
            {formatCurrency(totalPOCount > 0 ? totalPOSpend / totalPOCount : 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Per order average</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, contact person, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
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

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Supplier Enterprise</th>
                <th className="py-3.5 px-6">Contact Representative</th>
                <th className="py-3.5 px-6">Payment Terms & Tax ID</th>
                <th className="py-3.5 px-6">Total Spend</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Loading supplier records...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">No suppliers found matching filters.</td></tr>
              ) : (
                filteredSuppliers.map(sup => (
                  <tr
                    key={sup.id}
                    onClick={() => handleOpenSupplier360(sup)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{sup.name}</p>
                          <p className="text-[11px] text-slate-400">{sup.address || 'No address on file'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-800">{sup.contactPerson}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" /> {sup.phone}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 text-slate-400" /> {sup.email}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg font-semibold text-[11px] border border-slate-200">
                        {sup.paymentTerms || 'Net 30'}
                      </span>
                      {sup.taxId && <p className="text-[10px] text-slate-400 font-mono mt-1">Tax: {sup.taxId}</p>}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-extrabold text-indigo-600 text-sm">{formatCurrency((sup as any).totalSpend || 0)}</p>
                      <p className="text-[10px] text-slate-400">{(sup as any).purchaseOrderCount || 0} POs issued</p>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          sup.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {sup.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        <span className="capitalize">{sup.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenSupplier360(sup)}
                          title="View 360 Profile"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => openEditModal(sup, e)}
                          title="Edit Supplier"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => handleToggleStatus(sup, e)}
                          title={sup.status === 'active' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            sup.status === 'active' ? 'text-amber-600 border-amber-200' : 'text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => handleDelete(sup, e)}
                          title="Delete Supplier"
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

      {/* ===================== SUPPLIER 360 PROFILE MODAL ===================== */}
      {selectedSupplierProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-200">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{selectedSupplierProfile.supplier.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>Contact: <b>{selectedSupplierProfile.supplier.contactPerson}</b></span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedSupplierProfile.supplier.phone}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedSupplierProfile(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Purchase Orders</span>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{selectedSupplierProfile.purchaseOrders.length}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Spend</span>
                <p className="text-xl font-extrabold text-indigo-600 mt-0.5">{formatCurrency(selectedSupplierProfile.totalSpend)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</span>
                <p className="text-xs font-bold text-slate-800 mt-1.5">{selectedSupplierProfile.supplier.paymentTerms || 'Net 30'}</p>
              </div>
            </div>

            {/* Address and Tax Info */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p className="text-slate-700">
                <b>Registered Address:</b> {selectedSupplierProfile.supplier.address || 'No address provided'}
              </p>
              {selectedSupplierProfile.supplier.taxId && (
                <p className="text-slate-700">
                  <b>Tax / VAT ID:</b> <span className="font-mono">{selectedSupplierProfile.supplier.taxId}</span>
                </p>
              )}
            </div>

            {/* Purchase Orders History */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs">Purchase Orders History</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {selectedSupplierProfile.purchaseOrders.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No purchase orders recorded for this supplier.</p>
                ) : (
                  selectedSupplierProfile.purchaseOrders.map((p: any) => (
                    <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 font-mono">#{p.poNumber}</span>
                        <span className="text-slate-400 ml-2">{formatDate(p.createdAt)}</span>
                        <span className="text-slate-500 ml-2">({p.items?.length || 0} items)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{formatCurrency(p.totalAmount)}</span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] capitalize font-semibold border border-indigo-100">
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedSupplierProfile(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADD / EDIT SUPPLIER MODAL ===================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Beverage Importers Ltd."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Vance"
                    value={formData.contactPerson}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 555 992 1029"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="orders@acmesupplies.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Payment Terms</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Tax ID / VAT Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TAX-88392"
                    value={formData.taxId}
                    onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street, City, Postal Code"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
