'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { AuditLog } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { TablePagination } from '@/components/TablePagination';
import {
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Eye,
  ChevronRight,
  ShieldCheck,
  FileJson,
} from 'lucide-react';

interface ActorOption {
  id: string;
  name: string;
  role?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown options
  const [availableActors, setAvailableActors] = useState<ActorOption[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Selected Log Details Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  // Pagination & scrolling
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams: Record<string, string | number | undefined> = {};
      if (search.trim()) queryParams.search = search.trim();
      if (selectedUser && selectedUser !== 'all') queryParams.user = selectedUser;
      if (selectedAction && selectedAction !== 'all') queryParams.action = selectedAction;
      if (startDate) queryParams.startDate = startDate;
      if (endDate) queryParams.endDate = endDate;

      const res = await api.get<AuditLog[]>('/audit-logs', queryParams);
      setLogs(res.data || []);

      if (res.meta?.availableActors) {
        setAvailableActors(res.meta.availableActors);
      }
      if (res.meta?.availableActions) {
        setAvailableActions(res.meta.availableActions);
      }
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Failed to fetch audit log trail from server.');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedUser, selectedAction, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    (selectedUser && selectedUser !== 'all') ||
    (selectedAction && selectedAction !== 'all') ||
    startDate ||
    endDate
  );

  const handleResetFilters = () => {
    setSearch('');
    setSelectedUser('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleQuickDatePreset = (preset: 'today' | '7days' | '30days' | 'all') => {
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const str = formatYMD(today);
      setStartDate(str);
      setEndDate(str);
    } else if (preset === '7days') {
      const prev = new Date();
      prev.setDate(today.getDate() - 7);
      setStartDate(formatYMD(prev));
      setEndDate(formatYMD(today));
    } else if (preset === '30days') {
      const prev = new Date();
      prev.setDate(today.getDate() - 30);
      setStartDate(formatYMD(prev));
      setEndDate(formatYMD(today));
    } else {
      setStartDate('');
      setEndDate('');
    }
    setCurrentPage(1);
  };

  const totalLogs = logs.length;
  const totalPages = Math.ceil(totalLogs / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedLogs = logs.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('LOCK') || act.includes('SUSPEND') || act.includes('INACTIVATE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('RESET') || act.includes('CHANGE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('CREATE') || act.includes('REGISTER') || act.includes('APPROVE') || act.includes('ACTIVATE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Audit Trail & Security Logs</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              {totalLogs} Events Found
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system audit logs tracking user operations, account security, and tenant lifecycle events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            title="Reload audit records"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm shadow-slate-200/50 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>Audit Log Filters</span>
            {hasActiveFilters && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All Filters
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Keyword Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor, action, details..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. User / Actor Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              User / Actor
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedUser}
                onChange={e => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs capitalize"
              >
                <option value="">All Users & System</option>
                {availableActors.map(actor => (
                  <option key={actor.id} value={actor.name || actor.id}>
                    {actor.name} {actor.role ? `(${actor.role.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Action Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Action / Event Type
            </label>
            <div className="relative">
              <Activity className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedAction}
                onChange={e => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
              >
                <option value="">All Action Types</option>
                {availableActions.map(act => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Date Range Filters */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Date Range (Start - End)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                title="End Date"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets Row */}
        <div className="flex items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-slate-400 font-medium">Quick Date:</span>
          <button
            type="button"
            onClick={() => handleQuickDatePreset('today')}
            className={`px-2.5 py-1 rounded-lg border font-semibold transition-all ${
              startDate && startDate === endDate && startDate === new Date().toISOString().split('T')[0]
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleQuickDatePreset('7days')}
            className="px-2.5 py-1 rounded-lg border bg-white hover:bg-slate-50 text-slate-600 border-slate-200 font-semibold transition-all"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => handleQuickDatePreset('30days')}
            className="px-2.5 py-1 rounded-lg border bg-white hover:bg-slate-50 text-slate-600 border-slate-200 font-semibold transition-all"
          >
            Last 30 Days
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => handleQuickDatePreset('all')}
              className="px-2 py-1 text-slate-400 hover:text-slate-600 text-[10px] underline ml-1"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Error Loading Audit Logs</p>
              <p className="mt-0.5 text-rose-600">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden flex flex-col">
        {/* Scrollable Viewport with Fixed Sticky Header */}
        <div
          ref={tableContainerRef}
          tabIndex={0}
          aria-label="System audit trail table scroll area"
          className="overflow-x-auto overflow-y-auto max-h-[580px] relative divide-y divide-slate-100 focus:outline-none scroll-smooth"
        >
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-2xs">
              <tr>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                  Timestamp
                </th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                  Actor (User)
                </th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                  Action / Event
                </th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                  Entity
                </th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                  Payload / Details
                </th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span className="text-xs">Fetching audit log trail...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2.5 max-w-sm mx-auto">
                      <ShieldAlert className="h-8 w-8 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">No Audit Logs Found</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {hasActiveFilters
                          ? 'No audit log entries match the selected user, action, or date range filters.'
                          : 'There are no audit events recorded in the system yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setInspectLog(log)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {log.actorName || 'System Automated'}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize font-medium">
                        {log.actorRole ? log.actorRole.replace('_', ' ') : 'System'}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`font-mono font-semibold px-2.5 py-1 rounded-md border text-[11px] shadow-2xs ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-700 capitalize bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        {log.entity || 'system'}
                      </span>
                      {log.entityId && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {log.entityId}</p>
                      )}
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-slate-500 text-[11px] font-mono">
                      {JSON.stringify(log.after || log.before || {})}
                    </td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setInspectLog(log)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View Full Audit Payload"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <TablePagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalLogs}
          pageSize={pageSize}
          pageSizeOptions={[15, 30, 50, 100]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          itemName="audit records"
        />
      </div>

      {/* AUDIT LOG DETAILS MODAL */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileJson className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Audit Log Event Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {inspectLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Timestamp</p>
                <p className="font-semibold text-slate-900 mt-0.5">{formatDate(inspectLog.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Actor</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {inspectLog.actorName || 'System'} ({inspectLog.actorRole || 'system'})
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Action</p>
                <p className="font-mono font-bold text-indigo-700 mt-0.5">{inspectLog.action}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Entity & Target ID</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {inspectLog.entity} {inspectLog.entityId ? `(${inspectLog.entityId})` : ''}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {inspectLog.before && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-1.5">Previous State (Before)</p>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(inspectLog.before, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-700 mb-1.5">
                  {inspectLog.before ? 'New State / Changes (After)' : 'Event Payload & Changes'}
                </p>
                <pre className="p-3 bg-slate-900 text-indigo-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-800">
                  {JSON.stringify(inspectLog.after || inspectLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
