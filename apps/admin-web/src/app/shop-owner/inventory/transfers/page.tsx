'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { useModal } from '@/lib/modal-context';
import { StockTransferRequest, Branch, Product, ProductBatch, InventoryItem } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  XCircle,
  AlertCircle,
  Eye,
  X,
  Building2,
  Boxes,
  FileText,
  RotateCcw,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Calendar,
  User,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { TablePagination } from '@/components/TablePagination';
import { CategorizedFilterBar, FilterCategory } from '@/components/CategorizedFilterBar';

const transferFilterCategories: FilterCategory[] = [
  {
    id: 'status',
    label: 'Transfer Status',
    type: 'select',
    options: [
      { label: 'All Statuses', value: 'all' },
      { label: 'Pending Approval', value: 'pending' },
      { label: 'Approved (Awaiting Dispatch)', value: 'approved' },
      { label: 'Dispatched (In-Transit)', value: 'dispatched' },
      { label: 'Completed (Received)', value: 'completed' },
      { label: 'Rejected', value: 'rejected' },
    ],
  },
  {
    id: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { label: 'All Transfers', value: 'all' },
      { label: 'Incoming to This Branch', value: 'incoming' },
      { label: 'Outgoing from This Branch', value: 'outgoing' },
    ],
  },
];

