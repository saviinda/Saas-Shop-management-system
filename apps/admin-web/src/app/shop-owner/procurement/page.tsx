'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { PurchaseOrder, GoodsReceivedNote, Supplier, Product, POStatus } from '@saas/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  Truck,
  Plus,
  FileCheck2,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  FileText,
  Trash2,
  Edit2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UploadCloud,
  Check,
  DollarSign,
  Package,
  Printer,
} from 'lucide-react';

export default function ProcurementPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch } = useBranch();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'po' | 'grn' | 'suppliers'>('po');
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // PO Modals & State
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedPODetails, setSelectedPODetails] = useState<PurchaseOrder | null>(null);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
    items: [{ productId: '', orderedQty: 10, unitCost: 10 }],
  });

  // GRN Modals & State
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [selectedGRNDetails, setSelectedGRNDetails] = useState<GoodsReceivedNote | null>(null);
  const [targetPOForGRN, setTargetPOForGRN] = useState<PurchaseOrder | null>(null);
  const [grnForm, setGrnForm] = useState({
    purchaseOrderId: '',
    notes: '',
    documentUrl: '',
    receivedItems: [] as Array<{
      productId: string;
      productName: string;
      receivedQty: number;
      damagedQty: number;
      unitCost: number;
    }>,
  });

  // Supplier Modals & State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<any | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    paymentTerms: 'Net 30',
    productsSupplied: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [poRes, grnRes, supRes, prdRes] = await Promise.all([
        api.get<PurchaseOrder[]>('/purchase-orders', { branchId: activeBranch?.id }),
        api.get<GoodsReceivedNote[]>('/grns', { branchId: activeBranch?.id }),
        api.get<Supplier[]>('/suppliers'),
        api.get<Product[]>('/products'),
      ]);
      setPurchaseOrders(poRes.data || []);
      setGrns(grnRes.data || []);
      setSuppliers(supRes.data || []);
      setProducts(prdRes.data || []);
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // ===================== PO HANDLERS =====================
  const openCreatePOModal = () => {
    setPoForm({
      supplierId: suppliers[0]?.id || '',
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Standard delivery via logistics partner',
      items: [{ productId: products[0]?.id || '', orderedQty: 25, unitCost: products[0]?.costPrice || 10 }],
    });
    setShowPOModal(true);
  };

  const addPOItemRow = () => {
    setPoForm(prev => ({
      ...prev,
      items: [...prev.items, { productId: products[0]?.id || '', orderedQty: 10, unitCost: products[0]?.costPrice || 10 }],
    }));
  };

  const removePOItemRow = (idx: number) => {
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const updatePOItemRow = (idx: number, field: string, value: any) => {
    setPoForm(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) updated[idx].unitCost = prod.costPrice;
      }
      return { ...prev, items: updated };
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch.');
      return;
    }
    if (!poForm.supplierId) {
      showError('Supplier Required', 'Please select a supplier.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/purchase-orders', {
        branchId: activeBranch.id,
        supplierId: poForm.supplierId,
        expectedDate: poForm.expectedDate || undefined,
        notes: poForm.notes.trim() || undefined,
        items: poForm.items.map(it => ({
          productId: it.productId,
          orderedQty: Number(it.orderedQty),
          unitCost: Number(it.unitCost),
        })),
      });

      setShowPOModal(false);
      showSuccess('Purchase Order Created', 'PO submitted and ready for supplier fulfillment.');
      await loadData();
    } catch (err: any) {
      showError('PO Creation Failed', err.message || 'Failed to create purchase order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePOStatus = async (poId: string, status: POStatus) => {
    try {
      await api.patch(`/purchase-orders/${poId}/status`, { status });
      if (selectedPODetails && selectedPODetails.id === poId) {
        setSelectedPODetails({ ...selectedPODetails, status });
      }
      showSuccess('PO Status Updated', `Purchase order is now marked as ${status.replace('_', ' ')}.`);
      await loadData();
    } catch (err: any) {
      showError('Status Update Failed', err.message || 'Could not update PO status.');
    }
  };

  // ===================== GRN HANDLERS =====================
  const openCreateGRNModalFromPO = (po: PurchaseOrder) => {
    setTargetPOForGRN(po);
    setGrnForm({
      purchaseOrderId: po.id,
      notes: `Goods received against PO #${po.poNumber}`,
      documentUrl: '',
      receivedItems: po.items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        receivedQty: it.orderedQty,
        damagedQty: 0,
        unitCost: it.unitCost,
      })),
    });
    setSelectedPODetails(null);
    setShowGRNModal(true);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPOForGRN) return;

    try {
      setIsSubmitting(true);
      await api.post('/grns', {
        purchaseOrderId: targetPOForGRN.id,
        notes: grnForm.notes.trim() || undefined,
        documentUrl: grnForm.documentUrl || undefined,
        receivedItems: grnForm.receivedItems.map(it => ({
          productId: it.productId,
          receivedQty: Number(it.receivedQty),
          damagedQty: Number(it.damagedQty || 0),
          unitCost: Number(it.unitCost),
        })),
      });

      setShowGRNModal(false);
      showSuccess('GRN Confirmed & Stock Updated', 'Goods received note finalized and branch inventory stock increased.');
      await loadData();
    } catch (err: any) {
      showError('GRN Failed', err.message || 'Failed to create Goods Received Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===================== SUPPLIER HANDLERS =====================
  const openAddSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      paymentTerms: 'Net 30',
      productsSupplied: [],
    });
    setShowSupplierModal(true);
  };

  const openEditSupplierModal = (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSupplier(sup);
    setSupplierForm({
      name: sup.name,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      address: sup.address || '',
      taxId: sup.taxId || '',
      paymentTerms: sup.paymentTerms || 'Net 30',
      productsSupplied: sup.productsSupplied || [],
    });
    setShowSupplierModal(true);
  };

  const handleOpenSupplier360 = async (sup: Supplier) => {
    try {
      const res = await api.get<any>(`/suppliers/${sup.id}`);
      setSelectedSupplierProfile(res.data);
    } catch (err: any) {
      showError('Profile Error', err.message || 'Could not load supplier profile.');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, supplierForm);
        showSuccess('Supplier Updated', `Supplier "${supplierForm.name}" updated.`);
      } else {
        await api.post('/suppliers', supplierForm);
        showSuccess('Supplier Added', `Supplier "${supplierForm.name}" added to directory.`);
      }
      setShowSupplierModal(false);
      await loadData();
    } catch (err: any) {
      showError('Supplier Save Failed', err.message || 'Could not save supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSupplierStatus = async (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = sup.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'Activate' : 'Deactivate';

    showConfirm(
      `${action} Supplier`,
      `Are you sure you want to ${action.toLowerCase()} "${sup.name}"?`,
      async () => {
        try {
          await api.patch(`/suppliers/${sup.id}`, { status: nextStatus });
          await loadData();
          showSuccess('Status Updated', `Supplier is now ${nextStatus}.`);
        } catch (err: any) {
          showError('Failed', err.message || 'Could not update supplier status.');
        }
      },
      action,
      nextStatus === 'inactive'
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Procurement, POs & Goods Received (GRN)</h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end purchasing: Purchase Orders → Goods Received Notes (GRN) → Automatic Stock Restock & Audit Logs
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'po' && (
            <button
              onClick={openCreatePOModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" /> Create Purchase Order
            </button>
          )}

          {activeTab === 'suppliers' && (
            <button
              onClick={openAddSupplierModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" /> Add New Supplier
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('po')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'po' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="h-4 w-4" /> Purchase Orders ({purchaseOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'grn' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="h-4 w-4" /> Goods Received Notes ({grns.length})
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" /> Supplier Directory ({suppliers.length})
        </button>
      </div>

      {/* ===================== TAB 1: PURCHASE ORDERS ===================== */}
      {activeTab === 'po' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">PO Number</th>
                    <th className="py-3.5 px-6">Supplier</th>
                    <th className="py-3.5 px-6">Ordered Items</th>
                    <th className="py-3.5 px-6">Total Cost</th>
                    <th className="py-3.5 px-6">Expected Date</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading purchase orders...</td></tr>
                  ) : purchaseOrders.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No purchase orders created yet.</td></tr>
                  ) : (
                    purchaseOrders.map(po => (
                      <tr
                        key={po.id}
                        onClick={() => setSelectedPODetails(po)}
                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6 font-mono font-bold text-indigo-600">#{po.poNumber}</td>
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-900">{po.supplierName}</p>
                          <p className="text-[10px] text-slate-400">By {po.createdBy}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-800">{po.items?.length || 0} product lines</span>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                            {po.items?.map(i => i.productName).join(', ')}
                          </p>
                        </td>
                        <td className="py-4 px-6 font-extrabold text-slate-900 text-sm">{formatCurrency(po.totalAmount)}</td>
                        <td className="py-4 px-6 text-slate-600">{po.expectedDate ? formatDate(po.expectedDate) : 'Not specified'}</td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                              po.status === 'fully_received'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : po.status === 'ordered' || po.status === 'partially_received'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : po.status === 'approved'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : po.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {po.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status !== 'fully_received' && po.status !== 'cancelled' && (
                              <button
                                onClick={() => openCreateGRNModalFromPO(po)}
                                title="Create GRN (Receive Goods)"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center gap-1"
                              >
                                <FileCheck2 className="h-3.5 w-3.5" /> Receive GRN
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedPODetails(po)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                            >
                              <Eye className="h-3.5 w-3.5" />
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
        </div>
      )}

      {/* ===================== TAB 2: GOODS RECEIVED NOTES ===================== */}
      {activeTab === 'grn' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">GRN Number</th>
                    <th className="py-3.5 px-6">Supplier</th>
                    <th className="py-3.5 px-6">Received Items Breakdown</th>
                    <th className="py-3.5 px-6">Inventory Value Added</th>
                    <th className="py-3.5 px-6">Received By</th>
                    <th className="py-3.5 px-6">Received Date</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading GRN receipts...</td></tr>
                  ) : grns.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No goods received notes recorded yet.</td></tr>
                  ) : (
                    grns.map(g => (
                      <tr
                        key={g.id}
                        onClick={() => setSelectedGRNDetails(g)}
                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6 font-mono font-bold text-emerald-600">#{g.grnNumber}</td>
                        <td className="py-4 px-6 font-bold text-slate-900">{g.supplierName}</td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-800">{g.receivedItems?.length || 0} items verified</span>
                          <p className="text-[10px] text-slate-400">
                            {g.receivedItems?.reduce((s, i) => s + i.receivedQty, 0)} total units
                          </p>
                        </td>
                        <td className="py-4 px-6 font-extrabold text-emerald-600 text-sm">{formatCurrency(g.totalValue)}</td>
                        <td className="py-4 px-6 text-slate-700">{g.receivedBy}</td>
                        <td className="py-4 px-6 text-slate-500">{formatDate(g.createdAt)}</td>
                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedGRNDetails(g)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5" /> View GRN
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: SUPPLIER DIRECTORY ===================== */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">Supplier Enterprise</th>
                    <th className="py-3.5 px-6">Contact Representative</th>
                    <th className="py-3.5 px-6">Payment Terms & Tax ID</th>
                    <th className="py-3.5 px-6">Total PO Spend</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoading ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">Loading supplier records...</td></tr>
                  ) : suppliers.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">No suppliers added yet.</td></tr>
                  ) : (
                    suppliers.map(sup => (
                      <tr
                        key={sup.id}
                        onClick={() => handleOpenSupplier360(sup)}
                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{sup.name}</p>
                              <p className="text-[11px] text-slate-400">{sup.address || 'No address'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-800">{sup.contactPerson}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" /> {sup.phone}
                          </p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" /> {sup.email}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                            {sup.paymentTerms || 'Net 30'}
                          </span>
                          {sup.taxId && <p className="text-[10px] text-slate-400 mt-0.5">Tax: {sup.taxId}</p>}
                        </td>
                        <td className="py-4 px-6 font-extrabold text-indigo-600 text-sm">
                          {formatCurrency((sup as any).totalSpend || 0)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              sup.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span className="capitalize">{sup.status}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenSupplier360(sup)}
                              title="Supplier 360"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => openEditSupplierModal(sup, e)}
                              title="Edit Supplier"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => handleToggleSupplierStatus(sup, e)}
                              title={sup.status === 'active' ? 'Deactivate' : 'Activate'}
                              className={`p-1.5 rounded-lg border ${
                                sup.status === 'active' ? 'text-amber-600 border-amber-200' : 'text-emerald-600 border-emerald-200'
                              }`}
                            >
                              {sup.status === 'active' ? 'Deactivate' : 'Activate'}
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
        </div>
      )}

      {/* ===================== VIEW PURCHASE ORDER DETAILS MODAL ===================== */}
      {selectedPODetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg font-mono">PO #{selectedPODetails.poNumber}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                    {selectedPODetails.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Created on {formatDate(selectedPODetails.createdAt)} by <b className="text-slate-800">{selectedPODetails.createdBy}</b>
                </p>
              </div>
              <button
                onClick={() => setSelectedPODetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Supplier & Delivery Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Supplier Enterprise</span>
                <p className="font-bold text-slate-900 text-sm">{selectedPODetails.supplierName}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Delivery Information</span>
                <p className="text-slate-700">
                  Expected Date: <b>{selectedPODetails.expectedDate ? formatDate(selectedPODetails.expectedDate) : 'Flexible'}</b>
                </p>
                {selectedPODetails.notes && <p className="text-slate-500">Note: {selectedPODetails.notes}</p>}
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4 text-center">Ordered Qty</th>
                    <th className="py-2.5 px-4 text-center">Received Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Line Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPODetails.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-4">
                        <p className="font-bold text-slate-900">{it.productName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</p>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-800">{it.orderedQty}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{it.receivedQty || 0}</td>
                      <td className="py-2.5 px-4 text-right">{formatCurrency(it.unitCost)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(it.orderedQty * it.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-4 text-right text-slate-900 text-sm">Total PO Amount:</td>
                    <td className="py-2.5 px-4 text-right text-indigo-600 font-extrabold text-sm">
                      {formatCurrency(selectedPODetails.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Lifecycle Status Action Bar */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800">PO Status Lifecycle Workflow:</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'fully_received', 'cancelled'] as POStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdatePOStatus(selectedPODetails.id, st)}
                    className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition-all ${
                      selectedPODetails.status === st
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.replace('_', ' ')}
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
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  <Printer className="h-4 w-4" /> Print PO
                </button>

                {selectedPODetails.status !== 'fully_received' && selectedPODetails.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => openCreateGRNModalFromPO(selectedPODetails)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-2xs"
                  >
                    <FileCheck2 className="h-4 w-4" /> Generate GRN Receipt
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedPODetails(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW GOODS RECEIVED NOTE (GRN) MODAL ===================== */}
      {selectedGRNDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg font-mono">GRN #{selectedGRNDetails.grnNumber}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                    {selectedGRNDetails.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Received & Verified on {formatDate(selectedGRNDetails.createdAt)} by <b className="text-slate-800">{selectedGRNDetails.receivedBy}</b>
                </p>
              </div>
              <button
                onClick={() => setSelectedGRNDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Supplier & Delivery Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Supplier & Origin</span>
                <p className="font-bold text-slate-900 text-sm">{selectedGRNDetails.supplierName}</p>
                <p className="text-[11px] text-slate-500">Linked PO Ref ID: {selectedGRNDetails.purchaseOrderId}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Inventory Value Increment</span>
                <p className="text-xl font-extrabold text-emerald-600">{formatCurrency(selectedGRNDetails.totalValue)}</p>
                {selectedGRNDetails.notes && <p className="text-slate-600 text-[11px]">Note: {selectedGRNDetails.notes}</p>}
              </div>
            </div>

            {/* Received Items Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4 text-center">Verified Received</th>
                    <th className="py-2.5 px-4 text-center">Damaged / Missing</th>
                    <th className="py-2.5 px-4 text-right">Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Total Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedGRNDetails.receivedItems.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{it.productName}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{it.receivedQty}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-rose-600">{it.damagedQty || 0}</td>
                      <td className="py-2.5 px-4 text-right">{formatCurrency(it.unitCost)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(it.receivedQty * it.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-4 text-right text-slate-900 text-sm">Total GRN Value:</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-extrabold text-sm">
                      {formatCurrency(selectedGRNDetails.totalValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
              >
                <Printer className="h-4 w-4" /> Print GRN Slip
              </button>

              <button
                type="button"
                onClick={() => setSelectedGRNDetails(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE PO MODAL ===================== */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Create Purchase Order</h3>
                  <p className="text-xs text-slate-500">Order inventory products from registered suppliers</p>
                </div>
              </div>
              <button onClick={() => setShowPOModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Select Supplier *</label>
                  <select
                    value={poForm.supplierId}
                    onChange={e => setPoForm({ ...poForm, supplierId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.contactPerson})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={poForm.expectedDate}
                    onChange={e => setPoForm({ ...poForm, expectedDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Order Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Ordered Products</span>
                  <button
                    type="button"
                    onClick={addPOItemRow}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Product Row
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {poForm.items.map((row, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Product</label>
                        <select
                          value={row.productId}
                          onChange={e => updatePOItemRow(idx, 'productId', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.orderedQty}
                          onChange={e => updatePOItemRow(idx, 'orderedQty', parseInt(e.target.value) || 1)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>

                      <div className="w-28">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Unit Cost ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={row.unitCost}
                          onChange={e => updatePOItemRow(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-600"
                        />
                      </div>

                      {poForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePOItemRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-2 mt-4"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Delivery terms, special handling instructions..."
                  value={poForm.notes}
                  onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Total PO Cost: <b>${poForm.items.reduce((s, it) => s + (it.orderedQty * it.unitCost), 0).toFixed(2)}</b>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPOModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Create & Submit PO'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== CREATE GRN MODAL ===================== */}
      {showGRNModal && targetPOForGRN && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Generate Goods Received Note (GRN)</h3>
                  <p className="text-xs text-slate-500">Against PO #{targetPOForGRN.poNumber} &bull; Supplier: {targetPOForGRN.supplierName}</p>
                </div>
              </div>
              <button onClick={() => setShowGRNModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                Confirming this GRN will automatically increment branch stock quantities and log `po_receive` stock movement audit entries.
              </div>

              {/* Items Verification Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Received Qty</th>
                      <th className="py-2.5 px-3 text-center">Damaged Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grnForm.receivedItems.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{row.productName}</td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            required
                            value={row.receivedQty}
                            onChange={e => {
                              const updated = [...grnForm.receivedItems];
                              updated[idx].receivedQty = parseInt(e.target.value) || 0;
                              setGrnForm({ ...grnForm, receivedItems: updated });
                            }}
                            className="w-20 p-1.5 border border-slate-200 rounded-lg text-center font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.damagedQty}
                            onChange={e => {
                              const updated = [...grnForm.receivedItems];
                              updated[idx].damagedQty = parseInt(e.target.value) || 0;
                              setGrnForm({ ...grnForm, receivedItems: updated });
                            }}
                            className="w-20 p-1.5 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-center font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {formatCurrency(row.unitCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Inspection Notes</label>
                <textarea
                  rows={2}
                  placeholder="Packaging condition, batch numbers, inspection observations..."
                  value={grnForm.notes}
                  onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGRNModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Confirming...' : 'Verify & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== SUPPLIER 360 MODAL ===================== */}
      {selectedSupplierProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedSupplierProfile.supplier.name}</h3>
                  <p className="text-xs text-slate-500">Contact: {selectedSupplierProfile.supplier.contactPerson} &bull; {selectedSupplierProfile.supplier.phone}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSupplierProfile(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total POs</span>
                <p className="text-lg font-extrabold text-slate-900 mt-0.5">{selectedSupplierProfile.purchaseOrders.length}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Spend</span>
                <p className="text-lg font-extrabold text-indigo-600 mt-0.5">{formatCurrency(selectedSupplierProfile.totalSpend)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</span>
                <p className="text-xs font-bold text-slate-800 mt-1">{selectedSupplierProfile.supplier.paymentTerms || 'Net 30'}</p>
              </div>
            </div>

            {/* PO History */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs">Recent Purchase Orders</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {selectedSupplierProfile.purchaseOrders.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No POs recorded for this supplier.</p>
                ) : (
                  selectedSupplierProfile.purchaseOrders.map((p: any) => (
                    <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 font-mono">#{p.poNumber}</span>
                        <span className="text-slate-400 ml-2">{formatDate(p.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{formatCurrency(p.totalAmount)}</span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] capitalize font-semibold">
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedSupplierProfile(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADD / EDIT SUPPLIER MODAL ===================== */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier'}
              </h3>
              <button onClick={() => setShowSupplierModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Beverage Importers Ltd."
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Vance"
                    value={supplierForm.contactPerson}
                    onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 555 992 1029"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="orders@acmesupplies.com"
                  value={supplierForm.email}
                  onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Payment Terms</label>
                  <select
                    value={supplierForm.paymentTerms}
                    onChange={e => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Tax ID / VAT Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TAX-88392"
                    value={supplierForm.taxId}
                    onChange={e => setSupplierForm({ ...supplierForm, taxId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street, City, Postal Code"
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
