'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ChangeRequest } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  FileCheck2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Store,
  Mail,
  User,
  Phone,
  Building2,
  Tag,
  RefreshCw,
  X,
  FileText,
  ArrowRight,
  Info,
} from 'lucide-react';

const PROTECTED_FIELDS = [
  { id: 'businessName', label: 'Business / Shop Name', category: 'Business Information', key: 'name' },
  { id: 'businessCategory', label: 'Business Category', category: 'Business Information', key: 'category' },
  { id: 'businessAddress', label: 'Registered Business Address', category: 'Business Information', key: 'address' },
  { id: 'ownerEmail', label: 'Official / Owner Email Address', category: 'Ownership & Credentials', key: 'email' },
  { id: 'ownerName', label: 'Primary Owner Legal Name', category: 'Ownership & Credentials', key: 'ownerName' },
  { id: 'contactNumber', label: 'Registered Contact Number', category: 'Contact Details', key: 'contactNumber' },
  { id: 'openingHours', label: 'Official Operating Hours', category: 'Operations', key: 'openingHours' },
  { id: 'other', label: 'Other Protected Account Detail', category: 'General', key: 'other' },
];

export default function ShopOwnerChangeRequestsPage() {
  const { user, shop } = useAuth();
  const { showSuccess, showError } = useModal();

  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Submit Modal State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(PROTECTED_FIELDS[0].id);
  const [customFieldName, setCustomFieldName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Inspection Modal
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<ChangeRequest[]>('/change-requests', {
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load change requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  // Update prefilled current value when field selection changes
  useEffect(() => {
    const fieldObj = PROTECTED_FIELDS.find(f => f.id === selectedFieldId);
    if (!fieldObj) return;

    if (fieldObj.id === 'other') {
      setCurrentValue('');
      return;
    }

    if (shop) {
      const val = (shop as any)[fieldObj.key] || (user as any)[fieldObj.key] || '';
      setCurrentValue(String(val));
    }
  }, [selectedFieldId, shop, user]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedValue.trim() || !reason.trim()) {
      showError('Missing Information', 'Please provide the requested new value and a detailed justification reason.');
      return;
    }

    const fieldObj = PROTECTED_FIELDS.find(f => f.id === selectedFieldId);
    const finalFieldLabel = selectedFieldId === 'other' ? customFieldName.trim() || 'Custom Field' : fieldObj?.label || selectedFieldId;

    setIsSubmitting(true);
    try {
      await api.post('/change-requests', {
        field: finalFieldLabel,
        currentValue: currentValue || 'N/A',
        requestedValue: requestedValue.trim(),
        reason: reason.trim(),
      });

      setShowSubmitModal(false);
      setRequestedValue('');
      setReason('');
      setCustomFieldName('');
      await fetchRequests();

      showSuccess(
        'Change Request Submitted',
        'Your request has been routed to the Super Admin team for verification. You will be notified once reviewed.'
      );
    } catch (err: any) {
      showError('Submission Failed', err.message || 'Failed to submit account change request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Account Change Request Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              BR-05 Compliance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Request official modifications to protected store ownership, legal business details, and official contacts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRequests}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Submit Change Request
          </button>
        </div>
      </div>

      {/* Workflow Explanatory Card */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50/80 p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-300">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Protected Information Governance Workflow</h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              To prevent unauthorized changes to shop ownership, registered contacts, and business profiles, changes require administrative verification. Once approved by Super Admin, your store profile is updated automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 shrink-0 bg-white px-3.5 py-2 rounded-xl border border-indigo-100 shadow-2xs">
          <span>Shop Owner</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>Super Admin Review</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>Auto-Apply</span>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Submissions</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Historical requests</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Under Review</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Awaiting Super Admin</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved & Applied</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{approvedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Updated in database</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rejected / Feedback</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{rejectedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Requires clarification</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { label: 'All Requests', value: 'all' },
          { label: 'Pending Review', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Protected Field</th>
                <th className="py-3.5 px-6">Current Value</th>
                <th className="py-3.5 px-6">Requested Value</th>
                <th className="py-3.5 px-6">Reason / Justification</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Submitted Date</th>
                <th className="py-3.5 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading change requests history...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileCheck2 className="h-8 w-8 text-slate-300" />
                      <p className="text-slate-600 font-semibold">No change requests found</p>
                      <p className="text-[11px] text-slate-400">Submit a change request whenever you need to update official store information.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRequest(r)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-900 block">{r.field}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {r.id.slice(0, 8)}...</span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 max-w-[150px] truncate">
                      {String(r.currentValue || 'N/A')}
                    </td>
                    <td className="py-4 px-6 font-bold text-indigo-700 max-w-[180px] truncate">
                      {String(r.requestedValue)}
                    </td>
                    <td className="py-4 px-6 text-slate-600 max-w-[200px] truncate">
                      {r.reason}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          r.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {r.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {r.status === 'pending' && <Clock className="h-3 w-3" />}
                        {r.status === 'rejected' && <XCircle className="h-3 w-3" />}
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(r.createdAt)}</td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedRequest(r)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBMIT CHANGE REQUEST MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Submit Account Change Request</h3>
                  <p className="text-xs text-slate-500">Request update for protected store or ownership information</p>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              {/* Field Selection */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Select Protected Information Field <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedFieldId}
                  onChange={e => setSelectedFieldId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                >
                  {PROTECTED_FIELDS.map(f => (
                    <option key={f.id} value={f.id}>
                      [{f.category}] {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFieldId === 'other' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Custom Protected Field Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tax Registration Number, Banking Entity"
                    value={customFieldName}
                    onChange={e => setCustomFieldName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Current Value Preview */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Current Registered Value</label>
                <input
                  type="text"
                  readOnly
                  value={currentValue || 'No existing value registered'}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed"
                />
              </div>

              {/* Requested New Value */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Requested New Value <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter the exact new value to be applied"
                  value={requestedValue}
                  onChange={e => setRequestedValue(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Reason / Justification */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Reason & Justification for Change <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide background context or reference why this change is necessary (e.g. business relocation, legal ownership transfer, new official company email)..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Security info banner */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  Upon submission, this change request will be reviewed by the Super Admin compliance team. When approved, your store profile will update automatically and you will receive an email confirmation.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? 'Submitting to Super Admin...' : 'Submit Change Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT DETAIL MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Change Request Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedRequest.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Target Field</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedRequest.field}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Status</span>
                  <p className="font-bold mt-0.5 uppercase tracking-wide text-indigo-600">{selectedRequest.status}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Previous Registered Value</span>
                <p className="font-medium text-slate-700">{String(selectedRequest.currentValue || 'N/A')}</p>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Requested New Value</span>
                <p className="font-bold text-emerald-950 text-sm">{String(selectedRequest.requestedValue)}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Reason / Justification Provided</span>
                <p className="text-slate-700 leading-relaxed">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.reviewNotes && (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-800">Super Admin Reviewer Feedback</span>
                  <p className="text-indigo-950 font-medium">{selectedRequest.reviewNotes}</p>
                  {selectedRequest.reviewedBy && (
                    <p className="text-[10px] text-slate-500 pt-1">
                      Reviewed by: {selectedRequest.reviewedBy} {selectedRequest.reviewedAt ? `at ${formatDate(selectedRequest.reviewedAt)}` : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Submitted: {formatDate(selectedRequest.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
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