export default function StockTransferRequestsPage() {
  const { user } = useAuth();
  const { activeBranch, branches } = useBranch();
  const { showSuccess, showError, showConfirm } = useModal();

  const [transfers, setTransfers] = useState<StockTransferRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceInventory, setSourceInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Request Form State
  const [createForm, setCreateForm] = useState({
    sourceBranchId: '',
    destinationBranchId: '',
    productId: '',
    batchId: '',
    quantity: 1,
    reason: 'Inter-branch stock rebalancing',
    notes: '',
  });

  // Receive Form State
  const [receiveForm, setReceiveForm] = useState({
    receivedQuantity: 1,
    notes: '',
  });

  const isManagerOrOwner = useMemo(() => {
    if (!user) return false;
    return user.role === 'shop_owner' || user.role === 'super_admin' || user.role === 'manager';
  }, [user]);

  // Load Transfers
  const loadTransfers = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {
        branchId: activeBranch?.id,
        status: activeFilters.status !== 'all' ? activeFilters.status : undefined,
        type: activeFilters.direction !== 'all' ? activeFilters.direction : undefined,
        search: search.trim() || undefined,
      };

      const [trfRes, prodRes] = await Promise.all([
        api.get<StockTransferRequest[]>('/inventory/transfers', params),
        api.get<Product[]>('/products'),
      ]);

      const data = trfRes.data || [];
      setTransfers(data);
      setTotalCount(data.length);
      setProducts(prodRes.data || []);
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
      showError('Load Failed', err.message || 'Could not load transfer requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [activeBranch, activeFilters, search]);

  // Load Source Branch Inventory when Source Branch Changes in Create Modal
  useEffect(() => {
    if (!createForm.sourceBranchId) return;
    const fetchSourceStock = async () => {
      try {
        const invRes = await api.get<InventoryItem[]>('/inventory', {
          branchId: createForm.sourceBranchId,
        });
        setSourceInventory(invRes.data || []);
      } catch (e) {
        console.error('Failed to load source branch inventory:', e);
      }
    };
    fetchSourceStock();
  }, [createForm.sourceBranchId]);

  // KPI Calculations
  const pendingCount = transfers.filter(t => t.status === 'pending').length;
  const inTransitCount = transfers.filter(t => t.status === 'dispatched').length;
  const completedCount = transfers.filter(t => t.status === 'completed').length;
  const incomingAwaitingAction = transfers.filter(
    t => t.status === 'dispatched' && t.destinationBranchId === activeBranch?.id
  ).length;

  // Selected Product in Create Modal
  const selectedProductInForm = useMemo(() => {
    if (!createForm.productId) return null;
    return products.find(p => p.id === createForm.productId) || null;
  }, [products, createForm.productId]);

  const sourceInvItem = useMemo(() => {
    if (!createForm.productId) return null;
    return sourceInventory.find(i => i.productId === createForm.productId) || null;
  }, [sourceInventory, createForm.productId]);

  // Batches available in source branch for selected product
  const availableBatches = useMemo(() => {
    if (!selectedProductInForm) return [];
    return (selectedProductInForm.batches || []).filter(
      b => b.branchId === createForm.sourceBranchId && b.status === 'active' && b.quantity > 0
    );
  }, [selectedProductInForm, createForm.sourceBranchId]);

  const selectedBatchInForm = useMemo(() => {
    if (!createForm.batchId) return null;
    return availableBatches.find(b => b.id === createForm.batchId) || null;
  }, [availableBatches, createForm.batchId]);

  const maxAvailableStock = useMemo(() => {
    if (selectedBatchInForm) return selectedBatchInForm.quantity;
    if (sourceInvItem) return sourceInvItem.quantity;
    return 0;
  }, [selectedBatchInForm, sourceInvItem]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const destBranches = branches.filter(b => b.id !== activeBranch?.id);
    const initialSource = activeBranch?.id || branches[0]?.id || '';
    const initialDest = destBranches[0]?.id || '';

    setCreateForm({
      sourceBranchId: initialSource,
      destinationBranchId: initialDest,
      productId: '',
      batchId: '',
      quantity: 1,
      reason: 'Inter-branch stock rebalancing',
      notes: '',
    });
    setShowCreateModal(true);
  };

  // Submit Create Request
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.sourceBranchId || !createForm.destinationBranchId) {
      showError('Branches Required', 'Source and destination branches must be specified.');
      return;
    }
    if (createForm.sourceBranchId === createForm.destinationBranchId) {
      showError('Invalid Selection', 'Source and destination branches cannot be the same.');
      return;
    }
    if (!createForm.productId) {
      showError('Product Required', 'Please select a product to transfer.');
      return;
    }
    if (createForm.quantity <= 0) {
      showError('Invalid Quantity', 'Transfer quantity must be at least 1.');
      return;
    }
    if (createForm.quantity > maxAvailableStock) {
      showError(
        'Insufficient Stock',
        `Source branch only has ${maxAvailableStock} units available for this selection.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/inventory/transfers', {
        sourceBranchId: createForm.sourceBranchId,
        destinationBranchId: createForm.destinationBranchId,
        productId: createForm.productId,
        batchId: createForm.batchId || undefined,
        quantity: Number(createForm.quantity),
        reason: createForm.reason.trim() || 'Inter-branch transfer request',
        notes: createForm.notes.trim() || undefined,
      });

      setShowCreateModal(false);
      showSuccess('Request Created', 'Stock transfer request submitted successfully.');
      await loadTransfers();
    } catch (err: any) {
      showError('Creation Failed', err.message || 'Could not create transfer request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve Request
  const handleApprove = async (transfer: StockTransferRequest) => {
    showConfirm(
      'Approve Stock Transfer',
      `Are you sure you want to approve Transfer Request #${transfer.transferNumber}? Once approved, stock can be dispatched from the source branch.`,
      async () => {
        try {
          await api.post(`/inventory/transfers/${transfer.id}/approve`);
          showSuccess('Approved', `Transfer #${transfer.transferNumber} approved.`);
          await loadTransfers();
          if (selectedTransfer?.id === transfer.id) setShowDetailsModal(false);
        } catch (err: any) {
          showError('Approval Failed', err.message || 'Could not approve transfer.');
        }
      },
      'Approve Transfer'
    );
  };

  // Reject Request
  const handleReject = async (transfer: StockTransferRequest) => {
    showConfirm(
      'Reject Stock Transfer',
      `Are you sure you want to reject Transfer Request #${transfer.transferNumber}?`,
      async () => {
        try {
          await api.post(`/inventory/transfers/${transfer.id}/reject`, {
            rejectionReason: 'Declined by branch manager',
          });
          showSuccess('Rejected', `Transfer #${transfer.transferNumber} marked as rejected.`);
          await loadTransfers();
          if (selectedTransfer?.id === transfer.id) setShowDetailsModal(false);
        } catch (err: any) {
          showError('Rejection Failed', err.message || 'Could not reject transfer.');
        }
      },
      'Reject Transfer',
      true
    );
  };

  // Dispatch Transfer
  const handleDispatch = async (transfer: StockTransferRequest) => {
    showConfirm(
      'Dispatch Stock Transfer',
      `Dispatching #${transfer.transferNumber} will immediately deduct ${transfer.quantity} units from ${transfer.sourceBranchName}. Stock will be in-transit to ${transfer.destinationBranchName}. Proceed?`,
      async () => {
        try {
          await api.post(`/inventory/transfers/${transfer.id}/dispatch`);
          showSuccess('Dispatched', `Stock for #${transfer.transferNumber} dispatched and in-transit.`);
          await loadTransfers();
          if (selectedTransfer?.id === transfer.id) setShowDetailsModal(false);
        } catch (err: any) {
          showError('Dispatch Failed', err.message || 'Could not dispatch stock.');
        }
      },
      'Confirm Dispatch'
    );
  };

  // Open Receive Modal
  const handleOpenReceiveModal = (transfer: StockTransferRequest) => {
    setSelectedTransfer(transfer);
    setReceiveForm({
      receivedQuantity: transfer.quantity || 1,
      notes: '',
    });
    setShowReceiveModal(true);
  };

  // Submit Receive Stock
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    if (receiveForm.receivedQuantity <= 0) {
      showError('Invalid Quantity', 'Received quantity must be at least 1 unit.');
      return;
    }
    if (receiveForm.receivedQuantity > (selectedTransfer.quantity || 0)) {
      showError(
        'Quantity Mismatch',
        `Received quantity (${receiveForm.receivedQuantity}) cannot exceed dispatched quantity (${selectedTransfer.quantity || 0}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post(`/inventory/transfers/${selectedTransfer.id}/receive`, {
        receivedQuantity: Number(receiveForm.receivedQuantity),
        notes: receiveForm.notes.trim() || undefined,
      });

      setShowReceiveModal(false);
      showSuccess(
        'Stock Received',
        `Successfully received ${receiveForm.receivedQuantity} units into ${selectedTransfer.destinationBranchName}. Destination inventory has been credited.`
      );
      await loadTransfers();
      if (showDetailsModal) setShowDetailsModal(false);
    } catch (err: any) {
      showError('Receipt Failed', err.message || 'Failed to record stock receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered and Paginated Transfers
  const paginatedTransfers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return transfers.slice(startIndex, startIndex + pageSize);
  }, [transfers, page, pageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Stock Transfer Requests</h1>
            {incomingAwaitingAction > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                {incomingAwaitingAction} To Receive
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-branch stock movements, approval workflows, transit tracking, and inbound goods receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/shop-owner/inventory"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Boxes className="h-4 w-4 text-indigo-600" /> Stock Catalog
          </Link>

          {branches.length > 1 && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Transfer Request
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Total Transfers
          </span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded requests across branches</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Pending Approval
          </span>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-extrabold text-amber-600">{pendingCount}</p>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Action Required
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting branch manager sign-off</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            In-Transit (Dispatched)
          </span>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-extrabold text-blue-600">{inTransitCount}</p>
            {incomingAwaitingAction > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {incomingAwaitingAction} Arrived
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Deducted from source, awaiting receipt</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Completed Transfers
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{completedCount}</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">Stock credited at destination</span>
        </div>
      </div>

      {/* Categorized Filter Bar */}
      <CategorizedFilterBar
        categories={transferFilterCategories}
        activeFilters={activeFilters}
        onFilterChange={(categoryId, value) => {
          setActiveFilters(prev => {
            if (value === undefined || value === null || value === '' || value === 'all') {
              const next = { ...prev };
              delete next[categoryId];
              return next;
            }
            return { ...prev, [categoryId]: value };
          });
          setPage(1);
        }}
        onClearFilters={() => {
          setActiveFilters({});
          setSearch('');
          setPage(1);
        }}
        search={search}
        onSearchChange={val => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search transfer ID, product, batch, or branch name..."
      />

      {/* Transfers Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Transfer ID</th>
                <th className="py-3.5 px-6">Routing (From &rarr; To)</th>
                <th className="py-3.5 px-6">Transferred Product / Batch</th>
                <th className="py-3.5 px-6">Quantity</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Requested</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
                    Loading transfer requests...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-1">
                    <ArrowRightLeft className="h-8 w-8 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
                    <p className="font-semibold text-slate-600">No transfer requests found</p>
                    <p className="text-[11px]">Create a new transfer request or adjust search filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedTransfers.map(trf => {
                  const isIncoming = trf.destinationBranchId === activeBranch?.id;
                  const isOutgoing = trf.sourceBranchId === activeBranch?.id;

                  const canReceive =
                    trf.status === 'dispatched' &&
                    (isIncoming || isManagerOrOwner);

                  const canApprove =
                    trf.status === 'pending' &&
                    isManagerOrOwner;

                  const canDispatch =
                    (trf.status === 'approved' || (trf.status === 'pending' && isManagerOrOwner)) &&
                    (isOutgoing || isManagerOrOwner);

                  return (
                    <tr
                      key={trf.id}
                      onClick={() => {
                        setSelectedTransfer(trf);
                        setShowDetailsModal(true);
                      }}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                        #{trf.transferNumber}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <span className={isOutgoing ? 'text-amber-700' : ''}>
                            {trf.sourceBranchName || trf.sourceBranchId}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className={isIncoming ? 'text-emerald-700' : ''}>
                            {trf.destinationBranchName || trf.destinationBranchId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isIncoming && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              <ArrowDownLeft className="h-2.5 w-2.5" /> Incoming
                            </span>
                          )}
                          {isOutgoing && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              <ArrowUpRight className="h-2.5 w-2.5" /> Outgoing
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-xs">{trf.productName || 'Product'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {trf.batchNumber ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-mono border border-amber-200">
                              <Layers className="h-2.5 w-2.5" /> Batch #{trf.batchNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Standard Catalog Item</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {trf.quantity} units
                        </span>
                        {typeof trf.receivedQuantity === 'number' && trf.status === 'completed' && (
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Received: {trf.receivedQuantity}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {trf.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                        {trf.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            <Check className="h-3 w-3" /> Approved
                          </span>
                        )}
                        {trf.status === 'dispatched' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Truck className="h-3 w-3" /> In-Transit
                          </span>
                        )}
                        {trf.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Received
                          </span>
                        )}
                        {trf.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="h-3 w-3" /> Rejected
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-500">
                        <p>{formatDate(trf.createdAt)}</p>
                        <p className="text-[10px] text-slate-400">By: {trf.requestedBy}</p>
                      </td>

                      <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* RECEIVE STOCK BUTTON (Requirement 2.4) */}
                          {canReceive && (
                            <button
                              onClick={() => handleOpenReceiveModal(trf)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
                            >
                              <PackageCheck className="h-3.5 w-3.5" /> Receive Stock
                            </button>
                          )}

                          {/* DISPATCH BUTTON */}
                          {canDispatch && (
                            <button
                              onClick={() => handleDispatch(trf)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Truck className="h-3.5 w-3.5" /> Dispatch
                            </button>
                          )}

                          {/* APPROVE BUTTON */}
                          {canApprove && (
                            <button
                              onClick={() => handleApprove(trf)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedTransfer(trf);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Transfer Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalCount > 0 && (
          <TablePagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* MODAL 1: CREATE TRANSFER REQUEST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">New Stock Transfer Request</h3>
                  <p className="text-xs text-slate-500">Initiate inter-branch inventory transfer with batch tracking</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Source Branch (From) *</label>
                  <select
                    value={createForm.sourceBranchId}
                    onChange={e => setCreateForm({ ...createForm, sourceBranchId: e.target.value, productId: '', batchId: '' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.id === activeBranch?.id ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Destination Branch (To) *</label>
                  <select
                    value={createForm.destinationBranchId}
                    onChange={e => setCreateForm({ ...createForm, destinationBranchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {branches
                      .filter(b => b.id !== createForm.sourceBranchId)
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Product to Transfer *</label>
                <select
                  value={createForm.productId}
                  onChange={e => setCreateForm({ ...createForm, productId: e.target.value, batchId: '' })}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="">-- Select Product from Source Branch --</option>
                  {products.map(p => {
                    const inv = sourceInventory.find(i => i.productId === p.id);
                    const stock = inv ? inv.quantity : 0;
                    return (
                      <option key={p.id} value={p.id} disabled={stock <= 0}>
                        {p.name} ({p.sku}) &bull; {stock} available {stock <= 0 ? '(Out of Stock)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Batch Selection (if available) */}
              {createForm.productId && availableBatches.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Select Specific Batch (Optional)
                  </label>
                  <select
                    value={createForm.batchId}
                    onChange={e => setCreateForm({ ...createForm, batchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none font-mono text-xs"
                  >
                    <option value="">-- General Stock (FIFO) --</option>
                    {availableBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        Batch #{b.batchNumber} &bull; Stock: {b.quantity} &bull; Price: {formatCurrency(b.sellingPrice)} {b.expiryDate ? `(Exp: ${formatDate(b.expiryDate)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">Transfer Quantity (Units) *</label>
                  {createForm.productId && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      Available: <strong className="text-slate-800">{maxAvailableStock} units</strong>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={maxAvailableStock || 1}
                  required
                  value={createForm.quantity}
                  onChange={e => setCreateForm({ ...createForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Transfer Reason / Justification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch stock shortage, urgent customer reservation"
                  value={createForm.reason}
                  onChange={e => setCreateForm({ ...createForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || maxAvailableStock <= 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Transfer Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE STOCK MODAL (Requirement 2.4) */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Receive Transferred Stock</h3>
                  <p className="text-xs text-slate-500">Record incoming stock into destination branch inventory</p>
                </div>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Transfer Reference:</span>
                  <span className="font-mono font-bold text-indigo-600">#{selectedTransfer.transferNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Source &rarr; Destination:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTransfer.sourceBranchName} &rarr; {selectedTransfer.destinationBranchName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Product:</span>
                  <span className="font-bold text-slate-900">{selectedTransfer.productName}</span>
                </div>
                {selectedTransfer.batchNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Batch Number:</span>
                    <span className="font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      #{selectedTransfer.batchNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-600 font-bold">Dispatched Quantity:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedTransfer.quantity} units</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Received Quantity (Units) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedTransfer.quantity || 1}
                  required
                  value={receiveForm.receivedQuantity}
                  onChange={e =>
                    setReceiveForm({
                      ...receiveForm,
                      receivedQuantity: Math.min(selectedTransfer.quantity || 1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 text-sm focus:bg-white focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Confirm physical count matches {selectedTransfer.quantity || 0} units dispatched.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Receipt Notes / Condition</label>
                <textarea
                  rows={2}
                  placeholder="e.g. All units received in good condition, packaging intact."
                  value={receiveForm.notes}
                  onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Receiving...' : 'Confirm Stock Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW TRANSFER DETAILS MODAL */}
      {showDetailsModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-indigo-600">
                  Transfer #{selectedTransfer.transferNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    selectedTransfer.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedTransfer.status === 'dispatched'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : selectedTransfer.status === 'approved'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : selectedTransfer.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {selectedTransfer.status}
                </span>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Branch:</span>
                  <span className="font-bold text-slate-800">{selectedTransfer.sourceBranchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination Branch:</span>
                  <span className="font-bold text-slate-800">{selectedTransfer.destinationBranchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Product / SKU:</span>
                  <span className="font-bold text-slate-900">{selectedTransfer.productName} ({selectedTransfer.sku || 'N/A'})</span>
                </div>
                {selectedTransfer.batchNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Batch Number:</span>
                    <span className="font-mono font-bold text-amber-700">#{selectedTransfer.batchNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity Dispatched:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedTransfer.quantity} units</span>
                </div>
                {typeof selectedTransfer.receivedQuantity === 'number' && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Quantity Received:</span>
                    <span>{selectedTransfer.receivedQuantity} units</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Reason:</span>
                  <span className="font-medium text-slate-700">{selectedTransfer.reason}</span>
                </div>
              </div>

              {/* Workflow Audit Trail */}
              <div className="space-y-1.5 pt-1">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Workflow Log</h4>
                <div className="space-y-1 bg-white border border-slate-200 rounded-xl p-3 text-[11px]">
                  <p className="flex justify-between text-slate-600">
                    <span>Requested by {selectedTransfer.requestedBy}:</span>
                    <span className="text-slate-400">{formatDate(selectedTransfer.createdAt)}</span>
                  </p>
                  {selectedTransfer.approvedBy && (
                    <p className="flex justify-between text-blue-700 font-medium">
                      <span>Approved by {selectedTransfer.approvedBy}:</span>
                      <span>{formatDate(selectedTransfer.approvedAt || '')}</span>
                    </p>
                  )}
                  {selectedTransfer.dispatchedBy && (
                    <p className="flex justify-between text-indigo-700 font-medium">
                      <span>Dispatched by {selectedTransfer.dispatchedBy}:</span>
                      <span>{formatDate(selectedTransfer.dispatchedAt || '')}</span>
                    </p>
                  )}
                  {selectedTransfer.receivedBy && (
                    <p className="flex justify-between text-emerald-700 font-medium">
                      <span>Received by {selectedTransfer.receivedBy}:</span>
                      <span>{formatDate(selectedTransfer.receivedAt || '')}</span>
                    </p>
                  )}
                  {selectedTransfer.rejectedBy && (
                    <p className="flex justify-between text-rose-700 font-medium">
                      <span>Rejected by {selectedTransfer.rejectedBy}:</span>
                      <span>{formatDate(selectedTransfer.rejectedAt || '')}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                {selectedTransfer.status === 'pending' && isManagerOrOwner && (
                  <button
                    onClick={() => handleReject(selectedTransfer)}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    Reject Request
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedTransfer.status === 'pending' && isManagerOrOwner && (
                  <button
                    onClick={() => handleApprove(selectedTransfer)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    Approve
                  </button>
                )}

                {(selectedTransfer.status === 'approved' ||
                  (selectedTransfer.status === 'pending' && isManagerOrOwner)) && (
                  <button
                    onClick={() => handleDispatch(selectedTransfer)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    Dispatch Stock
                  </button>
                )}

                {selectedTransfer.status === 'dispatched' && (
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleOpenReceiveModal(selectedTransfer);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs"
                  >
                    Receive Stock
                  </button>
                )}

                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
