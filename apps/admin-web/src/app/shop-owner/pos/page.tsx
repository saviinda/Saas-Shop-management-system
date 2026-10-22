'use client';

import React, { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';
import { Order, Product, ProductBatch, ServiceItem, Customer, OrderPaymentStatus } from '@saas/types';
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
  Layers,
  ArrowRight,
  Lock,
  Unlock,
  UserPlus,
  Calendar,
  AlertTriangle,
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

function PosTerminalContent() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const { showSuccess, showError, showConfirm } = useModal();
  const searchParams = useSearchParams();
  const resumeJobId = searchParams?.get('resumeJobId');
  const hasAutoResumedRef = useRef(false);

  // Catalog Data
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [parkedJobs, setParkedJobs] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const posContainerRef = useRef<HTMLDivElement>(null);

  // POS Catalog Filters
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walkin');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Cart & Sale State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>('paid');
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Resumed Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobNumber, setActiveJobNumber] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');

  // Modals State
  const [showJobsModal, setShowJobsModal] = useState(false);
  const [batchModalProduct, setBatchModalProduct] = useState<Product | null>(null);
  const [selectedBatchForAdd, setSelectedBatchForAdd] = useState<ProductBatch | null>(null);
  const [batchQuantity, setBatchQuantity] = useState(1);

  // Check if current user is authorized to override prices
  const canOverridePrice = useMemo(() => {
    if (!user) return false;
    if (user.role === 'shop_owner' || user.role === 'super_admin' || user.role === 'manager') return true;
    const permissions = user.permissions || [];
    return permissions.includes('price_override') || permissions.includes('orders_override_price');
  }, [user]);

  // Load Catalog, Customers & Parked Jobs
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prdRes, srvRes, custRes, jobsRes] = await Promise.all([
        api.get<Product[]>('/products', { branchId: activeBranch?.id }),
        api.get<ServiceItem[]>('/services'),
        api.get<Customer[]>('/customers'),
        api.get<Order[]>('/orders', {
          branchId: activeBranch?.id,
          status: 'draft',
          limit: 'all',
        }),
      ]);

      setProducts(prdRes.data || []);
      setServices(srvRes.data || []);
      setCustomers(custRes.data || []);
      setParkedJobs(jobsRes.data || []);

      if (resumeJobId && !hasAutoResumedRef.current) {
        hasAutoResumedRef.current = true;
        const targetJob = (jobsRes.data || []).find(j => j.id === resumeJobId);
        if (targetJob) {
          handleResumeJob(targetJob, prdRes.data || []);
        } else {
          try {
            const single = await api.get<Order>(`/orders/${resumeJobId}`);
            if (single.data) {
              handleResumeJob(single.data, prdRes.data || []);
            }
          } catch (e) {
            console.error('Could not load specific resumed job:', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load POS data:', err);
      showError('Load Error', 'Failed to retrieve inventory or catalog items.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // Fullscreen Listener
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
      setIsFullscreen(prev => !prev);
    }
  };

  // Customer Selection & Quick Add
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'walkin') return null;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim() || !newCustomerForm.phone.trim()) {
      showError('Validation Error', 'Customer name and phone number are required.');
      return;
    }

    try {
      setIsSavingCustomer(true);
      const res = await api.post<Customer>('/customers', {
        name: newCustomerForm.name.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim() || undefined,
        address: newCustomerForm.address.trim() || undefined,
      });

      const createdCustomer = res.data;
      setCustomers(prev => [createdCustomer, ...prev]);
      // Auto-select the newly registered customer without clearing the cart!
      setSelectedCustomerId(createdCustomer.id);
      setShowNewCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', email: '', address: '' });
      showSuccess('Customer Added', `Customer "${createdCustomer.name}" registered and assigned to this sale.`);
    } catch (err: any) {
      showError('Registration Failed', err.message || 'Could not register customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Product Selection & Batch Handling
  const handleProductCardClick = (product: Product) => {
    const activeBatches = (product.batches || []).filter(b => b.status === 'active' && b.quantity > 0);

    // If product has multiple batches with different prices (or multiple active batches)
    if (activeBatches.length > 1) {
      setBatchModalProduct(product);
      setSelectedBatchForAdd(activeBatches[0]);
      setBatchQuantity(1);
      return;
    }

    // Single active batch or standard catalog item
    const batch = activeBatches.length === 1 ? activeBatches[0] : null;
    const initialPrice = batch ? batch.sellingPrice : product.sellingPrice;
    const batchId = batch ? batch.id : undefined;
    const batchNumber = batch ? batch.batchNumber : undefined;
    const maxStock = batch ? batch.quantity : product.currentStock;

    if (typeof maxStock === 'number' && maxStock <= 0) {
      showError('Out of Stock', `Product "${product.name}" is currently out of stock in this branch.`);
      return;
    }

    const existingIndex = cart.findIndex(
      c => c.type === 'product' && c.id === product.id && c.batchId === batchId
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + 1;
      if (typeof maxStock === 'number' && newQty > maxStock) {
        showError('Stock Limit', `Only ${maxStock} units available in stock.`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'product',
          id: product.id,
          name: product.name,
          sku: product.sku,
          originalPrice: initialPrice,
          unitPrice: initialPrice,
          quantity: 1,
          batchId,
          batchNumber,
          maxQuantity: maxStock,
        },
      ]);
    }
  };

  const handleConfirmBatchSelection = () => {
    if (!batchModalProduct || !selectedBatchForAdd) return;

    if (batchQuantity > selectedBatchForAdd.quantity) {
      showError('Insufficient Batch Stock', `Only ${selectedBatchForAdd.quantity} units available in Batch #${selectedBatchForAdd.batchNumber}.`);
      return;
    }

    const existingIndex = cart.findIndex(
      c => c.type === 'product' && c.id === batchModalProduct.id && c.batchId === selectedBatchForAdd.id
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + batchQuantity;
      if (newQty > selectedBatchForAdd.quantity) {
        showError('Insufficient Batch Stock', `Cannot exceed available batch quantity of ${selectedBatchForAdd.quantity}.`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'product',
          id: batchModalProduct.id,
          name: batchModalProduct.name,
          sku: batchModalProduct.sku,
          originalPrice: selectedBatchForAdd.sellingPrice,
          unitPrice: selectedBatchForAdd.sellingPrice,
          quantity: batchQuantity,
          batchId: selectedBatchForAdd.id,
          batchNumber: selectedBatchForAdd.batchNumber,
          maxQuantity: selectedBatchForAdd.quantity,
        },
      ]);
    }

    setBatchModalProduct(null);
    setSelectedBatchForAdd(null);
    setBatchQuantity(1);
  };

  const addServiceToCart = (service: ServiceItem) => {
    const existingIndex = cart.findIndex(c => c.type === 'service' && c.id === service.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          type: 'service',
          id: service.id,
          name: service.name,
          originalPrice: service.price,
          unitPrice: service.price,
          quantity: 1,
          assignedStaffId: service.assignedStaffIds?.[0],
        },
      ]);
    }
  };

  // Cart Adjustments
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
      setCart(updated);
      return;
    }

    if (typeof item.maxQuantity === 'number' && newQty > item.maxQuantity) {
      showError('Stock Limit Reached', `Only ${item.maxQuantity} units available.`);
      return;
    }

    item.quantity = newQty;
    setCart(updated);
  };

  const handleUpdateUnitPrice = (cartIndex: number, newPrice: number) => {
    if (!canOverridePrice) {
      showError('Unauthorized', 'Price override requires manager or shop owner authorization.');
      return;
    }
    const updated = [...cart];
    updated[cartIndex].unitPrice = Math.max(0, newPrice);
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const resetPOSForm = () => {
    setCart([]);
    setSelectedCustomerId('walkin');
    setDiscountAmount(0);
    setTaxPercent(0);
    setOrderNotes('');
    setActiveJobId(null);
    setActiveJobNumber(null);
    setJobTitle('');
    setItemSearch('');
  };

  // Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const calculatedTax = (cartSubtotal * taxPercent) / 100;
  const cartTotal = Math.max(0, cartSubtotal + calculatedTax - discountAmount);

  // Complete Order
  const handleCompleteOrder = async () => {
    if (cart.length === 0) {
      showError('Cart is Empty', 'Please select at least one item to proceed.');
      return;
    }
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch in the navigation header.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        branchId: activeBranch.id,
        customerId: selectedCustomerId !== 'walkin' ? selectedCustomerId : undefined,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        customerPhone: selectedCustomer ? selectedCustomer.phone : undefined,
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
        status: 'completed',
        paymentStatus: paymentStatus || 'paid',
        paymentMethod,
        notes: orderNotes.trim() || undefined,
        isJob: false,
      };

      if (activeJobId) {
        await api.put(`/orders/${activeJobId}`, payload);
        showSuccess('Order Completed', `Job #${activeJobNumber || activeJobId} finalized and charged successfully.`);
      } else {
        await api.post('/orders', payload);
        showSuccess('Order Placed', `Sale processed successfully. Receipt generated.`);
      }

      resetPOSForm();
      await loadData();
    } catch (err: any) {
      showError('Checkout Failed', err.message || 'Could not complete order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Park Order as Job
  const handleParkJob = async () => {
    if (cart.length === 0) {
      showError('Cart is Empty', 'Please add items before parking this sale as a job.');
      return;
    }
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch.');
      return;
    }

    const defaultTitle = jobTitle.trim() || `Job - ${selectedCustomer ? selectedCustomer.name : 'Walk-in'} (${cart.length} items)`;

    try {
      setIsSubmitting(true);
      const payload = {
        branchId: activeBranch.id,
        customerId: selectedCustomerId !== 'walkin' ? selectedCustomerId : undefined,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        customerPhone: selectedCustomer ? selectedCustomer.phone : undefined,
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
        showSuccess('Job Updated', `Parked job #${activeJobNumber || activeJobId} updated.`);
      } else {
        await api.post('/orders', payload);
        showSuccess('Sale Parked', `Order saved as "${defaultTitle}". You can resume it anytime.`);
      }

      resetPOSForm();
      await loadData();
    } catch (err: any) {
      showError('Park Job Failed', err.message || 'Could not park sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resume Parked Job
  const handleResumeJob = (job: Order, catalogProducts?: Product[]) => {
    setActiveJobId(job.id);
    setActiveJobNumber(job.orderNumber);
    setJobTitle(job.jobTitle || '');
    setSelectedCustomerId(job.customerId && job.customerId !== 'walkin' ? job.customerId : 'walkin');
    setDiscountAmount(job.discount || 0);
    setTaxPercent(job.tax && job.subtotal ? Math.round((job.tax / job.subtotal) * 100) : 0);
    setPaymentMethod((job.paymentMethod as any) || 'cash');
    setPaymentStatus('paid');
    setOrderNotes(job.notes || '');

    const prods = catalogProducts || products;

    // Restore items
    const restoredCart: CartItem[] = job.items.map(it => {
      const product = prods.find(p => p.id === it.itemId);
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
        maxQuantity: batch ? batch.quantity : product?.currentStock,
      };
    });

    setCart(restoredCart);
    setShowJobsModal(false);
    showSuccess('Job Resumed', `Parked Job #${job.orderNumber} loaded into checkout terminal.`);
  };

  // Discard Job
  const handleDiscardJob = (job: Order) => {
    showConfirm(
      'Discard Parked Job',
      `Are you sure you want to delete parked job #${job.orderNumber}?`,
      async () => {
        try {
          await api.delete(`/orders/${job.id}`);
          showSuccess('Job Deleted', `Parked job #${job.orderNumber} removed.`);
          await loadData();
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete job.');
        }
      },
      'Discard Job',
      true
    );
  };

  // Extract Categories
  const productCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  }, [products]);

  const displayedProducts = useMemo(() => {
    return products.filter(p => {
      if (activeTab === 'services') return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!itemSearch) return true;
      const q = itemSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, activeTab, selectedCategory, itemSearch]);

  const displayedServices = useMemo(() => {
    return services.filter(s => {
      if (activeTab === 'products') return false;
      if (!itemSearch) return true;
      const q = itemSearch.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });
  }, [services, activeTab, itemSearch]);

  return (
    <div
      ref={posContainerRef}
      className={`flex flex-col bg-slate-100 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen p-2 overflow-hidden' : 'space-y-4 max-w-7xl mx-auto'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Point of Sale (POS) Terminal</h1>
              {activeJobId && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Resumed Job #{activeJobNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>Active Branch:</span>
              <span className="font-semibold text-indigo-600 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {activeBranch?.name || 'Default Branch'}
              </span>
              <span>&bull;</span>
              <span>Cashier:</span>
              <span className="font-medium text-slate-700">{user?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Parked Jobs Modal Button */}
          <button
            type="button"
            onClick={() => setShowJobsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Parked Jobs</span>
            {parkedJobs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                {parkedJobs.length}
              </span>
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all active:scale-95"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-indigo-600" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-600" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>

          {activeJobId && (
            <button
              type="button"
              onClick={resetPOSForm}
              className="flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Cancel Job
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Grid: 2-Column Responsive Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isFullscreen ? 'flex-1 overflow-hidden' : ''}`}>
        {/* LEFT COLUMN: Catalog Browser & Search (7 Cols on desktop) */}
        <div className={`lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3 ${isFullscreen ? 'overflow-hidden' : ''}`}>
          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Items
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('products');
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'products' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('services');
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'services' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Services
              </button>
            </div>

            {/* Product Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills (Requirement 1.6) */}
          {activeTab !== 'services' && productCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all text-xs cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Categories
              </button>
              {productCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all text-xs cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Catalog Items Grid (Scrollable) */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-[360px]">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="text-xs">Loading branch catalog...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {/* Products */}
                {displayedProducts.map(p => {
                  const activeBatches = (p.batches || []).filter(b => b.status === 'active' && b.quantity > 0);
                  const displayPrice = activeBatches.length > 0 ? activeBatches[0].sellingPrice : p.sellingPrice;
                  const isOutOfStock = typeof p.currentStock === 'number' && p.currentStock <= 0;

                  return (
                    <div
                      key={`prod-${p.id}`}
                      onClick={() => !isOutOfStock && handleProductCardClick(p)}
                      className={`p-3 bg-white border rounded-xl flex flex-col justify-between transition-all duration-150 select-none ${
                        isOutOfStock
                          ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                          : 'border-slate-200/90 hover:border-indigo-400 hover:shadow-xs cursor-pointer active:scale-[0.98] group'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                            Product
                          </span>
                          {activeBatches.length > 1 && (
                            <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-semibold flex items-center gap-0.5">
                              <Layers className="h-2.5 w-2.5" /> {activeBatches.length} batches
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Unit Price</span>
                          <span className="font-extrabold text-indigo-600 text-xs">
                            {formatCurrency(displayPrice)}
                          </span>
                          {typeof p.currentStock === 'number' && (
                            <span className={`block text-[9px] font-medium ${p.currentStock <= 5 ? 'text-amber-600' : 'text-slate-400'}`}>
                              Stock: {p.currentStock}
                            </span>
                          )}
                        </div>

                        <span className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                          isOutOfStock
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white'
                        }`}>
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
                    className="p-3 bg-white hover:bg-purple-50/40 border border-slate-200/90 hover:border-purple-300 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-2xs hover:shadow-xs group active:scale-[0.98] select-none"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[9px] font-bold uppercase tracking-wider">
                          Service
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2 leading-tight group-hover:text-purple-600 transition-colors">
                        {s.name}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s.category}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Rate</span>
                        <span className="font-extrabold text-purple-600 text-xs">
                          {formatCurrency(s.price)}
                        </span>
                      </div>
                      <span className="h-7 w-7 rounded-lg bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white flex items-center justify-center transition-all">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                ))}

                {displayedProducts.length === 0 && displayedServices.length === 0 && (
                  <div className="col-span-full py-16 text-center text-slate-400">
                    <Package className="h-8 w-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-slate-600">No items found matching criteria</p>
                    <p className="text-[11px]">Try selecting another category or searching for a different keyword.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Cart, Customer & Checkout Drawer (5 Cols on desktop) */}
        <div className={`lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
          {/* Customer Selection Header (Requirement 1.2 & 1.3) */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5 text-indigo-600" /> Customer Account
              </span>

              {/* Quick Add Customer Button (+) */}
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                title="Register New Customer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Customer
              </button>
            </div>

            {/* Searchable Customer Combobox / Selector */}
            <div className="relative">
              <div
                onClick={() => setShowCustomerDropdown(prev => !prev)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-colors shadow-2xs"
              >
                <span className="truncate">
                  {selectedCustomerId === 'walkin' ? (
                    <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                      <Tag className="h-3 w-3 text-slate-400" /> Walk-in Customer (Default)
                    </span>
                  ) : (
                    <span className="font-bold text-indigo-600">
                      {selectedCustomer?.name} ({selectedCustomer?.phone})
                    </span>
                  )}
                </span>
                <span className="text-slate-400 text-[10px]">Change</span>
              </div>

              {/* Searchable Customer Dropdown Popup */}
              {showCustomerDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 space-y-1.5 max-h-60 overflow-y-auto">
                  <div className="relative mb-1">
                    <Search className="h-3 w-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Type name or phone number..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-indigo-500"
                      autoFocus
                    />
                  </div>

                  <div
                    onClick={() => handleSelectCustomer('walkin')}
                    className={`p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      selectedCustomerId === 'walkin' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Walk-in Customer (Default)
                  </div>

                  {filteredCustomers.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust.id)}
                      className={`p-2 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-between ${
                        selectedCustomerId === cust.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{cust.name}</p>
                        <p className="text-[10px] text-slate-400">{cust.phone} {cust.email ? `&bull; ${cust.email}` : ''}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {cust.totalOrdersCount || 0} orders
                      </span>
                    </div>
                  ))}

                  {filteredCustomers.length === 0 && (
                    <p className="p-3 text-center text-xs text-slate-400">No registered customers match query.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Card or Walk-in Restrictions (Requirement 1.2) */}
            {selectedCustomerId === 'walkin' ? (
              <div className="px-3 py-2 bg-slate-100/80 rounded-xl text-[11px] text-slate-500 flex items-center justify-between border border-slate-200/60">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                  Default Walk-in Customer (Details not editable)
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                  Anonymous
                </span>
              </div>
            ) : selectedCustomer ? (
              <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100/70 font-semibold px-1.5 py-0.2 rounded">
                    Registered Client
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" /> {selectedCustomer.phone}
                  </span>
                  <span>Total Spent: {formatCurrency(selectedCustomer.totalSpent || 0)}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Cart Items Header */}
          <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
            <span className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-indigo-600" />
              Cart Items ({cart.length})
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-rose-500 hover:text-rose-700 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px]">
            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                <ShoppingCart className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-600">Cart is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[220px]">
                  Click products or services from the catalog on the left to start a sale.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isPriceOverridden = item.unitPrice !== item.originalPrice;

                return (
                  <div
                    key={`${item.type}-${item.id}-${item.batchId || 'def'}-${idx}`}
                    className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-2 text-xs"
                  >
                    {/* Item Name & Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 leading-snug">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {item.type} {item.sku ? `&bull; SKU: ${item.sku}` : ''}
                          </span>
                          {item.batchNumber && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-mono font-medium">
                              Batch #{item.batchNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Price Override & Stepper Controls (Requirement 1.5) */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      {/* Price Control with Authorization Check */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Unit Price:</span>
                          {isPriceOverridden && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              Overridden
                            </span>
                          )}
                        </div>
                        <div
                          className={`flex items-center gap-1 border rounded-lg px-2 py-1 transition-all shadow-2xs ${
                            canOverridePrice
                              ? 'bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-indigo-500'
                              : 'bg-slate-100 border-slate-200 opacity-80 cursor-not-allowed'
                          }`}
                        >
                          <span className="text-slate-400 font-medium text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!canOverridePrice}
                            value={item.unitPrice}
                            onChange={e => handleUpdateUnitPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 font-bold text-slate-800 bg-transparent text-xs focus:outline-none disabled:cursor-not-allowed"
                          />
                          {!canOverridePrice && (
                            <span title="Price override requires manager authorization">
                              <Lock className="h-3 w-3 text-slate-400" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, -1)}
                            className="p-1 bg-white hover:bg-slate-200 rounded text-slate-700 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-bold w-6 text-center text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, 1)}
                            className="p-1 bg-white hover:bg-slate-200 rounded text-slate-700 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[70px]">
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

          {/* Checkout Drawer (Sticky Bottom) */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3 text-xs shrink-0">
            {/* Discount & Tax */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Discount (LKR)</label>
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

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Payment Method</label>
              <div className="grid grid-cols-4 gap-1">
                {(['cash', 'card', 'bank_transfer', 'online'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize border transition-all cursor-pointer ${
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

            {/* Action Buttons: Park as Job & Complete Sale */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleParkJob}
                disabled={isSubmitting || cart.length === 0}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold shadow-2xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-700" />
                <span>{activeJobId ? 'Update Parked Job' : 'Park as Job'}</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteOrder}
                disabled={isSubmitting || cart.length === 0}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Processing...' : 'Complete & Charge'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: BATCH & PRICE SELECTION MODAL (Requirement 1.4) */}
      {batchModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold uppercase tracking-wider">
                  Select Batch & Price
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">{batchModalProduct.name}</h3>
                <p className="text-xs text-slate-500 font-mono">SKU: {batchModalProduct.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Available Batches in this Branch</label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(batchModalProduct.batches || [])
                  .filter(b => b.status === 'active' && b.quantity > 0)
                  .map(batch => {
                    const isSelected = selectedBatchForAdd?.id === batch.id;
                    return (
                      <div
                        key={batch.id}
                        onClick={() => setSelectedBatchForAdd(batch)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 font-mono">#{batch.batchNumber}</span>
                            {batch.expiryDate && (
                              <span className="text-[10px] text-slate-400">
                                Exp: {formatDate(batch.expiryDate)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block">
                            Available Stock: <strong className="text-slate-800">{batch.quantity} units</strong>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-extrabold text-sm text-indigo-600">
                            {formatCurrency(batch.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">per unit</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quantity Stepper for Batch */}
            {selectedBatchForAdd && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">Quantity to Add:</span>
                  <span className="text-[10px] text-slate-500">Max {selectedBatchForAdd.quantity} available</span>
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBatchQuantity(q => Math.max(1, q - 1))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-700"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedBatchForAdd.quantity}
                    value={batchQuantity}
                    onChange={e =>
                      setBatchQuantity(Math.min(selectedBatchForAdd.quantity, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="w-12 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchQuantity(q => Math.min(selectedBatchForAdd.quantity, q + 1))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBatchModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchSelection}
                disabled={!selectedBatchForAdd}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-200 disabled:opacity-50"
              >
                Add Batch to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK REGISTER NEW CUSTOMER (Requirement 1.3) */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Register New Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Johnathan Smith"
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="+1 555 123 4567"
                  value={newCustomerForm.phone}
                  onChange={e => setNewCustomerForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={newCustomerForm.email}
                  onChange={e => setNewCustomerForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Street address, city"
                  value={newCustomerForm.address}
                  onChange={e => setNewCustomerForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-200 disabled:opacity-50"
                >
                  {isSavingCustomer ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PARKED JOBS DRAWER/MODAL (Requirement 1.7) */}
      {showJobsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Parked Jobs ({parkedJobs.length})</h3>
                  <p className="text-[11px] text-slate-500">Resume, charge, or manage held customer orders</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJobsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {parkedJobs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Bookmark className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">No Parked Jobs</p>
                <p className="text-xs">Hold sales anytime from the checkout panel using "Park as Job".</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {parkedJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600">#{job.orderNumber}</span>
                        {job.jobTitle && (
                          <span className="px-2 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                            {job.jobTitle}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">
                        {job.customerName} &bull; <span className="text-slate-500 font-normal">{job.customerPhone || 'Walk-in'}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {job.items.length} items ({job.items.map(i => i.name).join(', ')}) &bull; {formatDate(job.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right sm:mr-2">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Total</span>
                        <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(job.totalAmount)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleResumeJob(job)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume in POS
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDiscardJob(job)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Job"
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
    </div>
  );
}

export default function PosTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-100">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <PosTerminalContent />
    </Suspense>
  );
}
