'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { SupportTicket } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import { Send, Plus, Clock } from 'lucide-react';

export default function ShopCommunicationPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useModal();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'general' as any,
    priority: 'medium' as any,
    message: '',
  });

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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/communication', newTicket);
      setShowModal(false);
      setNewTicket({ subject: '', category: 'general', priority: 'medium', message: '' });
      fetchTickets();
      showSuccess('Ticket Submitted', 'Your inquiry has been sent to Super Admin.');
    } catch (err: any) {
      showError('Ticket Failed', err.message || 'Failed to create ticket.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communication & Support with Super Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Direct support channel, billing assistance, and account questions (Section 26)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200"
        >
          <Plus className="h-4 w-4" /> New Support Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 min-h-[550px] overflow-hidden">
        {/* Ticket list */}
        <div className="border-r border-slate-100 p-4 space-y-2.5 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">My Inquiries</p>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 text-center">No active tickets</p>
          ) : (
            tickets.map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${
                  selectedTicket?.id === t.id
                    ? 'border-indigo-500 bg-indigo-50/60 shadow-sm shadow-indigo-100/50'
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                    {t.category}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    {t.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 mt-2.5 line-clamp-1">{t.subject}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Clock className="h-3 w-3" /> {formatDate(t.updatedAt)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Conversation Thread */}
        <div className="md:col-span-2 flex flex-col justify-between p-6">
          {selectedTicket ? (
            <>
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base tracking-tight">{selectedTicket.subject}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Ticket #{selectedTicket.ticketNumber}</p>
                  </div>
                  <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold capitalize rounded-full border border-indigo-100/80">
                    {selectedTicket.priority} Priority
                  </span>
                </div>

                <div className="py-4 space-y-4 max-h-[360px] overflow-y-auto pr-2">
                  {selectedTicket.messages.map((m, idx) => {
                    const isMe = m.senderId === user?.id;
                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-4 text-xs space-y-1 rounded-2xl ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-xs shadow-sm shadow-indigo-200'
                              : 'bg-slate-100/90 text-slate-800 rounded-bl-xs border border-slate-200/60'
                          }`}
                        >
                          <p className={`font-semibold text-[11px] ${isMe ? 'text-indigo-200' : 'text-slate-500'}`}>
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
                  placeholder="Type message to Super Admin..."
                  className="flex-1 text-xs px-4 py-2.5 border border-slate-200/90 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
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
              Select or create a conversation
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create Support / Inquiries Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inquiring about plan limits and adding extra branches"
                  value={newTicket.subject}
                  onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={e => setNewTicket({ ...newTicket, category: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  >
                    <option value="general">General Support</option>
                    <option value="billing">Billing & Subscriptions</option>
                    <option value="account">Account & Compliance</option>
                    <option value="technical">Technical Assistance</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={e => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Detailed Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain your inquiry in detail..."
                  value={newTicket.message}
                  onChange={e => setNewTicket({ ...newTicket, message: e.target.value })}
                  className="w-full p-2.5 border border-slate-200/90 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm shadow-slate-100 transition-all duration-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold active:scale-[0.98] transition-all duration-200">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200">
                  Submit Support Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
