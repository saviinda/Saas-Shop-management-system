'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { Order, Product, ProductBatch, ServiceItem, Customer, OrderStatus, OrderPaymentStatus } from '@saas/types';
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
  Maximize2,
  Minimize2,
  Bookmark,
  Play,
  RotateCcw,
  CheckCheck,
  ChevronRight,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface CartItem {
  type: 'product' | 'service';
  id: string;
  name: string;
  sku?: string;
  originalPrice: number;
  unitPrice: number;
  quantity: number;
  batchId?: string;
  batchNumber?: string;
  variant?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  maxQuantity?: number;
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
  const [showJobsModal, setShowJobsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const posContainerRef = useRef<HTMLDivElement>(null);

  // POS State
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
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

  // Active Job (Draft / Parked Order) being edited
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobNumber, setActiveJobNumber] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');

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
    } catch (err: any) {
      console.error('Failed to load orders data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (posContainerRef.current?.requestFullscreen) {
          await posContainerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      // Fallback toggles CSS full-viewport mode
      setIsFullscreen(prev => !prev);
    }
  };

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
    // Check if product has active batches
    const activeBatches = (p.batches || []).filter(b => b.status === 'active' && b.quantity > 0);
    const defaultBatch = activeBatches.length > 0 ? activeBatches[0] : null;

    const initialPrice = defaultBatch ? defaultBatch.sellingPrice : p.sellingPrice;
    const initialBatchId = defaultBatch ? defaultBatch.id : undefined;
    const initialBatchNumber = defaultBatch ? defaultBatch.batchNumber : undefined;

    const existingIndex = cart.findIndex(
      c => c.type === 'product' && c.id === p.id && c.batchId === initialBatchId
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + 1;
      if (defaultBatch && newQty > defaultBatch.quantity) {
        showError('Batch Limit Reached', `Only ${defaultBatch.quantity} units available in Batch #${defaultBatch.batchNumber}.`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'product',
          id: p.id,
          name: p.name,
          sku: p.sku,
          originalPrice: initialPrice,
          unitPrice: initialPrice,
          quantity: 1,
          batchId: initialBatchId,
          batchNumber: initialBatchNumber,
          maxQuantity: defaultBatch ? defaultBatch.quantity : undefined,
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

  const handleSelectBatch = (cartIndex: number, batchId: string) => {
    const updated = [...cart];
    const item = updated[cartIndex];
    const product = products.find(p => p.id === item.id);
    if (!product) return;

    if (!batchId) {
      // Revert to catalog product default
      item.batchId = undefined;
      item.batchNumber = undefined;
      item.unitPrice = product.sellingPrice;
      item.originalPrice = product.sellingPrice;
      item.maxQuantity = undefined;
    } else {
      const batch = (product.batches || []).find(b => b.id === batchId);
      if (batch) {
        item.batchId = batch.id;
        item.batchNumber = batch.batchNumber;
        item.unitPrice = batch.sellingPrice;
        item.originalPrice = batch.sellingPrice;
        item.maxQuantity = batch.quantity;
        if (item.quantity > batch.quantity) {
          item.quantity = Math.max(1, batch.quantity);
        }
      }
    }
    setCart(updated);
  };

  const handleUpdateUnitPrice = (cartIndex: number, newPrice: number) => {
    const updated = [...cart];
    updated[cartIndex].unitPrice = Math.max(0, newPrice);
    setCart(updated);
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
      setCart(updated);
      return;
    }

    if (item.maxQuantity && newQty > item.maxQuantity) {
      showError('Stock Limit Reached', `Only ${item.maxQuantity} units available for this selection.`);
      return;
    }

    item.quantity = newQty;
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

  const resetPOSForm = () => {
    setCart([]);
    setSelectedCustomerId('walkin');
    setCustomerName('Walk-in Customer');
    setCustomerPhone('+1 555 000 0000');
    setDiscountAmount(0);
    setTaxPercent(0);
    setOrderNotes('');
    setActiveJobId(null);
    setActiveJobNumber(null);
    setJobTitle('');
    setItemSearch('');
  };

  // Complete & Place Order (Final checkout)
  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cart.length === 0) {
      showError('Cart is Empty', 'Please select at least one product or service to checkout.');
      return;
    }
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch in the header.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
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
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          variant: item.variant,
          assignedStaffId: item.assignedStaffId,
        })),
        tax: calculatedTax,
        discount: discountAmount,
        status: 'confirmed',
        paymentStatus,
        paymentMethod,
        notes: orderNotes.trim() || undefined,
        isJob: false,
      };

      if (activeJobId) {
        // Finalizing existing job
        await api.put(`/orders/${activeJobId}`, payload);
        showSuccess('Order Finalized', `Job #${activeJobNumber || activeJobId} has been completed successfully.`);
      } else {
        // Creating new order
        await api.post('/orders', payload);
        showSuccess('Order Placed Successfully', `Order for ${customerName} processed and inventory updated.`);
      }

      setShowPOSModal(false);
      resetPOSForm();
      await loadData();
    } catch (err: any) {
      showError('Order Placement Failed', err?.message || 'Could not process order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save as Job (Draft / Hold / Park Order)
  const handleSaveJob = async () => {
    if (cart.length === 0) {
      showError('Cart is Empty', 'Please select at least one item before parking this order as a Job.');
      return;
    }
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch.');
      return;
    }

    const defaultTitle = jobTitle.trim() || `Job - ${customerName} (${cart.length} items)`;

    try {
      setIsSubmitting(true);
      const payload = {
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
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          variant: item.variant,
          assignedStaffId: item.assignedStaffId,
        })),
        tax: calculatedTax,
        discount: discountAmount,
        status: 'draft',
        paymentStatus: 'unpaid',
        paymentMethod,
        notes: orderNotes.trim() || undefined,
        isJob: true,
        jobTitle: defaultTitle,
      };

      if (activeJobId) {
        await api.put(`/orders/${activeJobId}`, payload);
        showSuccess('Job Updated', `Job #${activeJobNumber || activeJobId} updated and remains parked.`);
      } else {
        await api.post('/orders', payload);
        showSuccess('Job Parked Successfully', `Order parked as "${defaultTitle}". Staff can resume and complete this order anytime.`);
      }

      setShowPOSModal(false);
      resetPOSForm();
      await loadData();
    } catch (err: any) {
      showError('Job Save Failed', err?.message || 'Could not park order as Job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resume Job in POS
  const handleResumeJob = (job: Order) => {
    setActiveJobId(job.id);
    setActiveJobNumber(job.orderNumber);
    setJobTitle(job.jobTitle || '');
    setSelectedCustomerId(job.customerId || 'walkin');
    setCustomerName(job.customerName);
    setCustomerPhone(job.customerPhone || '');
    setDiscountAmount(job.discount || 0);
    setOrderNotes(job.notes || '');

    // Restore line items with custom unit prices and batch selections
    const restoredCart: CartItem[] = job.items.map(it => {
      const product = products.find(p => p.id === it.itemId);
      const batch = product?.batches?.find(b => b.id === it.batchId);
      return {
        type: it.type,
        id: it.itemId,
        name: it.name,
        sku: it.sku,
        originalPrice: it.unitPrice,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        batchId: it.batchId,
        batchNumber: it.batchNumber,
        variant: it.variant,
        assignedStaffId: it.assignedStaffId,
        assignedStaffName: it.assignedStaffName,
        maxQuantity: batch ? batch.quantity : undefined,
      };
    });

    setCart(restoredCart);
    setShowJobsModal(false);
    setSelectedOrderDetails(null);
    setShowPOSModal(true);
  };

  // Direct Complete Job from List
  const handleCompleteJobDirect = async (job: Order) => {
    try {
      await api.patch(`/orders/${job.id}/status`, {
        status: 'completed',
        paymentStatus: 'paid',
      });
      showSuccess('Job Completed', `Job #${job.orderNumber} has been finalized. Inventory deducted.`);
      await loadData();
    } catch (err: any) {
      showError('Completion Failed', err?.message || 'Could not complete job.');
    }
  };

  // Discard / Delete Job
  const handleDiscardJob = (job: Order) => {
    showConfirm(
      'Discard Parked Job',
      `Are you sure you want to permanently discard Job #${job.orderNumber}?`,
      async () => {
        try {
          await api.delete(`/orders/${job.id}`);
          showSuccess('Job Discarded', `Job #${job.orderNumber} was deleted.`);
          await loadData();
        } catch (err: any) {
          showError('Discard Failed', err?.message || 'Could not discard job.');
        }
      },
      'Discard Job',
      true
    );
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
      showError('Status Update Failed', err?.message || 'Could not update order status.');
    }
  };

  // Extract all categories
  const productCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const parkedJobs = orders.filter(o => o.isJob || o.status === 'draft');

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'jobs') {
      if (!o.isJob && o.status !== 'draft') return false;
    } else if (statusFilter !== 'all' && o.status !== statusFilter) {
      return false;
    }

    if (paymentStatusFilter !== 'all' && o.paymentStatus !== paymentStatusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.jobTitle && o.jobTitle.toLowerCase().includes(q))
    );
  });

  // Filter items in POS Catalog
  const displayedProducts = products.filter(p => {
    if (activeTab === 'services') return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const displayedServices = services.filter(s => {
    if (activeTab === 'products') return false;
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management & POS Terminal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track order lifecycles, fulfill sales, manage draft jobs, and process checkout seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Parked Jobs Quick Access */}
          <button
            onClick={() => setShowJobsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl shadow-2xs transition-all active:scale-[0.98]"
          >
            <Clock className="h-4 w-4 text-amber-600" />
            <span>Parked Jobs</span>
            {parkedJobs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                {parkedJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              resetPOSForm();
              setShowPOSModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Open POS Terminal
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders, jobs, customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'jobs', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all capitalize ${
                statusFilter === st
                  ? st === 'jobs'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {st === 'jobs' ? `Jobs (${parkedJobs.length})` : st}
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
                <th className="py-3.5 px-6">Order / Job ID</th>
                <th className="py-3.5 px-6">Customer / Title</th>
                <th className="py-3.5 px-6">Items Summary</th>
                <th className="py-3.5 px-6">Total Amount</th>
                <th className="py-3.5 px-6">Payment</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Loading orders...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">No orders or jobs found matching criteria.</td></tr>
              ) : (
                filteredOrders.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrderDetails(o)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                      #{o.orderNumber}
                      {o.isJob && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                          Job
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{o.customerName}</p>
                      {o.jobTitle && <p className="text-[11px] font-medium text-indigo-600 italic truncate max-w-[160px]">{o.jobTitle}</p>}
                      <p className="text-[11px] text-slate-400">{o.customerPhone || '-'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-800">{o.items.length} items</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        {o.items.map(i => i.name + (i.batchNumber ? ` (#${i.batchNumber})` : '')).join(', ')}
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
                            : o.status === 'draft'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : o.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : o.status === 'confirmed' || o.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : o.status === 'ready'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className="capitalize">{o.status === 'draft' ? 'Parked Job' : o.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {o.isJob || o.status === 'draft' ? (
                          <button
                            onClick={() => handleResumeJob(o)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" /> Resume
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedOrderDetails(o)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
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

      {/* ORDER DETAILS MODAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg font-mono">
                    {selectedOrderDetails.isJob ? 'Job' : 'Order'} #{selectedOrderDetails.orderNumber}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    selectedOrderDetails.status === 'draft'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {selectedOrderDetails.status === 'draft' ? 'Parked Job' : selectedOrderDetails.status}
                  </span>
                </div>
                {selectedOrderDetails.jobTitle && (
                  <p className="text-xs font-semibold text-indigo-600 mt-0.5">{selectedOrderDetails.jobTitle}</p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">
                  Placed on {formatDate(selectedOrderDetails.createdAt)} &bull; Branch: {selectedOrderDetails.branchName || activeBranch?.name || 'Main Branch'}
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
                    <th className="py-2.5 px-4">Batch Details</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
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
                      <td className="py-3 px-4">
                        {item.batchNumber ? (
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-[10px] font-mono font-semibold">
                            Batch #{item.batchNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  <Printer className="h-4 w-4" /> Print Order
                </button>

                {selectedOrderDetails.isJob && (
                  <button
                    type="button"
                    onClick={() => handleResumeJob(selectedOrderDetails)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-xs shadow-2xs transition-colors"
                  >
                    <Play className="h-4 w-4" /> Resume in POS
                  </button>
                )}
              </div>

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

      {/* PARKED ORDER JOBS MODAL / DRAWER */}
      {showJobsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[88vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Parked Order Jobs (Draft Orders)</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Retrieve in-progress orders, resume billing, or finalize and complete when ready.
                </p>
              </div>
              <button
                onClick={() => setShowJobsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {parkedJobs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Bookmark className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">No Parked Jobs</p>
                <p className="text-xs">Create or park orders anytime from the POS terminal.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parkedJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600 text-sm">#{job.orderNumber}</span>
                        {job.jobTitle && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                            {job.jobTitle}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-xs">{job.customerName} &bull; <span className="text-slate-500 font-normal">{job.customerPhone || 'Walk-in'}</span></p>
                      <p className="text-[11px] text-slate-400">
                        {job.items.length} items ({job.items.map(i => i.name).join(', ')}) &bull; Parked on {formatDate(job.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right sm:mr-2">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Total</span>
                        <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(job.totalAmount)}</span>
                      </div>

                      <button
                        onClick={() => handleResumeJob(job)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs active:scale-95 transition-all"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume in POS
                      </button>

                      <button
                        onClick={() => handleCompleteJobDirect(job)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold active:scale-95 transition-all"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Complete
                      </button>

                      <button
                        onClick={() => handleDiscardJob(job)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Discard Job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowJobsModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STREAMLINED POS MODAL WITH FULLSCREEN & 2-COLUMN LAYOUT */}
      {showPOSModal && (
        <div
          ref={posContainerRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-900/40 backdrop-blur-xs flex flex-col p-2 sm:p-3 animate-in fade-in duration-150'
              : 'fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150'
          }
        >
          <div
            className={
              isFullscreen
                ? 'bg-white rounded-2xl w-full h-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden'
                : 'bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden'
            }
          >
            {/* POS Top Header Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/90 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Point of Sale (POS) Terminal</h2>
                    {activeJobId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Editing Job #{activeJobNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Active Branch: <span className="font-semibold text-indigo-600">{activeBranch?.name || 'Default Branch'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Parked Jobs Toggle */}
                <button
                  type="button"
                  onClick={() => setShowJobsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span>Parked Jobs</span>
                  {parkedJobs.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                      {parkedJobs.length}
                    </span>
                  )}
                </button>

                {/* Dedicated Full Screen Mode Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen Mode'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    isFullscreen
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-indigo-600" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-600" />}
                  <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
                </button>

                {/* Close (X) Button */}
                <button
                  type="button"
                  onClick={() => setShowPOSModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/80 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Main POS 2-Column Interface */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* LEFT COLUMN: Item Catalog Browser (~60% width) */}
              <div className="flex-1 flex flex-col border-r border-slate-200/80 overflow-hidden bg-slate-50/40 p-4 space-y-3">
                {/* Search and Tab Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Quick item search by name or SKU..."
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                    {itemSearch && (
                      <button
                        onClick={() => setItemSearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                        activeTab === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({products.length + services.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('products')}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                        activeTab === 'products' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Products ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                        activeTab === 'services' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Services ({services.length})
                    </button>
                  </div>
                </div>

                {/* Category Filter Chips */}
                {activeTab !== 'services' && productCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                        selectedCategory === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Categories
                    </button>
                    {productCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Catalog Items Grid (Scrollable) */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {/* Products */}
                    {displayedProducts.map(p => {
                      const activeBatches = (p.batches || []).filter(b => b.status === 'active' && b.quantity > 0);
                      const displayPrice = activeBatches.length > 0 ? activeBatches[0].sellingPrice : p.sellingPrice;

                      return (
                        <div
                          key={`prod-${p.id}`}
                          onClick={() => addProductToCart(p)}
                          className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-2xs hover:shadow-xs group active:scale-[0.98]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                                Product
                              </span>
                              {activeBatches.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-semibold flex items-center gap-0.5">
                                  <Layers className="h-2.5 w-2.5" /> {activeBatches.length} {activeBatches.length === 1 ? 'batch' : 'batches'}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Unit Price</span>
                              <span className="font-extrabold text-indigo-600 text-xs">
                                {formatCurrency(displayPrice)}
                              </span>
                            </div>
                            <span className="h-6 w-6 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Services */}
                    {displayedServices.map(s => (
                      <div
                        key={`serv-${s.id}`}
                        onClick={() => addServiceToCart(s)}
                        className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-2xs hover:shadow-xs group active:scale-[0.98]"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[9px] font-bold uppercase tracking-wider">
                              Service
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {s.durationMinutes} mins
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{s.category}</p>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Rate</span>
                            <span className="font-extrabold text-indigo-600 text-xs">
                              {formatCurrency(s.price)}
                            </span>
                          </div>
                          <span className="h-6 w-6 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    ))}

                    {displayedProducts.length === 0 && displayedServices.length === 0 && (
                      <div className="col-span-full py-16 text-center text-slate-400">
                        <Package className="h-8 w-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                        <p className="text-xs font-semibold text-slate-600">No items match your query</p>
                        <p className="text-[11px]">Try adjusting the search filter or category selection.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Active Cart & Terminal Register (~40% width) */}
              <div className="w-full md:w-[420px] lg:w-[460px] flex flex-col bg-white overflow-hidden shrink-0 border-t md:border-t-0 border-slate-200">
                {/* Customer Information Section */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 text-xs shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <User className="h-3.5 w-3.5 text-indigo-600" /> Customer Account
                    </span>
                    <select
                      value={selectedCustomerId}
                      onChange={e => handleCustomerSelect(e.target.value)}
                      className="text-xs p-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="walkin">Walk-in Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Contact Phone"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Cart Items Header */}
                <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
                  <span>Cart Items ({cart.length})</span>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-rose-500 hover:text-rose-700 text-[11px] font-semibold"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Cart Line Items (Scrollable List with Batch & Editable Pricing) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                      <ShoppingCart className="h-10 w-10 text-slate-200 stroke-[1.5]" />
                      <p className="text-xs font-semibold text-slate-600">Cart is empty</p>
                      <p className="text-[11px] text-slate-400 max-w-[200px]">
                        Click on any product or service from the catalog to add it to this checkout ticket.
                      </p>
                    </div>
                  ) : (
                    cart.map((item, idx) => {
                      const product = item.type === 'product' ? products.find(p => p.id === item.id) : null;
                      const activeBatches = (product?.batches || []).filter(b => b.status === 'active' && b.quantity > 0);
                      const isPriceOverridden = item.unitPrice !== item.originalPrice;

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-2 text-xs"
                        >
                          {/* Row 1: Item Name, Category badge, and Delete */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-bold text-slate-900 leading-snug">{item.name}</p>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                {item.type} {item.sku ? `&bull; SKU: ${item.sku}` : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Row 2: Batch Selection (For Products with Batches) */}
                          {item.type === 'product' && activeBatches.length > 0 && (
                            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/80 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                                <span className="flex items-center gap-1">
                                  <Layers className="h-3 w-3 text-amber-600" /> Select Inventory Batch:
                                </span>
                                {item.batchNumber && (
                                  <span className="text-indigo-600 font-mono">Active: #{item.batchNumber}</span>
                                )}
                              </div>
                              <select
                                value={item.batchId || ''}
                                onChange={e => handleSelectBatch(idx, e.target.value)}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-200 rounded-md font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="">Main Catalog Price ({formatCurrency(product?.sellingPrice || 0)})</option>
                                {activeBatches.map(b => (
                                  <option key={b.id} value={b.id}>
                                    Batch #{b.batchNumber} &bull; {formatCurrency(b.sellingPrice)} (Stock: {b.quantity}
                                    {b.expiryDate ? ` | Exp: ${formatDate(b.expiryDate)}` : ''})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Row 3: Direct Editable Unit Price & Quantity Stepper */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            {/* Editable Unit Price Input */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Unit Price:</span>
                                {isPriceOverridden && (
                                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                    Override
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus-within:bg-white focus-within:border-indigo-500 shadow-2xs">
                                <span className="text-slate-400 font-medium text-xs">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={e => handleUpdateUnitPrice(idx, parseFloat(e.target.value) || 0)}
                                  className="w-20 font-bold text-slate-800 bg-transparent text-xs focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Quantity Controls & Line Total */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(idx, -1)}
                                  className="p-1 bg-white hover:bg-slate-200 rounded text-slate-700 shadow-2xs transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="font-bold w-6 text-center text-xs">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(idx, 1)}
                                  className="p-1 bg-white hover:bg-slate-200 rounded text-slate-700 shadow-2xs transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              <div className="text-right min-w-[65px]">
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {formatCurrency(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Checkout Register Drawer (Sticky Bottom) */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3 text-xs shrink-0">
                  {/* Discount, Tax & Optional Job Title */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Discount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={discountAmount}
                        onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Tax (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={taxPercent}
                        onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)}
                        placeholder="0%"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Payment Method Pills */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Payment Method</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['cash', 'card', 'bank_transfer', 'online'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize border transition-all ${
                            paymentMethod === m
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order Totals Summary */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1 font-medium">
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(cartSubtotal)}</span>
                    </div>
                    {calculatedTax > 0 && (
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>Tax ({taxPercent}%):</span>
                        <span className="font-semibold text-slate-700">+{formatCurrency(calculatedTax)}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 text-xs">
                        <span>Discount:</span>
                        <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-100">
                      <span>Grand Total:</span>
                      <span className="text-base text-indigo-600">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>

                  {/* Dual Action Buttons: Save as Job & Complete Order */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveJob}
                      disabled={isSubmitting || cart.length === 0}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold shadow-2xs active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Bookmark className="h-3.5 w-3.5 text-amber-700" />
                      <span>{activeJobId ? 'Update Job' : 'Park as Job'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCreateOrder()}
                      disabled={isSubmitting || cart.length === 0}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isSubmitting ? 'Processing...' : 'Complete & Charge'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
