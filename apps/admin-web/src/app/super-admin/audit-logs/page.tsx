'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { AuditLog } from '@saas/types';
import { formatDate } from '@/lib/utils';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<AuditLog[]>('/audit-logs')
      .then(res => setLogs(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Audit Trail & Security Logs</h1>
        <p className="text-xs text-slate-500 mt-1">Immutable record of administrative, financial, and operational actions (Section 29)</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-6">Timestamp</th>
              <th className="py-3.5 px-6">Actor</th>
              <th className="py-3.5 px-6">Action / Event</th>
              <th className="py-3.5 px-6">Entity</th>
              <th className="py-3.5 px-6">Details / Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {isLoading ? (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading audit trail...</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">{formatDate(log.createdAt)}</td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">{log.actorName}</p>
                    <p className="text-[10px] text-slate-400 capitalize font-medium">{log.actorRole.replace('_', ' ')}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono text-indigo-700 font-semibold bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-100/80">
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
    </div>
  );
}
