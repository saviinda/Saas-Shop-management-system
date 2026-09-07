'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ChangeRequest } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  X,
  FileText,
  Shield,
  Store,
  User,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';

export default function ChangeRequestsPage() {
  const { showSuccess, showError, showPrompt } = useModal();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
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

  const handleReview = (id: string, status: 'approved' | 'rejected') => {
    showPrompt(
      `${status === 'approved' ? 'Approve' : 'Reject'} Account Change Request`,
      `Enter optional verification/review notes for the shop owner (${status}):`,
      '',
      async (reviewNotes: string) => {
        try {
          await api.patch(`/change-requests/${id}/review`, {
            status,
            reviewNotes: reviewNotes.trim() || undefined,
          });
          if (selectedRequest && selectedRequest.id === id) {
            setSelectedRequest(null);
          }
          await fetchRequests();
          showSuccess(
            'Review Decision Processed',
            `Change request has been ${status}. Store profile updated and email notification dispatched to the shop owner.`
          );
        } catch (err: any) {
          showError('Review Failed', err.message || 'Failed to process change request.');
        }
      },
      status === 'approved' ? 'e.g. Identity verified. Change approved.' : 'e.g. Incomplete documentation provided.'
    );
  };

  const filteredRequests = requests.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.shopName?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.field?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  });

  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Protected Account Change Requests</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review sensitive data updates submitted by Shop Owners (Email, Ownership, Contacts, Business Profiles)
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Requests</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved & Applied</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rejected</span>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by shop, field, owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { label: 'All Requests', value: 'all' },
            { label: 'Pending Review', value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Shop Entity / Requester</th>
                <th className="py-3.5 px-6">Protected Field</th>
                <th className="py-3.5 px-6">Current Value</th>
                <th className="py-3.5 px-6">Requested Value</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Submitted Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading requests...</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No change requests found matching filters.</td></tr>
              ) : (
                filteredRequests.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRequest(r)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.shopName}</p>
                          <p className="text-[11px] text-slate-400">{r.requesterName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px]">
                        {r.field}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 max-w-[150px] truncate">{String(r.currentValue || 'N/A')}</td>
                    <td className="py-4 px-6 font-bold text-indigo-700 max-w-[180px] truncate">{String(r.requestedValue)}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : r.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {r.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {r.status === 'pending' && <Clock className="h-3 w-3" />}
                        {r.status === 'rejected' && <XCircle className="h-3 w-3" />}
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(r.createdAt)}</td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      {r.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReview(r.id, 'approved')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-2xs active:scale-[0.98] transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(r.id, 'rejected')}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold rounded-xl active:scale-[0.98] transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedRequest(r)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                        >
                          View Notes
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  <h3 className="font-bold text-slate-900 text-base">Change Request Review</h3>
                  <p className="text-xs text-slate-500">{selectedRequest.shopName}</p>
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
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                  <p className="font-bold mt-0.5 uppercase tracking-wide text-indigo-600">{selectedRequest.status}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Current Value</span>
                <p className="font-medium text-slate-700">{String(selectedRequest.currentValue || 'N/A')}</p>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Requested Value</span>
                <p className="font-bold text-emerald-950 text-sm">{String(selectedRequest.requestedValue)}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Reason / Justification</span>
                <p className="text-slate-700 leading-relaxed">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.reviewNotes && (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-800">Super Admin Review Notes</span>
                  <p className="text-indigo-950 font-medium">{selectedRequest.reviewNotes}</p>
                  {selectedRequest.reviewedBy && (
                    <p className="text-[10px] text-slate-500 pt-1">
                      Reviewed by: {selectedRequest.reviewedBy} {selectedRequest.reviewedAt ? `at ${formatDate(selectedRequest.reviewedAt)}` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Actions if pending */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Submitted: {formatDate(selectedRequest.createdAt)}</span>
                <div className="flex items-center gap-2">
                  {selectedRequest.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReview(selectedRequest.id, 'approved')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-2xs"
                      >
                        Approve & Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(selectedRequest.id, 'rejected')}
                        className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold rounded-xl"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
