'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { Product, ProductCategory, ProductBatch, Branch } from '@saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { TablePagination } from '@/components/TablePagination';
import { CategorizedFilterBar, FilterCategory } from '@/components/CategorizedFilterBar';
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
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Search,
  RotateCcw,
  Tag,
  Layers,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  Building2,
  ExternalLink,
} from 'lucide-react';

export default function ProductsCatalogPage() {
  const { showSuccess, showError, showConfirm } = useModal();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const productFilterCategories: FilterCategory[] = useMemo(() => [
    {
      id: 'category',
      label: 'Product Category',
      type: 'select',
      options: [
        { label: 'All Categories', value: 'all' },
        ...categories.map(c => ({ label: c.name, value: c.name })),
      ],
    },
    {
      id: 'stock_status',
      label: 'Stock Status',
      type: 'select',
      options: [
        { label: 'All Stock Statuses', value: 'all' },
        { label: 'In Stock (> 0)', value: 'in_stock' },
        { label: 'Low Stock Alert', value: 'low_stock' },
        { label: 'Out of Stock (0 units)', value: 'out_of_stock' },
      ],
    },
  ], [categories]);

  // Add / Edit Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State (Cleaned up: NO image, NO supplier, NO tags)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    minimumStockLevel: 5,
    status: 'active' as 'active' | 'inactive',
    isPublic: true,
    isFeatured: false,
  });

  // Dedicated Product Details View Modal State
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingBatches, setViewingBatches] = useState<ProductBatch[]>([]);
  const [isLoadingViewBatches, setIsLoadingViewBatches] = useState(false);

  const fetchCatalogData = async () => {
    try {
      setIsLoading(true);
      const [prodRes, catRes, brRes] = await Promise.all([
        api.get<Product[]>('/products'),
        api.get<ProductCategory[]>('/categories').catch(() => ({ data: [] })),
        api.get<Branch[]>('/branches').catch(() => ({ data: [] })),
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setBranches(brRes.data || []);
    } catch (err) {
      console.error('Failed to load products catalog:', err);
      showError('Load Error', 'Failed to retrieve catalog products from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, []);

  // Filtered & Paginated Products
  const filteredProducts = useMemo(() => {
    const activeCat = activeFilters.category || categoryFilter;
    const activeStk = activeFilters.stock_status || stockFilter;

    return products.filter(p => {
      if (activeCat && activeCat !== 'all' && p.category !== activeCat) return false;
      const currentStock = (p as any).currentStock || 0;
      if (activeStk === 'in_stock' && currentStock <= 0) return false;
      if (activeStk === 'low_stock' && (currentStock <= 0 || currentStock > p.minimumStockLevel))
        return false;
      if (activeStk === 'out_of_stock' && currentStock > 0) return false;

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, categoryFilter, stockFilter, activeFilters, search]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Statistics
  const totalStockUnits = products.reduce((acc, p) => acc + ((p as any).currentStock || 0), 0);
  const lowStockCount = products.filter(p => {
    const stock = (p as any).currentStock || 0;
    return stock > 0 && stock <= p.minimumStockLevel;
  }).length;
  const outOfStockCount = products.filter(p => ((p as any).currentStock || 0) <= 0).length;

  const openAddModal = () => {
    setEditingProduct(null);
    setModalError(null);
    setFormData({
      name: '',
      sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
      category: categories[0]?.name || 'Papers',
      description: '',
      minimumStockLevel: 5,
      status: 'active',
      isPublic: true,
      isFeatured: false,
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalError(null);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description || '',
      minimumStockLevel: product.minimumStockLevel,
      status: product.status || 'active',
      isPublic: product.isPublic !== false,
      isFeatured: !!product.isFeatured,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Product Name is required.');
      return;
    }
    if (!formData.sku.trim()) {
      setModalError('Product SKU code is required.');
      return;
    }
    if (!formData.category) {
      setModalError('Please select a product category.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        category: formData.category,
        description: formData.description.trim(),
        minimumStockLevel: Number(formData.minimumStockLevel),
        status: formData.status,
        isPublic: formData.isPublic,
        isFeatured: formData.isFeatured,
      };

      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        showSuccess('Product Updated', `Product "${formData.name}" has been updated.`);
      } else {
        await api.post<Product>('/products', {
          ...payload,
          costPrice: 0,
          sellingPrice: 0,
          initialStock: 0,
        });
        showSuccess(
          'Product Created',
          `Product "${formData.name}" registered! You can now record inventory batches to set branch stocks and pricing.`
        );
      }

      setShowModal(false);
      await fetchCatalogData();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to save product.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openViewProductModal = async (product: Product) => {
    setViewingProduct(product);
    setIsLoadingViewBatches(true);
    try {
      const res = await api.get<ProductBatch[]>(`/products/${product.id}/batches`);
      setViewingBatches(res.data || []);
    } catch (err) {
      console.error('Failed to load product batches:', err);
      setViewingBatches([]);
    } finally {
      setIsLoadingViewBatches(false);
    }
  };

  const handleToggleProductStatus = (p: Product) => {
    const nextStatus = p.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'Activate Product' : 'Deactivate Product';

    showConfirm(
      action,
      `Are you sure you want to change "${p.name}" status to ${nextStatus}? ${
        nextStatus === 'inactive'
          ? 'It will be hidden from customer orders.'
          : 'It will be available for orders.'
      }`,
      async () => {
        try {
          await api.patch(`/products/${p.id}`, { status: nextStatus });
          await fetchCatalogData();
          showSuccess('Status Updated', `Product is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Failed', err.message || 'Could not update product status.');
        }
      },
      action,
      nextStatus === 'inactive'
    );
  };

  const handleDeleteProduct = (p: Product) => {
    showConfirm(
      'Delete Product',
      `Are you sure you want to delete "${p.name}" (${p.sku})? This will remove all associated batches and branch inventory records.`,
      async () => {
        try {
          await api.delete(`/products/${p.id}`);
          await fetchCatalogData();
          showSuccess('Product Deleted', 'Product removed successfully.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete product.');
        }
      },
      'Delete Product',
      true
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Package className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Product Catalog
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Manage product specifications, categories, and inventory stock valuations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick link to dedicated Categories page */}
          <Link href="/shop-owner/products/categories">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-indigo-600" />
              Product Categories ({categories.length})
            </Button>
          </Link>

          {/* Quick link to dedicated Batches page */}
          <Link href="/shop-owner/batches">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              Manage Batches
            </Button>
          </Link>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCatalogData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Add Product Button */}
          <Button
            variant="default"
            size="sm"
            onClick={openAddModal}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Catalog Items</span>
              <Package className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-1">
              {products.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Active products in store
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Total Units in Stock</span>
              <Boxes className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 mt-1">
              {totalStockUnits}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Aggregated across all branches
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Low Stock Alerts</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 mt-1">
              {lowStockCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Below warning stock thresholds
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Out of Stock</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 mt-1">
              {outOfStockCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            0 units currently on hand
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      {/* Categorized Filter Bar */}
      <CategorizedFilterBar
        categories={productFilterCategories}
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
          setCurrentPage(1);
        }}
        onClearFilters={() => {
          setActiveFilters({});
          setSearch('');
          setCategoryFilter('all');
          setStockFilter('all');
          setCurrentPage(1);
        }}
        search={search}
        onSearchChange={val => {
          setSearch(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search products by name, SKU, or category..."
      />

      {/* Main Table Card */}
      <Card>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Product / SKU</TableHead>
                <TableHead className="w-[18%]">Category</TableHead>
                <TableHead className="w-[14%]">Active Price</TableHead>
                <TableHead className="w-[16%] text-center">Batches & Stock</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[14%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>Loading products...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <Package className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No products found</p>
                      <p className="text-[11px] text-slate-400">
                        {search || categoryFilter !== 'all' || stockFilter !== 'all'
                          ? 'Try adjusting your search criteria or active filters.'
                          : 'Get started by creating your first product.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map(p => {
                  const stock = (p as any).currentStock || 0;
                  const batchesCount =
                    (p as any).batchesCount !== undefined
                      ? (p as any).batchesCount
                      : p.batches?.length || 0;
                  const isLow = stock > 0 && stock <= p.minimumStockLevel;
                  const isOut = stock <= 0;

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-xs">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-[11px]">
                          {p.category}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <p className="font-bold text-slate-900 text-xs">
                          {formatCurrency(p.sellingPrice)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Cost: {formatCurrency(p.costPrice)}
                        </p>
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`font-bold font-mono text-xs ${
                            isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {stock} units
                        </span>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Layers className="h-2.5 w-2.5" />
                          <span>{batchesCount} batch(es)</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(p)}
                          className="cursor-pointer"
                          title="Click to toggle status"
                        >
                          <Badge
                            variant={p.status === 'active' ? 'success' : 'destructive'}
                            className="capitalize text-[10px] hover:opacity-80 transition-opacity"
                          >
                            {p.status || 'active'}
                          </Badge>
                        </button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewProductModal(p)}
                            title="View Details & Batches"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete Product"
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
          {filteredProducts.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProducts.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemName="products"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT PRODUCT MODAL (Clean layout: NO Image, NO Supplier, NO Tags) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent onClose={() => setShowModal(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product to Catalog'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update product specifications and category classification.'
                : 'Register product specifications. Stock quantity and cost/selling prices are managed via Batches.'}
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. A4 80gsm Paper Ream"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  SKU Code / Barcode <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. SKU-8842"
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  className="font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Min Stock Warning Level
                </label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={formData.minimumStockLevel}
                  onChange={e =>
                    setFormData({ ...formData, minimumStockLevel: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Product specifications, dimensions, color, material..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'active' })}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formData.status === 'active'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'inactive' })}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formData.status === 'inactive'
                      ? 'border-slate-500 bg-slate-100 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 text-slate-500" />
                  Inactive
                </button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PRODUCT DETAILS VIEW MODAL */}
      <Dialog open={!!viewingProduct} onOpenChange={open => !open && setViewingProduct(null)}>
        <DialogContent onClose={() => setViewingProduct(null)} className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{viewingProduct?.name}</DialogTitle>
                <DialogDescription>SKU: {viewingProduct?.sku}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {viewingProduct && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Product Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Category
                  </span>
                  <Badge variant="outline" className="font-semibold text-xs">
                    {viewingProduct.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Status
                  </span>
                  <Badge
                    variant={viewingProduct.status === 'active' ? 'success' : 'destructive'}
                    className="capitalize text-xs"
                  >
                    {viewingProduct.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Min Stock Threshold
                  </span>
                  <span className="font-bold text-slate-900">
                    {viewingProduct.minimumStockLevel} units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Selling Price
                  </span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {formatCurrency(viewingProduct.sellingPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Cost Price
                  </span>
                  <span className="font-bold text-slate-700 text-sm">
                    {formatCurrency(viewingProduct.costPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Total Current Stock
                  </span>
                  <span className="font-bold text-indigo-600 text-sm">
                    {(viewingProduct as any).currentStock || 0} units
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Description
                  </span>
                  <p className="text-slate-700 font-medium">
                    {viewingProduct.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Batches Associated with this Product */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Batches for this Product ({viewingBatches.length})
                  </h4>
                  <Link
                    href={`/shop-owner/batches?product=${viewingProduct.id}`}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    Manage in Batches Module <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {isLoadingViewBatches ? (
                    <div className="py-6 text-center text-slate-400">Loading batches...</div>
                  ) : viewingBatches.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">
                      No batches recorded yet for this product. Use the Batches module to add stock lots.
                    </div>
                  ) : (
                    viewingBatches.map(b => (
                      <div key={b.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-bold font-mono text-slate-900">{b.batchNumber}</p>
                          <p className="text-[10px] text-slate-400">
                            {b.branchName || 'Default Branch'} {b.expiryDate ? `• Exp: ${b.expiryDate.split('T')[0]}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">{b.quantity} units</p>
                          <Badge
                            variant={b.status === 'active' ? 'success' : 'secondary'}
                            className="text-[9px] uppercase px-1.5 py-0"
                          >
                            {b.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingProduct(null)}>
                  Close
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    const p = viewingProduct;
                    setViewingProduct(null);
                    openEditModal(p);
                  }}
                  className="flex items-center gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Product
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
