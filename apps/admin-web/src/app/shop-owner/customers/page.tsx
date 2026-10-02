'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Customer, Order } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  Phone,
  Mail,
  ShoppingBag,
  Clock,
  X,
  User,
  History,
  RotateCcw,
} from 'lucide-react';

export default function CustomersPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State (Address, Notes, Tags removed per requirements)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Customer 360 Profile Modal State
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const loadCustomers = async (searchTerm = search) => {
    try {
      setIsLoading(true);
      const res = await api.get<Customer[]>('/customers', searchTerm ? { search: searchTerm } : undefined);
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setModalError(null);
    setFormData({ name: '', email: '', phone: '' });
    setShowModal(true);
  };

  const openEditModal = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(customer);
    setModalError(null);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone,
    });
    setShowModal(true);
  };

  const handleOpenCustomer360 = async (customer: Customer) => {
    setSelectedCustomerProfile(customer);
    setIsLoadingProfile(true);
    try {
      const res = await api.get<any>(`/customers/${customer.id}`);
      setCustomerOrders(res.data?.orders || []);
    } catch (err: any) {
      showError('Failed to Load History', err.message || 'Could not fetch customer history.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Customer Name is required');
      return;
    }
    if (!formData.phone.trim()) {
      setModalError('Contact phone number is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
      };

      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, payload);
        showSuccess('Customer Updated', `Customer "${formData.name}" has been updated.`);
      } else {
        await api.post('/customers', payload);
        showSuccess('Customer Added', `Customer "${formData.name}" added to directory.`);
      }
      setShowModal(false);
      loadCustomers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      'Delete Customer',
      `Are you sure you want to delete customer record for "${customer.name}"?`,
      async () => {
        try {
          await api.delete(`/customers/${customer.id}`);
          if (selectedCustomerProfile?.id === customer.id) {
            setSelectedCustomerProfile(null);
          }
          loadCustomers();
          showSuccess('Customer Deleted', 'Customer record removed.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Failed to delete customer.');
        }
      },
      'Delete Customer',
      true
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="h-6 w-6 text-indigo-600" />
            Customer Directory & 360 History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain customer profiles, purchase history, and lifetime spend analytics.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add New Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Customer Profile</th>
                <th className="py-3.5 px-6">Contact Info</th>
                <th className="py-3.5 px-6">Lifetime Orders</th>
                <th className="py-3.5 px-6">Total Spend</th>
                <th className="py-3.5 px-6">Joined Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No customers found</p>
                      <p className="text-slate-400 text-xs">
                        {search ? 'Try adjusting your search criteria.' : 'Add your first customer to the directory.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenCustomer360(c)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                            {c.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-semibold text-slate-800 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" /> {c.phone}
                      </p>
                      {c.email && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-400" /> {c.email}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-6 font-bold text-slate-900">
                      {c.totalOrdersCount || 0} orders
                    </td>

                    <td className="py-4 px-6 font-extrabold text-indigo-600 text-sm">
                      {formatCurrency(c.totalSpent || 0)}
                    </td>

                    <td className="py-4 px-6 text-slate-500">{formatDate(c.createdAt)}</td>

                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={e => openEditModal(c, e)}
                          title="Edit Customer"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => handleDeleteCustomer(c, e)}
                          title="Delete Customer"
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

      {/* CUSTOMER 360 PROFILE & ORDER HISTORY MODAL */}
      {selectedCustomerProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
                  {selectedCustomerProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{selectedCustomerProfile.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="h-3 w-3 text-slate-400" /> {selectedCustomerProfile.phone}
                    </span>
                    {selectedCustomerProfile.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-slate-400" /> {selectedCustomerProfile.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerProfile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 3 Metric Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {selectedCustomerProfile.totalOrdersCount || 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lifetime Spend</span>
                <p className="text-xl font-extrabold text-indigo-600 mt-0.5">
                  {formatCurrency(selectedCustomerProfile.totalSpent || 0)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Member Since</span>
                <p className="text-xs font-bold text-slate-700 mt-2">{formatDate(selectedCustomerProfile.createdAt)}</p>
              </div>
            </div>

            {/* Order History Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
                <span>Order History ({customerOrders.length})</span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {isLoadingProfile ? (
                  <div className="py-8 text-center text-slate-400 text-xs">Loading order history...</div>
                ) : customerOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No orders recorded for this customer yet.
                  </div>
                ) : (
                  customerOrders.map(ord => (
                    <div
                      key={ord.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono">#{ord.orderNumber}</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-[10px] border border-emerald-200 capitalize">
                            {ord.status}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-1">
                          {ord.items?.length || 0} items &bull; {formatDate(ord.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-slate-900">{formatCurrency(ord.totalAmount)}</p>
                        <p className="text-[10px] text-slate-400 capitalize">
                          {ord.paymentMethod} &bull; {ord.paymentStatus}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCustomerProfile(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +1 555 882 1928"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="sarah@example.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                />
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
                  {isSubmitting ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
