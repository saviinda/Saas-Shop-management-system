'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Building2,
  ArrowRight,
} from 'lucide-react';

export default function TasksPage() {
  const { showSuccess, showError, showConfirm } = useModal();
  const { activeBranch, branches } = useBranch();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
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
    branchId: '',
    title: '',
    description: '',
    assigneeId: '',
    priority: 'medium' as TaskPriority,
    dueDate: '',
  });

  const isOwnerOrManager =
    user?.role === 'shop_owner' ||
    user?.role === 'manager' ||
    user?.role === 'super_admin' ||
    Boolean((user as any)?.roles?.includes('shop_owner') || (user as any)?.roles?.includes('manager'));

  const loadData = async (branchFilter = selectedBranchFilter) => {
    try {
      setIsLoading(true);
      const queryParams: Record<string, string | undefined> = {};
      if (branchFilter && branchFilter !== 'all') {
        queryParams.branchId = branchFilter;
      }

      const [tskRes, stfRes] = await Promise.all([
        api.get<EmployeeTask[]>('/tasks', queryParams),
        api.get<User[]>('/users'),
      ]);

      setTasks(tskRes.data || []);
      const activeStaff = (stfRes.data || []).filter(u => u.status === 'active' && u.role !== 'super_admin');
      setStaff(activeStaff);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedBranchFilter);
  }, [selectedBranchFilter]);

  // Listen to soft branch switch events across components
  useEffect(() => {
    const handleBranchChange = () => {
      loadData(selectedBranchFilter);
    };
    window.addEventListener('branch_changed', handleBranchChange);
    return () => window.removeEventListener('branch_changed', handleBranchChange);
  }, [selectedBranchFilter]);

  const openCreateModal = () => {
    const initialBranchId =
      (selectedBranchFilter !== 'all' ? selectedBranchFilter : null) ||
      activeBranch?.id ||
      branches[0]?.id ||
      '';

    const initialAssigneeId = staff[0]?.id || '';

    setFormData({
      branchId: initialBranchId,
      title: '',
      description: '',
      assigneeId: initialAssigneeId,
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setShowCreateModal(true);
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const targetUser = staff.find(u => u.id === assigneeId);
    let targetBranchId = formData.branchId;

    // If assigned user has explicit branch assignments, auto-select their branch if needed
    if (targetUser?.branchIds && targetUser.branchIds.length > 0) {
      if (!targetBranchId || !targetUser.branchIds.includes(targetBranchId)) {
        targetBranchId = targetUser.branchIds[0];
      }
    }

    setFormData(prev => ({
      ...prev,
      assigneeId,
      branchId: targetBranchId || prev.branchId,
    }));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showError('Title Required', 'Please enter a task title.');
      return;
    }
    if (!formData.assigneeId) {
      showError('Assignee Required', 'Please select an employee to assign this task.');
      return;
    }

    const branchToUse = formData.branchId || activeBranch?.id || branches[0]?.id;
    if (!branchToUse) {
      showError('Branch Required', 'Please select a branch for this task.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<EmployeeTask>('/tasks', {
        branchId: branchToUse,
        title: formData.title.trim(),
        description: formData.description.trim(),
        assigneeId: formData.assigneeId,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
      });

      setShowCreateModal(false);
      showSuccess('Task Assigned', `Task "${formData.title}" assigned successfully.`);

      // Ensure newly created task is visible:
      // If currently filtered by a different branch, switch to 'all' so it is visible
      if (selectedBranchFilter !== 'all' && selectedBranchFilter !== branchToUse) {
        setSelectedBranchFilter('all');
        await loadData('all');
      } else {
        await loadData(selectedBranchFilter);
      }

      // Reset any active filters that would hide the newly created task
      if (statusFilter !== 'all' && statusFilter !== 'todo') {
        setStatusFilter('all');
      }
      if (priorityFilter !== 'all' && priorityFilter !== formData.priority) {
        setPriorityFilter('all');
      }
      if (assigneeFilter !== 'all' && assigneeFilter !== formData.assigneeId) {
        setAssigneeFilter('all');
      }
      setSearch('');
    } catch (err: any) {
      const detailMsg = Array.isArray(err.details)
        ? err.details.map((d: any) => `${d.field ? d.field + ': ' : ''}${d.message}`).join(', ')
        : err.message || 'Failed to assign task.';
      showError('Task Creation Failed', detailMsg);
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
      (t.assigneeName && t.assigneeName.toLowerCase().includes(q)) ||
      (t.branchName && t.branchName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Management & Staff Assignments</h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign shop duties across branches, track priority workflows, log activity comments, and review task completion
          </p>
        </div>

        {isOwnerOrManager && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Create New Task
          </button>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Tasks</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{tasks.length}</p>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">To Do</span>
          <p className="text-xl font-extrabold text-indigo-600 mt-0.5">
            {tasks.filter(t => t.status === 'todo').length}
          </p>
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
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">Completed</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
            {tasks.filter(t => t.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, worker, branch..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedBranchFilter}
              onChange={e => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1"
            >
              <option value="all">All Branches ({branches.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isDefault ? '(Main)' : ''}
                </option>
              ))}
            </select>
          </div>

          {user && (
            <button
              onClick={() => setAssigneeFilter(assigneeFilter === user.id ? 'all' : user.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                assigneeFilter === user.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {assigneeFilter === user.id ? '✓ Showing My Tasks' : 'Assigned To Me'}
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
            <option value="all">All Staff ({staff.length})</option>
            {staff.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} {u.id === user?.id ? '(Me)' : ''}
              </option>
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
                <th className="py-3.5 px-6">Branch</th>
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
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                    <p>Loading assigned tasks...</p>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No tasks found matching criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isOwnerOrManager
                        ? 'Click "Create New Task" above to assign duties to your team.'
                        : 'No tasks currently assigned to you.'}
                    </p>
                  </td>
                </tr>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {t.branchName || branches.find(b => b.id === t.branchId)?.name || 'Main Branch'}
                      </span>
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
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {t.status === 'todo' ? 'To Do' : (t.status || 'todo').replace('_', ' ')}
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
                          title="View task details"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {isOwnerOrManager && (
                          <button
                            onClick={() => handleDeleteTask(t)}
                            title="Delete task"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
                        : selectedTaskDetails.priority === 'high'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {selectedTaskDetails.priority}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mt-1">
                  <span>
                    Assigned to <b className="text-slate-800">{selectedTaskDetails.assigneeName}</b>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Branch: <b className="text-slate-800">{selectedTaskDetails.branchName || branches.find(b => b.id === selectedTaskDetails.branchId)?.name || 'Main Branch'}</b>
                  </span>
                  <span>&bull;</span>
                  <span>Created by {selectedTaskDetails.createdByName || 'Owner'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTaskDetails(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Description */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Task Instructions</span>
              <p className="text-slate-800 whitespace-pre-wrap">{selectedTaskDetails.description || 'No detailed instructions provided.'}</p>
              {selectedTaskDetails.dueDate && (
                <p className="text-[11px] text-indigo-600 font-semibold mt-2.5 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Due Date: {formatDate(selectedTaskDetails.dueDate)}
                </p>
              )}
            </div>

            {/* Status Workflow Action Bar */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-2 text-xs">
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
                    {st === 'todo' ? 'To Do' : st.replace('_', ' ')}
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
                {!selectedTaskDetails.comments || selectedTaskDetails.comments.length === 0 ? (
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Assign New Employee Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Target Branch *</label>
                  <select
                    value={formData.branchId}
                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {branches.length === 0 ? (
                      <option value="">No branches configured</option>
                    ) : (
                      branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isDefault ? '(Main)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Assign Staff Member *</label>
                  <select
                    value={formData.assigneeId}
                    onChange={e => handleAssigneeChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {staff.length === 0 ? (
                      <option value="">No active staff found</option>
                    ) : (
                      staff.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role.replace('_', ' ')})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {staff.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No Staff Members Registered</p>
                    <p className="mt-0.5 text-slate-600">
                      You must add employee profiles in the system before tasks can be assigned.
                    </p>
                    <Link
                      href="/shop-owner/staff"
                      onClick={() => setShowCreateModal(false)}
                      className="inline-flex items-center gap-1 mt-1.5 font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Go to Employees & Staff <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
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
                  placeholder="Provide clear task instructions, checklists, standard operating procedures..."
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
                  disabled={isSubmitting || staff.length === 0}
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
