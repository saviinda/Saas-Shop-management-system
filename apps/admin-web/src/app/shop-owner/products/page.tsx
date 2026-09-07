'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';
import { Product, Supplier } from '@saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  UploadCloud,
  Check,
  X,
  Globe,
  Tag,
  Boxes,
  Truck,
  Sparkles,
  Layers,
  Power,
  CheckCircle2,
  FolderPlus,
  Settings,
} from 'lucide-react';

const DEFAULT_STANDARD_CATEGORIES = [
  'Beverages & Coffee',
  'Food & Bakery',
  'Electronics & Gadgets',
  'Apparel & Fashion',
  'Health & Beauty',
  'Home & Living',
  'Hardware & Tools',
  'Services & Repairs',
  'General Merchandise',
];

export default function ProductsCatalogPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch } = useBranch();
  const { shop } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Modals State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Manage Categories Modal State
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  // Inline Custom Category Input in Product Modal
  const [isAddingInlineCategory, setIsAddingInlineCategory] = useState(false);
  const [inlineCategoryInput, setInlineCategoryInput] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Beverages & Coffee',
    description: '',
    imageUrl: '',
    costPrice: 0,
    sellingPrice: 0,
    minimumStockLevel: 5,
    initialStock: 25,
    supplierId: '',
    status: 'active' as 'active' | 'inactive',
    isPublic: true,
    isFeatured: false,
    tags: [] as string[],
    variants: [] as Array<{ name: string; options: string[]; priceModifier?: number; sku?: string }>,
  });

  const [tagInput, setTagInput] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantOptions, setVariantOptions] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom categories from storage
  useEffect(() => {
    if (typeof window !== 'undefined' && shop?.id) {
      try {
        const stored = localStorage.getItem(`saas_custom_categories_${shop.id}`);
        if (stored) {
          setCustomCategories(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load custom categories:', e);
      }
    }
  }, [shop?.id]);

  const saveCustomCategories = (updatedCategories: string[]) => {
    setCustomCategories(updatedCategories);
    if (typeof window !== 'undefined' && shop?.id) {
      try {
        localStorage.setItem(`saas_custom_categories_${shop.id}`, JSON.stringify(updatedCategories));
      } catch (e) {
        console.error('Failed to persist custom categories:', e);
      }
    }
  };

  const fetchProductsAndSuppliers = async () => {
    try {
      setIsLoading(true);
      const [prodRes, supRes] = await Promise.all([
        api.get<Product[]>('/products'),
        api.get<Supplier[]>('/suppliers').catch(() => ({ data: [] })),
      ]);
      setProducts(prodRes.data || []);
      setSuppliers(supRes.data || []);

      // Discover any categories from existing products
      const existingCats = new Set<string>();
      (prodRes.data || []).forEach(p => {
        if (p.category && !DEFAULT_STANDARD_CATEGORIES.includes(p.category)) {
          existingCats.add(p.category);
        }
      });
      if (existingCats.size > 0) {
        setCustomCategories(prev => Array.from(new Set([...prev, ...Array.from(existingCats)])));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndSuppliers();
  }, []);

  // Combined all available categories (Standard + Custom)
  const allCategories = Array.from(new Set([...DEFAULT_STANDARD_CATEGORIES, ...customCategories]));

  const handleCreateCustomCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (allCategories.includes(trimmed)) {
      showError('Category Exists', `Category "${trimmed}" already exists.`);
      return;
    }
    const updated = [...customCategories, trimmed];
    saveCustomCategories(updated);
    showSuccess('Category Added', `Custom category "${trimmed}" created successfully.`);
    setNewCategoryNameInput('');
  };

  const handleDeleteCustomCategory = (catName: string) => {
    const countInUse = products.filter(p => p.category === catName).length;
    if (countInUse > 0) {
      showError('Category In Use', `Cannot delete "${catName}" because ${countInUse} product(s) are currently assigned to it.`);
      return;
    }
    const updated = customCategories.filter(c => c !== catName);
    saveCustomCategories(updated);
    showSuccess('Category Removed', `Category "${catName}" removed.`);
  };

  const handleApplyInlineCategory = () => {
    const trimmed = inlineCategoryInput.trim();
    if (!trimmed) {
      setIsAddingInlineCategory(false);
      return;
    }
    if (!allCategories.includes(trimmed)) {
      saveCustomCategories([...customCategories, trimmed]);
    }
    setFormData(prev => ({ ...prev, category: trimmed }));
    setInlineCategoryInput('');
    setIsAddingInlineCategory(false);
    showSuccess('Category Selected', `Selected "${trimmed}".`);
  };

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setFormData(prev => ({ ...prev, imageUrl: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setModalError(null);
    setIsAddingInlineCategory(false);
    setInlineCategoryInput('');
    setFormData({
      name: '',
      sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
      category: allCategories[0] || 'Beverages & Coffee',
      description: '',
      imageUrl: '',
      costPrice: 10,
      sellingPrice: 20,
      minimumStockLevel: 5,
      initialStock: 50,
      supplierId: suppliers.length > 0 ? suppliers[0].id : '',
      status: 'active',
      isPublic: true,
      isFeatured: false,
      tags: ['New Arrival'],
      variants: [],
    });
    setTagInput('');
    setVariantName('');
    setVariantOptions('');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalError(null);
    setIsAddingInlineCategory(false);
    setInlineCategoryInput('');
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      minimumStockLevel: product.minimumStockLevel,
      initialStock: (product as any).currentStock || 0,
      supplierId: product.supplierId || '',
      status: product.status || 'active',
      isPublic: product.isPublic !== false,
      isFeatured: !!product.isFeatured,
      tags: product.tags || [],
      variants: product.variants || [],
    });
    setTagInput('');
    setVariantName('');
    setVariantOptions('');
    setShowModal(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (t: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== t) }));
  };

  const addVariant = () => {
    if (!variantName.trim() || !variantOptions.trim()) return;
    const opts = variantOptions.split(',').map(o => o.trim()).filter(Boolean);
    if (opts.length === 0) return;

    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { name: variantName.trim(), options: opts }],
    }));
    setVariantName('');
    setVariantOptions('');
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Product Name is required');
      return;
    }
    if (!formData.sku.trim()) {
      setModalError('Product SKU code is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const supplierObj = suppliers.find(s => s.id === formData.supplierId);

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        category: formData.category,
        description: formData.description.trim(),
        imageUrl: formData.imageUrl || undefined,
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        minimumStockLevel: Number(formData.minimumStockLevel),
        supplierId: formData.supplierId || undefined,
        supplierName: supplierObj?.name,
        initialStock: Number(formData.initialStock),
        status: formData.status,
        isPublic: formData.isPublic,
        isFeatured: formData.isFeatured,
        tags: formData.tags,
        variants: formData.variants,
      };

      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        showSuccess('Product Updated', `Product "${formData.name}" has been updated.`);
      } else {
        await api.post('/products', payload);
        showSuccess('Product Added', `Product "${formData.name}" is now in your catalog.`);
      }

      setShowModal(false);
      await fetchProductsAndSuppliers();
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

  const handleToggleStatus = (p: Product) => {
    const nextStatus = p.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${action} Product`,
      `Are you sure you want to ${action.toLowerCase()} "${p.name}"? ${
        nextStatus === 'inactive' ? 'It will be hidden from customer sales and public catalog.' : 'It will be available for sales.'
      }`,
      async () => {
        try {
          await api.patch(`/products/${p.id}`, { status: nextStatus });
          await fetchProductsAndSuppliers();
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
      `Are you sure you want to delete "${p.name}" (${p.sku})? This will remove its SKU records across branches.`,
      async () => {
        try {
          await api.delete(`/products/${p.id}`);
          await fetchProductsAndSuppliers();
          showSuccess('Product Deleted', 'Product removed successfully.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete product.');
        }
      },
      'Delete Product',
      true
    );
  };

  const filteredProducts = products.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    const currentStock = (p as any).currentStock || 0;
    if (stockFilter === 'in_stock' && currentStock <= 0) return false;
    if (stockFilter === 'low_stock' && (currentStock <= 0 || currentStock > p.minimumStockLevel)) return false;
    if (stockFilter === 'out_of_stock' && currentStock > 0) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const profitMargin = formData.sellingPrice > 0
    ? Math.round(((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog & Inventory SKUs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage customizable product categories, pricing margins, stock quantities, suppliers, and variants (BR-10)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCategoryManagerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <FolderPlus className="h-4 w-4 text-indigo-600" /> Manage Categories ({allCategories.length})
          </button>

          {/* Add Product Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Add New Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Category Dropdown Filter (includes standard + custom categories) */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories ({allCategories.length})</option>
            {allCategories.map(c => (
              <option key={c} value={c}>
                {c} {customCategories.includes(c) ? '(Custom)' : ''}
              </option>
            ))}
          </select>

          {/* Stock Level Filter */}
          <select
            value={stockFilter}
            onChange={e => setStockFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock Warning</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Product / SKU</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Selling / Cost Price</th>
                <th className="py-3.5 px-6">Total Stock</th>
                <th className="py-3.5 px-6">Supplier</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading product catalog...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No products found matching your search.</td></tr>
              ) : (
                filteredProducts.map(p => {
                  const stock = (p as any).currentStock || 0;
                  const isLow = stock <= p.minimumStockLevel && stock > 0;
                  const isOut = stock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                              {p.isFeatured && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                                  FEATURED
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</p>
                            {p.variants && p.variants.length > 0 && (
                              <span className="text-[10px] text-indigo-600 font-semibold">
                                {p.variants.length} variant types
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-sm">{formatCurrency(p.sellingPrice)}</p>
                        <p className="text-[10px] text-slate-400">Cost: {formatCurrency(p.costPrice)}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {stock} units
                          </span>
                          {isLow && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 rounded border border-amber-200">
                              Low Stock
                            </span>
                          )}
                          {isOut && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-700 rounded border border-rose-200">
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-xs">
                        {p.supplierName || 'Internal / Direct'}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            p.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {p.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                          <span className="capitalize">{p.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product Details"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            title={p.status === 'active' ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              p.status === 'active'
                                ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                                : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete Product"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      {/* MANAGE CUSTOM CATEGORIES MODAL */}
      {showCategoryManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Manage Product Categories</h3>
                  <p className="text-xs text-slate-500">Create, customize, or delete product classification categories</p>
                </div>
              </div>
              <button
                onClick={() => setShowCategoryManagerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add New Custom Category Box */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">Create New Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Organic Syrups, Cold Brew, Pastries..."
                  value={newCategoryNameInput}
                  onChange={e => setNewCategoryNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCustomCategory(newCategoryNameInput);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => handleCreateCustomCategory(newCategoryNameInput)}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shrink-0 shadow-2xs transition-colors"
                >
                  Add Category
                </button>
              </div>
            </div>

            {/* List of Categories */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-800 block">Existing Categories ({allCategories.length})</span>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {allCategories.map(cat => {
                  const isCustom = customCategories.includes(cat);
                  const count = products.filter(p => p.category === cat).length;

                  return (
                    <div
                      key={cat}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{cat}</span>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                            Custom
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({count} products)</span>
                      </div>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomCategory(cat)}
                          title="Delete Custom Category"
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCategoryManagerModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE ADD / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product to Catalog'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure SKU identifiers, pricing margins, stock parameters, and variants</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Image Upload Box */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800">Product Image</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-36 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all"
                  >
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Product" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-slate-400">
                        <UploadCloud className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-indigo-600" />
                        <span className="text-[11px] font-semibold block">Click to upload photo</span>
                        <span className="text-[9px] text-slate-400">JPG, PNG (Max 5MB)</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    className="hidden"
                  />
                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                      className="text-[11px] text-rose-600 font-semibold hover:underline block text-center w-full"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Main Product Info */}
                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Colombian Espresso Roast"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">SKU Code / Barcode *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SKU-8842"
                        value={formData.sku}
                        onChange={e => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Customizable Product Category Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-800">Product Category</label>
                        <button
                          type="button"
                          onClick={() => setIsAddingInlineCategory(!isAddingInlineCategory)}
                          className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                        >
                          {isAddingInlineCategory ? 'Select Existing' : '+ Custom Category'}
                        </button>
                      </div>

                      {isAddingInlineCategory ? (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Type custom category..."
                            value={inlineCategoryInput}
                            onChange={e => setInlineCategoryInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyInlineCategory();
                              }
                            }}
                            className="w-full p-2 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleApplyInlineCategory}
                            className="px-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs shrink-0"
                          >
                            Set
                          </button>
                        </div>
                      ) : (
                        <select
                          value={formData.category}
                          onChange={e => {
                            if (e.target.value === '__add_custom__') {
                              setIsAddingInlineCategory(true);
                            } else {
                              setFormData({ ...formData, category: e.target.value });
                            }
                          }}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                        >
                          {allCategories.map(c => (
                            <option key={c} value={c}>
                              {c} {customCategories.includes(c) ? '(Custom)' : ''}
                            </option>
                          ))}
                          <option value="__add_custom__">+ Create New Custom Category...</option>
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Supplier Link</label>
                      <select
                        value={formData.supplierId}
                        onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Direct / Internal Supplier</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.contactPerson})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Product details, specifications, packaging..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Margins Grid */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-indigo-600" /> Pricing & Profit Margins
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Selling Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.sellingPrice}
                      onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold text-indigo-700"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Min Stock Level</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.minimumStockLevel}
                      onChange={e => setFormData({ ...formData, minimumStockLevel: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>

                  {!editingProduct && (
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Initial Stock Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.initialStock}
                        onChange={e => setFormData({ ...formData, initialStock: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-500">
                    Gross Profit per Unit: <b>${Math.max(0, formData.sellingPrice - formData.costPrice).toFixed(2)}</b>
                  </span>
                  <span className={`font-bold ${profitMargin > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    Profit Margin: {profitMargin}%
                  </span>
                </div>
              </div>

              {/* Product Variants Section */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-600" /> Product Variants (Optional)
                  </span>
                  <span className="text-[10px] text-slate-400">e.g. Size: S, M, L or Flavour: Vanilla, Chocolate</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Variant name (e.g. Size)"
                    value={variantName}
                    onChange={e => setVariantName(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-xs w-full sm:w-1/3"
                  />
                  <input
                    type="text"
                    placeholder="Options comma-separated (e.g. Small, Medium, Large)"
                    value={variantOptions}
                    onChange={e => setVariantOptions(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Add Variant
                  </button>
                </div>

                {formData.variants.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <b className="text-slate-800">{v.name}:</b>
                          <span className="text-slate-600 ml-2">{v.options.join(', ')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Public Store & Mobile App Flags */}
              <div className="flex flex-wrap items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800 text-xs">Publish on Online Store & Mobile App</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800 text-xs">Feature on Homepage</span>
                  </label>
                </div>

                {/* Status Selector */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 text-xs">Status:</span>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
