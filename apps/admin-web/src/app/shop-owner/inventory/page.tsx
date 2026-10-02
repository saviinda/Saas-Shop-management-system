'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { InventoryItem, StockMovement, Branch, Product } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Boxes,
  Plus,
  AlertTriangle,
  ArrowUpDown,
  ArrowRightLeft,
  History,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';
import { CategorizedFilterBar, FilterCategory } from '@/components/CategorizedFilterBar';
import { TablePagination } from '@/components/TablePagination';

export default function InventoryPage() {
  const { showSuccess, showError } = useModal();
  const { activeBranch, branches } = useBranch();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');

  // Tab 1 Pagination & Filter
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(10);
  const [invActiveFilters, setInvActiveFilters] = useState<Record<string, any>>({});
  const [invSearch, setInvSearch] = useState('');

  // Tab 2 Pagination & Filter
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(10);
  const [movActiveFilters, setMovActiveFilters] = useState<Record<string, any>>({});
  const [movSearch, setMovSearch] = useState('');

  const inventoryFilterCategories: FilterCategory[] = [
    {
      id: 'stock_status',
      label: 'Stock Status',
      type: 'select',
      options: [
        { label: 'All Items', value: 'all' },
        { label: 'In Stock (> 0)', value: 'in_stock' },
        { label: 'Low Stock Threshold', value: 'low_stock' },
        { label: 'Out of Stock (0 units)', value: 'out_of_stock' },
      ],
    },
  ];

  const movementsFilterCategories: FilterCategory[] = [
    {
      id: 'movement_type',
      label: 'Movement Type',
      type: 'select',
      options: [
        { label: 'All Movement Types', value: 'all' },
        { label: 'Opening Stock', value: 'opening' },
        { label: 'Goods Received (PO/GRN)', value: 'po_receive' },
        { label: 'Sales Deduction', value: 'sale' },
        { label: 'Manual Adjustment', value: 'adjustment' },
        { label: 'Damaged / Written Off', value: 'damaged' },
        { label: 'Customer Return', value: 'returned' },
        { label: 'Inter-Branch Transfer', value: 'transfer' },
      ],
    },
  ];

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Adjustment Form State
  const [adjustForm, setAdjustForm] = useState({
    type: 'adjustment' as 'adjustment' | 'damaged' | 'returned' | 'opening',
    mode: 'delta' as 'delta' | 'exact',
    quantityDelta: 10,
    exactQuantity: 0,
    reason: '',
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    sourceBranchId: '',
    destinationBranchId: '',
    productId: '',
    quantity: 5,
    reason: 'Inter-branch replenishment',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [invRes, movRes, prodRes] = await Promise.all([
        api.get<InventoryItem[]>('/inventory', { branchId: activeBranch?.id }),
        api.get<StockMovement[]>('/inventory/movements', { branchId: activeBranch?.id }),
        api.get<Product[]>('/products'),
      ]);
      setItems(invRes.data || []);
      setMovements(movRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // Inventory Valuations
  const totalUnits = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const totalCostValuation = items.reduce((sum, it) => sum + (it.quantity * (it.costPrice || 0)), 0);
  const totalRetailValuation = items.reduce((sum, it) => sum + (it.quantity * (it.sellingPrice || 0)), 0);
  const lowStockCount = items.filter(it => it.quantity > 0 && it.quantity <= it.minimumStockLevel).length;
  const outOfStockCount = items.filter(it => it.quantity <= 0).length;

  const openAdjustModal = (item: InventoryItem) => {
    setSelectedItemForAdjust(item);
    setAdjustForm({
      type: 'adjustment',
      mode: 'delta',
      quantityDelta: 5,
      exactQuantity: item.quantity,
      reason: 'Physical stock verification',
    });
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    if (!adjustForm.reason.trim()) {
      showError('Reason Required', 'Please provide a clear reason for this inventory adjustment.');
      return;
    }

    try {
      setIsSubmitting(true);
      let delta = adjustForm.quantityDelta;
      if (adjustForm.mode === 'exact') {
        delta = adjustForm.exactQuantity - selectedItemForAdjust.quantity;
      } else if (adjustForm.type === 'damaged') {
        delta = -Math.abs(adjustForm.quantityDelta);
      } else if (adjustForm.type === 'returned' || adjustForm.type === 'opening') {
        delta = Math.abs(adjustForm.quantityDelta);
      }

      await api.post('/inventory/adjust', {
        branchId: selectedItemForAdjust.branchId || activeBranch?.id,
        productId: selectedItemForAdjust.productId,
        quantityDelta: delta,
        reason: adjustForm.reason.trim(),
        type: adjustForm.type,
      });

      setShowAdjustModal(false);
      showSuccess('Stock Adjusted', `Stock balance updated for "${selectedItemForAdjust.productName}".`);
      await loadData();
    } catch (err: any) {
      showError('Adjustment Failed', err.message || 'Failed to record stock adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransferModal = () => {
    const availableBranches = branches.filter(b => b.id !== activeBranch?.id);
    setTransferForm({
      sourceBranchId: activeBranch?.id || (branches[0]?.id ?? ''),
      destinationBranchId: availableBranches[0]?.id || '',
      productId: items[0]?.productId || '',
      quantity: 5,
      reason: 'Inter-branch stock balancing',
    });
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.sourceBranchId || !transferForm.destinationBranchId) {
      showError('Branches Required', 'Please select both source and destination branches.');
      return;
    }
    if (transferForm.sourceBranchId === transferForm.destinationBranchId) {
      showError('Invalid Selection', 'Source and destination branches cannot be the same.');
      return;
    }
    if (!transferForm.productId) {
      showError('Product Required', 'Please select a product to transfer.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/inventory/transfer', {
        sourceBranchId: transferForm.sourceBranchId,
        destinationBranchId: transferForm.destinationBranchId,
        productId: transferForm.productId,
        quantity: Number(transferForm.quantity),
        reason: transferForm.reason.trim(),
      });

      setShowTransferModal(false);
      showSuccess('Stock Transferred', 'Inter-branch stock transfer completed successfully.');
      await loadData();
    } catch (err: any) {
      showError('Transfer Failed', err.message || 'Failed to transfer stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(it => {
    const filter = invActiveFilters.stock_status || 'all';
    if (filter === 'low_stock' && (it.quantity <= 0 || it.quantity > it.minimumStockLevel)) return false;
    if (filter === 'out_of_stock' && it.quantity > 0) return false;
    if (filter === 'in_stock' && it.quantity <= 0) return false;
    if (!invSearch) return true;
    const q = invSearch.toLowerCase();
    return it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q);
  });

  const paginatedItems = filteredItems.slice((invPage - 1) * invPageSize, invPage * invPageSize);

  const filteredMovements = movements.filter(m => {
    const filter = movActiveFilters.movement_type || 'all';
    if (filter !== 'all' && m.type !== filter) return false;
    if (!movSearch) return true;
    const q = movSearch.toLowerCase();
    const prod = products.find(p => p.id === m.productId);
    return (
      (prod && prod.name.toLowerCase().includes(q)) ||
      (m.reason && m.reason.toLowerCase().includes(q)) ||
      m.performedBy.toLowerCase().includes(q)
    );
  });

  const paginatedMovements = filteredMovements.slice((movPage - 1) * movPageSize, movPage * movPageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory & Stock Movements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time branch inventory, stock adjustments, inter-branch transfers, valuations, and audit logs (BR-13)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {branches.length > 1 && (
            <button
              onClick={openTransferModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4 text-indigo-600" /> Transfer Stock
            </button>
          )}

          <button
            onClick={() => setActiveTab(activeTab === 'inventory' ? 'movements' : 'inventory')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100/70 transition-colors"
          >
            <History className="h-4 w-4" /> {activeTab === 'inventory' ? 'View Movement Logs' : 'View Stock Catalog'}
          </button>
        </div>
      </div>

      {/* Financial Valuation KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Total Stock Count</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalUnits.toLocaleString()} units</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{items.length} active SKU lines</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Asset Valuation (Cost)</span>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{formatCurrency(totalCostValuation)}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Capital tied up in current stock</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Potential Sales Value</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(totalRetailValuation)}</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
            +{formatCurrency(Math.max(0, totalRetailValuation - totalCostValuation))} Gross Margin
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Replenishment Alerts</span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              <AlertTriangle className="h-3 w-3" /> {lowStockCount} Low Stock
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
              <XCircle className="h-3 w-3" /> {outOfStockCount} Out of Stock
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Boxes className="h-4 w-4" /> Stock Catalog ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'movements' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" /> Stock Movements & Audit Log ({movements.length})
        </button>
      </div>

      {/* TAB 1: INVENTORY CATALOG */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Categorized Filter Bar */}
          <CategorizedFilterBar
            categories={inventoryFilterCategories}
            activeFilters={invActiveFilters}
            onFilterChange={(categoryId, value) => {
              setInvActiveFilters(prev => {
                if (value === undefined || value === null || value === '' || value === 'all') {
                  const next = { ...prev };
                  delete next[categoryId];
                  return next;
                }
                return { ...prev, [categoryId]: value };
              });
              setInvPage(1);
            }}
            onClearFilters={() => {
              setInvActiveFilters({});
              setInvSearch('');
              setInvPage(1);
            }}
            search={invSearch}
            onSearchChange={val => {
              setInvSearch(val);
              setInvPage(1);
            }}
            searchPlaceholder="Search products by title, SKU..."
          />

          {/* Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">Product / SKU</th>
                    <th className="py-3.5 px-6">In-Stock Quantity</th>
                    <th className="py-3.5 px-6">Min Threshold</th>
                    <th className="py-3.5 px-6">Cost / Retail Value</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Last Updated</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading stock inventory...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No stock records found matching filters.</td></tr>
                  ) : (
                    paginatedItems.map(it => {
                      const isLow = it.quantity > 0 && it.quantity <= it.minimumStockLevel;
                      const isOut = it.quantity <= 0;

                      return (
                        <tr key={it.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-4 px-6">
                            <p className="font-bold text-slate-900 text-sm">{it.productName}</p>
                            <p className="text-[11px] text-slate-400 font-mono">SKU: {it.sku}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`text-base font-extrabold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                              {it.quantity} units
                            </span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-600">
                            {it.minimumStockLevel} units
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-bold text-slate-900">{formatCurrency(it.quantity * (it.sellingPrice || 0))}</p>
                            <p className="text-[10px] text-slate-400">Cost: {formatCurrency(it.quantity * (it.costPrice || 0))}</p>
                          </td>
                          <td className="py-4 px-6">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="h-3 w-3" /> Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="h-3 w-3" /> Low Stock Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Optimal Stock
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-500">{formatDate(it.updatedAt)}</td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => openAdjustModal(it)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" /> Adjust Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > 0 && (
              <TablePagination
                currentPage={invPage}
                totalPages={Math.max(1, Math.ceil(filteredItems.length / invPageSize))}
                totalItems={filteredItems.length}
                pageSize={invPageSize}
                onPageChange={setInvPage}
                onPageSizeChange={size => {
                  setInvPageSize(size);
                  setInvPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENT LOGS */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Categorized Filter Bar */}
          <CategorizedFilterBar
            categories={movementsFilterCategories}
            activeFilters={movActiveFilters}
            onFilterChange={(categoryId, value) => {
              setMovActiveFilters(prev => {
                if (value === undefined || value === null || value === '' || value === 'all') {
                  const next = { ...prev };
                  delete next[categoryId];
                  return next;
                }
                return { ...prev, [categoryId]: value };
              });
              setMovPage(1);
            }}
            onClearFilters={() => {
              setMovActiveFilters({});
              setMovSearch('');
              setMovPage(1);
            }}
            search={movSearch}
            onSearchChange={val => {
              setMovSearch(val);
              setMovPage(1);
            }}
            searchPlaceholder="Search movements by product, reason, staff..."
          />

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">Timestamp</th>
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-6">Movement Type</th>
                    <th className="py-3.5 px-6">Quantity Delta</th>
                    <th className="py-3.5 px-6">New Balance</th>
                    <th className="py-3.5 px-6">Reason / Reference</th>
                    <th className="py-3.5 px-6">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMovements.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No stock movements found.</td></tr>
                  ) : (
                    paginatedMovements.map(m => {
                      const prod = products.find(p => p.id === m.productId);
                      const isPositive = m.quantityDelta > 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-6 text-slate-500">{formatDate(m.createdAt)}</td>
                          <td className="py-3.5 px-6 font-bold text-slate-900">
                            {prod?.name || 'Product'}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px] uppercase border border-slate-200">
                              {m.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            <span className={`font-extrabold text-xs ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? `+${m.quantityDelta}` : m.quantityDelta} units
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-bold text-slate-800">{m.newQuantity} units</td>
                          <td className="py-3.5 px-6 text-slate-600 max-w-[220px] truncate">{m.reason || '-'}</td>
                          <td className="py-3.5 px-6 text-slate-500">{m.performedBy}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredMovements.length > 0 && (
              <TablePagination
                currentPage={movPage}
                totalPages={Math.max(1, Math.ceil(filteredMovements.length / movPageSize))}
                totalItems={filteredMovements.length}
                pageSize={movPageSize}
                onPageChange={setMovPage}
                onPageSizeChange={size => {
                  setMovPageSize(size);
                  setMovPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && selectedItemForAdjust && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Adjust Stock: {selectedItemForAdjust.productName}</h3>
                <p className="text-xs text-slate-500">Current Balance: <b className="text-slate-900">{selectedItemForAdjust.quantity} units</b></p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Adjustment Category</label>
                <select
                  value={adjustForm.type}
                  onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="adjustment">Stock Count Adjustment (Count Delta)</option>
                  <option value="damaged">Damaged Stock / Wastage (Deduction)</option>
                  <option value="returned">Customer Return (Restock)</option>
                  <option value="opening">Initial Opening Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Quantity Delta</label>
                  <input
                    type="number"
                    required
                    value={adjustForm.quantityDelta}
                    onChange={e => setAdjustForm({ ...adjustForm, quantityDelta: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Expected New Balance</label>
                  <div className="p-2.5 bg-slate-100 rounded-xl font-bold text-slate-900 text-sm">
                    {adjustForm.type === 'damaged'
                      ? Math.max(0, selectedItemForAdjust.quantity - adjustForm.quantityDelta)
                      : selectedItemForAdjust.quantity + adjustForm.quantityDelta} units
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Reason / Explanation *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Expired batch discarded, physical cycle count correction..."
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-BRANCH STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Inter-Branch Stock Transfer</h3>
                  <p className="text-xs text-slate-500">Transfer inventory items between registered store branches</p>
                </div>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Source Branch (From)</label>
                  <select
                    value={transferForm.sourceBranchId}
                    onChange={e => setTransferForm({ ...transferForm, sourceBranchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Destination Branch (To)</label>
                  <select
                    value={transferForm.destinationBranchId}
                    onChange={e => setTransferForm({ ...transferForm, destinationBranchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {branches
                      .filter(b => b.id !== transferForm.sourceBranchId)
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Select Product to Transfer</label>
                <select
                  value={transferForm.productId}
                  onChange={e => setTransferForm({ ...transferForm, productId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                >
                  {items.map(it => (
                    <option key={it.productId} value={it.productId}>
                      {it.productName} ({it.sku}) - {it.quantity} units available
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Transfer Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferForm.quantity}
                  onChange={e => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Dispatch Reason / Note</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend stock rebalancing, urgent branch request"
                  value={transferForm.reason}
                  onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring...' : 'Execute Stock Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
