'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { ProductCategory } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  FolderTree,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export default function ProductCategoriesPage() {
  const { showSuccess, showError, showConfirm } = useModal();

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dialog State (Create / Edit)
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });

  // View Details Dialog State
  const [viewingCategory, setViewingCategory] = useState<ProductCategory | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [isLoadingCategoryProducts, setIsLoadingCategoryProducts] = useState(false);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<ProductCategory[]>('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      showError('Fetch Error', 'Failed to retrieve product categories from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Filtered & Paginated Categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCategories, currentPage, itemsPerPage]);

  // Total summary stats
  const totalProductsCount = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
  const activeCount = categories.filter(c => c.status === 'active').length;
  const inactiveCount = categories.filter(c => c.status === 'inactive').length;

  const handleOpenCreateDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      status: 'active',
    });
    setFormError(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (category: ProductCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      status: category.status,
    });
    setFormError(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenViewDialog = async (category: ProductCategory) => {
    setViewingCategory(category);
    setIsViewDialogOpen(true);
    setIsLoadingCategoryProducts(true);
    try {
      const res = await api.get<any>(`/categories/${category.id}`);
      if (res.data && res.data.products) {
        setCategoryProducts(res.data.products);
      } else {
        setCategoryProducts([]);
      }
    } catch (err) {
      console.warn('Could not load specific category products:', err);
      setCategoryProducts([]);
    } finally {
      setIsLoadingCategoryProducts(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
        });
        showSuccess(
          'Category Updated',
          `Category "${formData.name.trim()}" has been updated successfully.`
        );
      } else {
        await api.post('/categories', {
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
        });
        showSuccess(
          'Category Created',
          `Category "${formData.name.trim()}" has been created successfully.`
        );
      }

      setIsFormDialogOpen(false);
      await fetchCategories();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save category. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = (category: ProductCategory) => {
    if (category.productCount && category.productCount > 0) {
      showError(
        'Category In Use',
        `Cannot delete "${category.name}" because ${category.productCount} product(s) are currently assigned to this category. Please reassign those products before deleting.`
      );
      return;
    }

    showConfirm(
      'Delete Category',
      `Are you sure you want to permanently delete category "${category.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/categories/${category.id}`);
          showSuccess('Deleted', `Category "${category.name}" was successfully deleted.`);
          await fetchCategories();
        } catch (err: any) {
          const msg = err instanceof ApiError ? err.message : 'Failed to delete category.';
          showError('Delete Failed', msg);
        }
      },
      'Delete Category',
      true
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FolderTree className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Product Categories
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Organize catalog inventory by grouping items into structured, searchable classifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCategories}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleOpenCreateDialog}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Total Categories</span>
              <FolderTree className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-1">
              {categories.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Active classifications in shop
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Active Status</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 mt-1">
              {activeCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Available for product assignment
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Inactive Categories</span>
              <AlertTriangle className="h-4 w-4 text-slate-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-700 mt-1">
              {inactiveCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Archived or hidden categories
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-[11px]">
              <span>Assigned Products</span>
              <Package className="h-4 w-4 text-indigo-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600 mt-1">
              {totalProductsCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Items organized under categories
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      <Card>
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search category name or description..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Status:</span>
            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatusFilter(s);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                    statusFilter === s
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Category Name</TableHead>
                <TableHead className="w-[35%]">Description</TableHead>
                <TableHead className="w-[12%] text-center">Products</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[13%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>Loading product categories...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <Tag className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No categories found</p>
                      <p className="text-[11px] text-slate-400">
                        {search || statusFilter !== 'all'
                          ? 'Try changing your search keywords or status filter.'
                          : 'Get started by creating your first product category.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCategories.map(cat => (
                  <TableRow key={cat.id} className="hover:bg-slate-50/80">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold">
                          <Tag className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{cat.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Created {formatDate(cat.createdAt)}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed">
                        {cat.description || (
                          <span className="text-slate-400 italic">No description provided</span>
                        )}
                      </p>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant={cat.productCount && cat.productCount > 0 ? 'info' : 'secondary'}
                        className="font-mono text-[11px]"
                      >
                        {cat.productCount || 0} items
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={cat.status === 'active' ? 'success' : 'destructive'}
                        className="capitalize"
                      >
                        {cat.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenViewDialog(cat)}
                          title="View Details"
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(cat)}
                          title="Edit Category"
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete Category"
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredCategories.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredCategories.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemName="categories"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT CATEGORY MODAL */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent onClose={() => setIsFormDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Update category details. Renaming will automatically update all products assigned to this category.'
                : 'Define a new product classification to categorize your catalog inventory items.'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Papers, Ink & Toners, Binding Supplies..."
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Brief summary of items classified under this category..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'active' })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                onClick={() => setIsFormDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : editingCategory
                  ? 'Update Category'
                  : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW CATEGORY DETAILS DIALOG */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent onClose={() => setIsViewDialogOpen(false)} className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{viewingCategory?.name}</DialogTitle>
                <DialogDescription>Category Specification & Associated Products</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {viewingCategory && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Category Status
                  </span>
                  <Badge
                    variant={viewingCategory.status === 'active' ? 'success' : 'destructive'}
                    className="capitalize"
                  >
                    {viewingCategory.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Total Products
                  </span>
                  <span className="font-bold text-slate-900">
                    {viewingCategory.productCount || 0} catalog item(s)
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Description
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {viewingCategory.description || 'No description entered for this category.'}
                  </p>
                </div>
              </div>

              {/* Products in this Category */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Products in this Category ({categoryProducts.length})
                </h4>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {isLoadingCategoryProducts ? (
                    <div className="py-8 text-center text-slate-400">Loading catalog items...</div>
                  ) : categoryProducts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      No products are currently assigned to this category.
                    </div>
                  ) : (
                    categoryProducts.map(p => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          ${p.sellingPrice?.toFixed(2) || '0.00'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    handleOpenEditDialog(viewingCategory);
                  }}
                  className="flex items-center gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Category
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
