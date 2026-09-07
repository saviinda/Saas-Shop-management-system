'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { Order, Product, ServiceItem, Customer, OrderStatus, OrderPaymentStatus } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  User,
  Phone,
  Trash2,
  Package,
  Sparkles,
  Minus,
  Search,
  Filter,
  Eye,
  Printer,
  X,
  Clock,
  Check,
  AlertCircle,
  XCircle,
  Tag,
  Building2,
  Wrench,
  Receipt,
  FileText,
} from 'lucide-react';

interface CartItem {
  type: 'product' | 'service';
  id: string;
  name: string;
  sku?: string;
  originalPrice: number;
  unitPrice: number;
  quantity: number;
  variant?: string;
  assignedStaffId?: string;
}

export default function OrdersPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  // Modals State
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // POS State
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walkin');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('+1 555 000 0000');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>('paid');
  const [itemSearch, setItemSearch] = useState('');
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [ordRes, prdRes, srvRes, custRes] = await Promise.all([
        api.get<Order[]>('/orders', { branchId: activeBranch?.id }),
        api.get<Product[]>('/products'),
        api.get<ServiceItem[]>('/services'),
        api.get<Customer[]>('/customers'),
      ]);
      setOrders(ordRes.data || []);
      setProducts(prdRes.data || []);
      setServices(srvRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error('Failed to load orders data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === 'walkin') {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('+1 555 000 0000');
    } else {
      const found = customers.find(c => c.id === customerId);
      if (found) {
        setCustomerName(found.name);
        setCustomerPhone(found.phone || '');
      }
    }
  };

  const addProductToCart = (p: Product) => {
    const existingIndex = cart.findIndex(c => c.type === 'product' && c.id === p.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'product',
          id: p.id,
          name: p.name,
          sku: p.sku,
          originalPrice: p.sellingPrice,
          unitPrice: p.sellingPrice,
          quantity: 1,
        },
      ]);
    }
  };

  const addServiceToCart = (s: ServiceItem) => {
    const existingIndex = cart.findIndex(c => c.type === 'service' && c.id === s.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'service',
          id: s.id,
          name: s.name,
          originalPrice: s.price,
          unitPrice: s.price,
          quantity: 1,
          assignedStaffId: s.assignedStaffIds?.[0],
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const calculatedTax = (cartSubtotal * taxPercent) / 100;
  const cartTotal = Math.max(0, cartSubtotal + calculatedTax - discountAmount);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showError('Cart is Empty', 'Please select at least one product or service to create an order.');
      return;
    }
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/orders', {
        branchId: activeBranch.id,
        customerId: selectedCustomerId !== 'walkin' ? selectedCustomerId : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart.map(item => ({
          type: item.type,
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          variant: item.variant,
          assignedStaffId: item.assignedStaffId,
        })),
        tax: calculatedTax,
        discount: discountAmount,
        paymentStatus,
        paymentMethod,
        notes: orderNotes.trim() || undefined,
      });

      setShowPOSModal(false);
      setCart([]);
      setDiscountAmount(0);
      setTaxPercent(0);
      setOrderNotes('');
      showSuccess('Order Placed Successfully', `Order for ${customerName} processed and inventory updated.`);
      await loadData();
    } catch (err: any) {
      showError('Order Creation Failed', err.message || 'Failed to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails({ ...selectedOrderDetails, status: newStatus });
      }
      await loadData();
      showSuccess('Order Status Updated', `Order #${selectedOrderDetails?.orderNumber || orderId} is now ${newStatus}.`);
    } catch (err: any) {
      showError('Status Update Failed', err.message || 'Could not update order status.');
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, newPaymentStatus: OrderPaymentStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { paymentStatus: newPaymentStatus });
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails({ ...selectedOrderDetails, paymentStatus: newPaymentStatus });
      }
      await loadData();
      showSuccess('Payment Status Updated', `Order payment marked as ${newPaymentStatus}.`);
    } catch (err: any) {
      showError('Payment Update Failed', err.message || 'Could not update payment status.');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (paymentStatusFilter !== 'all' && o.paymentStatus !== paymentStatusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management & POS Fulfillment</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track order lifecycles (Pending → Confirmed → Processing → Ready → Completed), payment statuses, and tax receipts
          </p>
        </div>

        <button
          onClick={() => {
            setCart([]);
            setShowPOSModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create POS Order
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order #, customer, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all capitalize ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Order ID</th>
                <th className="py-3.5 px-6">Customer</th>
                <th className="py-3.5 px-6">Items Summary</th>
                <th className="py-3.5 px-6">Total Amount</th>
                <th className="py-3.5 px-6">Payment</th>
                <th className="py-3.5 px-6">Order Status</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Loading orders...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">No orders found matching filters.</td></tr>
              ) : (
                filteredOrders.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrderDetails(o)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                      #{o.orderNumber}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{o.customerName}</p>
                      <p className="text-[11px] text-slate-400">{o.customerPhone || '-'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-800">{o.items.length} items</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        {o.items.map(i => i.name).join(', ')}
                      </p>
                    </td>
                    <td className="py-4 px-6 font-extrabold text-slate-900 text-sm">
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          o.paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : o.paymentStatus === 'partial'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          o.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : o.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : o.status === 'confirmed' || o.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : o.status === 'ready'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className="capitalize">{o.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedOrderDetails(o)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE ORDER DETAILS & STATUS WORKFLOW MODAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg font-mono">Order #{selectedOrderDetails.orderNumber}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                    {selectedOrderDetails.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Placed on {formatDate(selectedOrderDetails.createdAt)} &bull; Branch: {activeBranch?.name || 'Main Branch'}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer & Payment Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Customer Details</span>
                <p className="font-bold text-slate-900 text-sm">{selectedOrderDetails.customerName}</p>
                <p className="text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {selectedOrderDetails.customerPhone || 'N/A'}</p>
                {selectedOrderDetails.customerEmail && (
                  <p className="text-slate-500">{selectedOrderDetails.customerEmail}</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Payment Summary</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-600">Method:</span>
                  <span className="font-bold capitalize">{selectedOrderDetails.paymentMethod || 'Cash'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Payment Status:</span>
                  <span className="font-bold uppercase text-emerald-600">{selectedOrderDetails.paymentStatus}</span>
                </div>
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrderDetails.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{item.name}</p>
                        {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-600">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2 px-4 text-right text-slate-600">Subtotal:</td>
                    <td className="py-2 px-4 text-right">{formatCurrency(selectedOrderDetails.subtotal)}</td>
                  </tr>
                  {selectedOrderDetails.tax > 0 && (
                    <tr>
                      <td colSpan={4} className="py-1 px-4 text-right text-slate-600">Tax:</td>
                      <td className="py-1 px-4 text-right text-slate-700">+{formatCurrency(selectedOrderDetails.tax)}</td>
                    </tr>
                  )}
                  {selectedOrderDetails.discount > 0 && (
                    <tr>
                      <td colSpan={4} className="py-1 px-4 text-right text-slate-600">Discount:</td>
                      <td className="py-1 px-4 text-right text-emerald-600">-{formatCurrency(selectedOrderDetails.discount)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 text-sm">
                    <td colSpan={4} className="py-2.5 px-4 text-right text-slate-900">Grand Total:</td>
                    <td className="py-2.5 px-4 text-right text-indigo-600 font-extrabold">{formatCurrency(selectedOrderDetails.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Lifecycle Status Action Controls */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800">Order Lifecycle Transition:</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {(['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'] as OrderStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrderDetails.id, st)}
                    className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition-all ${
                      selectedOrderDetails.status === st
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
              >
                <Printer className="h-4 w-4" /> Print Order Receipt
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS ORDER ENTRY MODAL */}
      {showPOSModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Point of Sale (POS) Order Entry</h2>
                <p className="text-xs text-slate-500">Active Branch: <span className="font-semibold text-indigo-600">{activeBranch?.name || 'Default Branch'}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setShowPOSModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              {/* Customer Selection Section */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span>Customer Selection</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Select Customer</label>
                    <select
                      value={selectedCustomerId}
                      onChange={e => handleCustomerSelect(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="walkin">Walk-in Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      required
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items Catalog Switcher (Products / Services) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTab('products')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        activeTab === 'products' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" /> Products ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        activeTab === 'services' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Wrench className="h-3.5 w-3.5" /> Services ({services.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48"
                  />
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {activeTab === 'products'
                    ? products
                        .filter(p => !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => addProductToCart(p)}
                            className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all flex flex-col justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-extrabold text-indigo-700">{formatCurrency(p.sellingPrice)}</span>
                              <span className="p-1 bg-indigo-600 text-white rounded-md"><Plus className="h-3 w-3" /></span>
                            </div>
                          </div>
                        ))
                    : services
                        .filter(s => !itemSearch || s.name.toLowerCase().includes(itemSearch.toLowerCase()))
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => addServiceToCart(s)}
                            className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all flex flex-col justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900 truncate">{s.name}</p>
                              <p className="text-[10px] text-slate-400">{s.durationMinutes} mins</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-extrabold text-indigo-700">{formatCurrency(s.price)}</span>
                              <span className="p-1 bg-indigo-600 text-white rounded-md"><Plus className="h-3 w-3" /></span>
                            </div>
                          </div>
                        ))}
                </div>
              </div>

              {/* Order Cart Table */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800">Order Items Cart ({cart.length})</span>
                {cart.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                    Click items above to add them to this order.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Price</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <p className="font-bold text-slate-900">{item.name}</p>
                              <span className="text-[10px] text-slate-400 capitalize">{item.type}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => updateQuantity(idx, -1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Minus className="h-3 w-3" /></button>
                                <span className="font-bold w-6 text-center">{item.quantity}</span>
                                <button type="button" onClick={() => updateQuantity(idx, 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Plus className="h-3 w-3" /></button>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button type="button" onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment & Totals */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block font-medium text-slate-700">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cash', 'card', 'bank_transfer', 'online'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`p-2 rounded-lg border font-semibold capitalize ${
                          paymentMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {m.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 text-right font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span>{formatCurrency(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-indigo-700 pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPOSModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || cart.length === 0}
                  className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Placing Order...' : 'Complete & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
