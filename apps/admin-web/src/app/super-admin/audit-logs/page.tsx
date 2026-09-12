'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api-client';
import { AuditLog } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { TablePagination } from '@/components/TablePagination';
import { Search, ShieldAlert } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination & scrolling
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<AuditLog[]>('/audit-logs')
      .then(res => setLogs(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.actorName?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q) ||
      log.actorRole?.toLowerCase().includes(q)
    );
  });

  const totalLogs = filteredLogs.length;
  const totalPages = Math.ceil(totalLogs / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedLogs = filteredLogs.slice(
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">System Audit Trail & Security Logs</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {totalLogs} Events
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable record of administrative, financial, and operational actions (Section 29)
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by actor, action, entity..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden flex flex-col">
        {/* Scrollable Viewport with Fixed Sticky Header */}
        <div
          ref={tableContainerRef}
          tabIndex={0}
          aria-label="System audit trail table scroll area"
          className="overflow-x-auto overflow-y-auto max-h-[540px] relative divide-y divide-slate-100 focus:outline-none scroll-smooth"
        >
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-2xs">
              <tr>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Actor</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Action / Event</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Entity</th>
                <th className="py-3.5 px-6 bg-slate-50 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Details / Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="h-6 w-6 text-slate-300" />
                      <span>No matching audit records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-slate-500 font-mono text-[11px] whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{log.actorName || 'System'}</p>
                      <p className="text-[10px] text-slate-400 capitalize font-medium">{log.actorRole ? log.actorRole.replace('_', ' ') : 'Admin'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-indigo-700 font-semibold bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-100/80 text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">{log.entity}</td>
                    <td className="py-4 px-6 max-w-xs truncate text-slate-500 text-[11px] font-mono">
                      {JSON.stringify(log.after || log.before || {})}
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
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          itemName="logs"
        />
      </div>
    </div>
  );
}
