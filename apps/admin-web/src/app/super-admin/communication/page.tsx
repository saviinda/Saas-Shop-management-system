'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { SupportTicket } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { Send, Clock } from 'lucide-react';

export default function CommunicationPage() {
  const { showSuccess, showError } = useModal();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<SupportTicket[]>('/communication');
      setTickets(res.data);
      if (res.data.length > 0 && !selectedTicket) {
        setSelectedTicket(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      const res = await api.post<SupportTicket>(`/communication/${selectedTicket.id}/reply`, {
        message: replyText,
      });
      setSelectedTicket(res.data);
      setReplyText('');
      fetchTickets();
    } catch (err: any) {
      showError('Reply Failed', err.message || 'Failed to send reply.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Support & Communication</h1>
        <p className="text-xs text-slate-500 mt-1">Direct communication channel with Shop Owners (Requirement Section 26)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 min-h-[580px] overflow-hidden">
        {/* Ticket List */}
        <div className="border-r border-slate-200/80 p-4 space-y-2.5 overflow-y-auto bg-slate-50/40">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">Support Tickets</p>
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-3.5 cursor-pointer rounded-xl border transition-all duration-200 ${
                selectedTicket?.id === t.id
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-sm shadow-indigo-100/50 ring-1 ring-indigo-500/20'
                  : 'border-slate-200/70 bg-white hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-900">{t.shopName}</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                  t.status === 'open' ? 'bg-amber-50 text-amber-700 border border-amber-200/70' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                }`}>
                  {t.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">{t.subject}</p>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
                <Clock className="h-3 w-3" /> {formatDate(t.updatedAt)}
              </p>
            </div>
          ))}
        </div>

        {/* Conversation Thread */}
        <div className="md:col-span-2 flex flex-col justify-between p-6">
          {selectedTicket ? (
            <>
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base tracking-tight">{selectedTicket.subject}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      From: <span className="font-semibold text-slate-700">{selectedTicket.shopName}</span> • <span className="font-mono text-slate-400">#{selectedTicket.ticketNumber}</span>
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 bg-slate-100/80 rounded-full text-slate-700 font-semibold uppercase border border-slate-200/60">
                    {selectedTicket.category}
                  </span>
                </div>

                <div className="py-4 space-y-4 max-h-[380px] overflow-y-auto pr-2">
                  {selectedTicket.messages.map((m, idx) => {
                    const isAdmin = m.senderRole === 'super_admin';
                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-4 text-xs space-y-1 rounded-2xl ${
                            isAdmin
                              ? 'bg-indigo-600 text-white rounded-br-xs shadow-sm shadow-indigo-200'
                              : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                          }`}
                        >
                          <p className={`font-semibold text-[11px] ${isAdmin ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {m.senderName} ({m.senderRole.replace('_', ' ')})
                          </p>
                          <p className="leading-relaxed font-medium">{m.message}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 font-medium">{formatDate(m.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your response to shop owner..."
                  className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200"
                >
                  <Send className="h-3.5 w-3.5" /> Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400 font-medium">
              Select a conversation to reply
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
