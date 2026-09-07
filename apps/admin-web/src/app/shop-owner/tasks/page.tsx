'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';
import { EmployeeTask, User, TaskPriority, TaskStatus } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { useModal } from '@/lib/modal-context';
import {
  CheckSquare,
  Plus,
  Clock,
  UserCheck,
  Search,
  Filter,
  AlertCircle,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  XCircle,
  Trash2,
  Calendar,
  Send,
  X,
  Eye,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react';

export default function TasksPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch } = useBranch();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<EmployeeTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Comment Input
  const [newCommentText, setNewCommentText] = useState('');

  // Create Task Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'medium' as TaskPriority,
    dueDate: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tskRes, stfRes] = await Promise.all([
        api.get<EmployeeTask[]>('/tasks', { branchId: activeBranch?.id }),
        api.get<User[]>('/users'),
      ]);
      setTasks(tskRes.data || []);
      setStaff(stfRes.data || []);
      if (stfRes.data?.length > 0 && !formData.assigneeId) {
        setFormData(prev => ({ ...prev, assigneeId: stfRes.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      assigneeId: staff[0]?.id || '',
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setShowCreateModal(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranch?.id) {
      showError('Branch Required', 'Please select an active branch.');
      return;
    }
    if (!formData.assigneeId) {
      showError('Assignee Required', 'Please select an employee to assign this task.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/tasks', {
        branchId: activeBranch.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        assigneeId: formData.assigneeId,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
      });

      setShowCreateModal(false);
      showSuccess('Task Assigned', `Task "${formData.title}" assigned successfully.`);
      await loadData();
    } catch (err: any) {
      showError('Task Creation Failed', err.message || 'Failed to assign task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const res = await api.patch<EmployeeTask>(`/tasks/${taskId}/status`, { status });
      if (selectedTaskDetails && selectedTaskDetails.id === taskId) {
        setSelectedTaskDetails(res.data);
      }
      showSuccess('Status Updated', `Task is now marked as ${status.replace('_', ' ')}.`);
      await loadData();
    } catch (err: any) {
      showError('Update Failed', err.message || 'Failed to update task status.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskDetails || !newCommentText.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/tasks/${selectedTaskDetails.id}/comments`, {
        comment: newCommentText.trim(),
      });
      setSelectedTaskDetails(res.data.task);
      setNewCommentText('');
      await loadData();
    } catch (err: any) {
      showError('Comment Failed', err.message || 'Could not post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = (task: EmployeeTask) => {
    showConfirm(
      'Delete Task',
      `Are you sure you want to delete task "${task.title}"?`,
      async () => {
        try {
          await api.delete(`/tasks/${task.id}`);
          if (selectedTaskDetails?.id === task.id) {
            setSelectedTaskDetails(null);
          }
          await loadData();
          showSuccess('Task Deleted', 'Task removed successfully.');
        } catch (err: any) {
          showError('Delete Failed', err.message || 'Could not delete task.');
        }
      },
      'Delete Task',
      true
    );
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.assigneeName && t.assigneeName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Management & Staff Assignments</h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign shop duties, track priority workflows, log activity comments, and review task completion (BR-15)
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create New Task
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Tasks</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{tasks.length}</p>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">In Progress</span>
          <p className="text-xl font-extrabold text-blue-600 mt-0.5">
            {tasks.filter(t => t.status === 'in_progress').length}
          </p>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Pending Review</span>
          <p className="text-xl font-extrabold text-amber-600 mt-0.5">
            {tasks.filter(t => t.status === 'pending_review').length}
          </p>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Completed</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
            {tasks.filter(t => t.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, worker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {user && (
            <button
              onClick={() => setAssigneeFilter(assigneeFilter === user.id ? 'all' : user.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                assigneeFilter === user.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {assigneeFilter === user.id ? '✓ Showing My Tasks' : 'Filter: Assigned To Me'}
            </button>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_review">Pending Review</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Workers ({staff.length})</option>
            {staff.map(u => (
              <option key={u.id} value={u.id}>{u.name} {u.id === user?.id ? '(Me)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6">Task Details</th>
                <th className="py-3.5 px-6">Assigned Worker</th>
                <th className="py-3.5 px-6">Priority</th>
                <th className="py-3.5 px-6">Due Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Discussion</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading assigned tasks...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No tasks found matching criteria.</td></tr>
              ) : (
                filteredTasks.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTaskDetails(t)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 text-sm">{t.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[240px]">{t.description}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[11px]">
                          {(t.assigneeName || 'W').charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-800">{t.assigneeName || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          t.priority === 'urgent'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : t.priority === 'high'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : t.priority === 'medium'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {t.dueDate ? formatDate(t.dueDate) : 'No due date'}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                          t.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : t.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : t.status === 'pending_review'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : t.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-500 text-[11px] flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-slate-400" />
                        {t.comments?.length || 0} comments
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTaskDetails(t)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* ===================== TASK DETAILS & DISCUSSION MODAL ===================== */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{selectedTaskDetails.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      selectedTaskDetails.priority === 'urgent'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {selectedTaskDetails.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assigned to <b className="text-slate-800">{selectedTaskDetails.assigneeName}</b> &bull; Created by {selectedTaskDetails.createdByName || 'Owner'}
                </p>
              </div>
              <button onClick={() => setSelectedTaskDetails(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Description */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Task Instructions</span>
              <p className="text-slate-800 whitespace-pre-wrap">{selectedTaskDetails.description}</p>
              {selectedTaskDetails.dueDate && (
                <p className="text-[11px] text-indigo-600 font-semibold mt-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due Date: {formatDate(selectedTaskDetails.dueDate)}
                </p>
              )}
            </div>

            {/* Status Workflow Action Bar */}
            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-2 text-xs">
              <span className="font-bold text-slate-800">Update Task Progress / Status:</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(['todo', 'in_progress', 'pending_review', 'completed', 'cancelled'] as TaskStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedTaskDetails.id, st)}
                    className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition-all ${
                      selectedTaskDetails.status === st
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Discussion & Activity Thread */}
            <div className="space-y-3">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> Discussion & Updates ({selectedTaskDetails.comments?.length || 0})
              </span>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                {(!selectedTaskDetails.comments || selectedTaskDetails.comments.length === 0) ? (
                  <p className="text-slate-400 text-center py-4">No comments posted yet. Start the conversation below.</p>
                ) : (
                  selectedTaskDetails.comments.map(c => (
                    <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900">{c.userName}</span>
                        <span className="text-slate-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-700">{c.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type an update or comment for this task..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newCommentText.trim()}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shrink-0 flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> Post
                </button>
              </form>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedTaskDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE TASK MODAL ===================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Assign New Employee Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct monthly physical stock count"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Assign Staff Member *</label>
                <select
                  value={formData.assigneeId}
                  onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                >
                  {staff.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Instructions & Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specific details, checklists, standard operating procedures..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
