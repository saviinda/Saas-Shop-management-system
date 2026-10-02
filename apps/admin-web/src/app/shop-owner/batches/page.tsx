'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { ProductBatch, Product, Branch } from '@saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Building2,
  Package,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Boxes,
} from 'lucide-react';

interface EnrichedBatch extends ProductBatch {
  productName?: string;
  productSku?: string;
  productCategory?: string;
}

export default function BatchesManagementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch } = useBranch();

  const [batches, setBatches] = useState<EnrichedBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dialog State (Create / Edit Batch)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<EnrichedBatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    productId: '',
    batchNumber: '',
    branchId: '',
    quantity: 50,
    costPrice: 10,
    sellingPrice: 20,
    manufacturingDate: '',
    expiryDate: '',
    status: 'active' as 'active' | 'depleted' | 'expired' | 'quarantine',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [batchesRes, productsRes, branchesRes] = await Promise.all([
        api.get<EnrichedBatch[]>('/products/batches/all'),
        api.get<Product[]>('/products'),
        api.get<Branch[]>('/branches').catch(() => ({ data: [] })),
      ]);

      setBatches(batchesRes.data || []);
      setProducts(productsRes.data || []);
      setBranches(branchesRes.data || []);
    } catch (err) {
      console.error('Failed to load batches data:', err);
      showError('Load Error', 'Failed to retrieve inventory batches.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered & Paginated Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        b.batchNumber.toLowerCase().includes(q) ||
        (b.productName && b.productName.toLowerCase().includes(q)) ||
        (b.productSku && b.productSku.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q));

      const matchesProduct = productFilter === 'all' || b.productId === productFilter;
      const matchesBranch = branchFilter === 'all' || b.branchId === branchFilter;
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

      return matchesSearch && matchesProduct && matchesBranch && matchesStatus;
    });
  }, [batches, search, productFilter, branchFilter, statusFilter]);

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage) || 1;
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBatches, currentPage, itemsPerPage]);

  // Statistics
  const totalStockUnits = batches
    .filter(b => b.status === 'active')
    .reduce((sum, b) => sum + (b.quantity || 0), 0);
  const activeBatchesCount = batches.filter(b => b.status === 'active').length;
  const expiredBatchesCount = batches.filter(b => {
    if (b.status === 'expired') return true;
    if (b.expiryDate && new Date(b.expiryDate) < new Date()) return true;
    return false;
  }).length;
  const quarantineCount = batches.filter(b => b.status === 'quarantine').length;

  const handleOpenCreate = () => {
    setEditingBatch(null);
    setDialogError(null);
    const defaultProduct = products[0];
    const defaultBranchId = activeBranch?.id || branches[0]?.id || '';
    const now = new Date();
    const batchCode = `BTH-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    setFormData({
      productId: defaultProduct?.id || '',
      batchNumber: batchCode,
      branchId: defaultBranchId,
      quantity: 50,
      costPrice: defaultProduct?.costPrice || 10,
      sellingPrice: defaultProduct?.sellingPrice || 20,
      manufacturingDate: now.toISOString().split('T')[0],
      expiryDate: '',
      status: 'active',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (b: EnrichedBatch) => {
    setEditingBatch(b);
    setDialogError(null);
    setFormData({
      productId: b.productId,
      batchNumber: b.batchNumber,
      branchId: b.branchId || '',
      quantity: b.quantity,
      costPrice: b.costPrice,
      sellingPrice: b.sellingPrice,
      manufacturingDate: b.manufacturingDate ? b.manufacturingDate.split('T')[0] : '',
      expiryDate: b.expiryDate ? b.expiryDate.split('T')[0] : '',
      status: b.status,
      notes: b.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    if (!formData.productId) {
      setDialogError('Please select a product for this batch.');
      return;
    }
    if (!formData.batchNumber.trim()) {
      setDialogError('Batch code is required.');
      return;
    }
    if (formData.quantity < 0) {
      setDialogError('Quantity cannot be negative.');
      return;
    }

    try {
      setIsSubmitting(true);
      const branchObj = branches.find(br => br.id === formData.branchId);

      const payload = {
        productId: formData.productId,
        batchNumber: formData.batchNumber.trim(),
        branchId: formData.branchId || undefined,
        branchName: branchObj?.name || 'Default Branch',
        quantity: Number(formData.quantity),
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        manufacturingDate: formData.manufacturingDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
      };

      if (editingBatch) {
        await api.patch(`/products/batches/standalone/${editingBatch.id}`, payload);
        showSuccess('Batch Updated', `Batch "${formData.batchNumber}" has been updated.`);
      } else {
        await api.post('/products/batches/standalone', payload);
        showSuccess('Batch Created', `Batch "${formData.batchNumber}" created and branch stock updated!`);
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setDialogError(err.message);
      } else {
        setDialogError('Failed to save batch. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = (b: EnrichedBatch) => {
    showConfirm(
      'Delete Batch',
      `Are you sure you want to delete batch "${b.batchNumber}"? Its remaining quantity (${b.quantity} units) will be deducted from branch inventory.`,
      async () => {
        try {
          await api.delete(`/products/batches/standalone/${b.id}`);
          showSuccess('Batch Deleted', `Batch "${b.batchNumber}" was removed.`);
          await fetchData();
        } catch (err: any) {
          const msg = err instanceof ApiError ? err.message : 'Failed to delete batch.';
          showError('Delete Failed', msg);
        }
      },
      'Delete Batch',
      true
    );
  };

  // Live profit calculation
  const profitMargin =
    formData.sellingPrice > 0
      ? Math.round(((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Batches Management
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Track product lots, expiration dates, cost/selling valuations, and branch distributions independently.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleOpenCreate}
            disabled={products.length === 0}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Batch
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Total Batches</span>
              <Layers className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-1">
              {batches.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Recorded product shipments
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Active Stock Units</span>
              <Boxes className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 mt-1">
              {totalStockUnits}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Across {activeBatchesCount} active batch lots
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Expired / Alert Lots</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 mt-1">
              {expiredBatchesCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Requires inventory attention
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Quarantine Hold</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 mt-1">
              {quarantineCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Pending QC verification
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      <Card>
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search batch code, product, SKU..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filter by Product */}
            <select
              value={productFilter}
              onChange={e => {
                setProductFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>

            {/* Filter by Branch */}
            <select
              value={branchFilter}
              onChange={e => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Filter by Status */}
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="quarantine">Quarantine</option>
              <option value="expired">Expired</option>
              <option value="depleted">Depleted</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Batch Code</TableHead>
                <TableHead className="w-[24%]">Product</TableHead>
                <TableHead className="w-[15%]">Branch Location</TableHead>
                <TableHead className="w-[12%] text-center">Remaining Qty</TableHead>
                <TableHead className="w-[12%]">Cost / Selling</TableHead>
                <TableHead className="w-[10%]">Expiry Date</TableHead>
                <TableHead className="w-[9%]">Status</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>Loading inventory batches...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedBatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <Layers className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No batches found</p>
                      <p className="text-[11px] text-slate-400">
                        {search || productFilter !== 'all' || branchFilter !== 'all'
                          ? 'Try adjusting your search criteria or active filters.'
                          : 'Click "New Batch" to record stock lots for your catalog products.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBatches.map(b => {
                  const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();

                  return (
                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {b.batchNumber}
                        </div>
                        {b.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5">
                            {b.notes}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-xs">{b.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{b.productSku}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {b.branchName || 'Branch'}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`font-bold font-mono text-xs ${
                            b.quantity === 0
                              ? 'text-rose-600'
                              : b.quantity <= 5
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {b.quantity} units
                        </span>
                        {b.initialQuantity ? (
                          <p className="text-[9px] text-slate-400">Orig: {b.initialQuantity}</p>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <p className="font-bold text-slate-900">{formatCurrency(b.sellingPrice)}</p>
                        <p className="text-[10px] text-slate-400">Cost: {formatCurrency(b.costPrice)}</p>
                      </TableCell>

                      <TableCell>
                        {b.expiryDate ? (
                          <span
                            className={`text-[11px] font-semibold flex items-center gap-1 ${
                              isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {b.expiryDate.split('T')[0]} {isExpired && '⚠️'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">None</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            b.status === 'active'
                              ? 'success'
                              : b.status === 'depleted'
                              ? 'secondary'
                              : b.status === 'expired'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="capitalize text-[10px]"
                        >
                          {b.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(b)}
                            title="Edit Batch"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBatch(b)}
                            title="Delete Batch"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredBatches.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredBatches.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemName="batches"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT BATCH DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={() => setIsDialogOpen(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingBatch ? `Edit Batch: ${editingBatch.batchNumber}` : 'Record New Product Batch'}
            </DialogTitle>
            <DialogDescription>
              {editingBatch
                ? 'Update batch specifications, prices, expiration dates, or stock adjustments.'
                : 'Add a new inventory lot to allocate physical stock and update catalog pricing.'}
            </DialogDescription>
          </DialogHeader>

          {dialogError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{dialogError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Product <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={formData.productId}
                  onChange={e => {
                    const selProd = products.find(p => p.id === e.target.value);
                    setFormData({
                      ...formData,
                      productId: e.target.value,
                      costPrice: selProd?.costPrice || formData.costPrice,
                      sellingPrice: selProd?.sellingPrice || formData.sellingPrice,
                    });
                  }}
                  disabled={!!editingBatch}
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Batch Code / Lot Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. BTH-2609-102"
                  value={formData.batchNumber}
                  onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Branch Destination <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={formData.branchId}
                  onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                >
                  {branches.map(br => (
                    <option key={br.id} value={br.id}>
                      {br.name} {br.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Batch Quantity (Units) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Batch Status
                </label>
                <Select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="active">Active (For Sale)</option>
                  <option value="quarantine">Quarantine (Hold)</option>
                  <option value="expired">Expired</option>
                  <option value="depleted">Depleted</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Cost Price per Unit ($) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.costPrice}
                  onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Selling Price per Unit ($) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.sellingPrice}
                  onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Profit margin live preview */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">
                Profit Margin Preview: <b>${Math.max(0, formData.sellingPrice - formData.costPrice).toFixed(2)} / unit</b>
              </span>
              <span className={profitMargin > 0 ? 'text-emerald-600' : 'text-slate-500'}>
                Gross Margin: {profitMargin}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Manufacturing Date</label>
                <Input
                  type="date"
                  value={formData.manufacturingDate}
                  onChange={e => setFormData({ ...formData, manufacturingDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Expiry Date</label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Storage Notes / Location Bin (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Aisle 3 Shelf B, Supplier Lot #99..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : editingBatch
                  ? 'Update Batch'
                  : 'Save Batch & Update Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
