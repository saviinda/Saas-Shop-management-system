import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbStore } from '../../db/store';
import { EmployeeTask, User, Branch } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { NotificationService } from '../../services/notification.service';
import { AuditLogService } from '../../services/auditLog.service';

export class TaskController {
  static async listTasks(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, status, assigneeId, priority } = req.query;
    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }
    if (priority && priority !== 'all') {
      where.push({ field: 'priority', op: '==', value: priority });
    }

    const tasks = await dbStore.collection<EmployeeTask>('tasks').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let data = tasks.data;
    if (req.user?.role === 'worker') {
      data = data.filter(t => t.assigneeId === req.user!.id);
    } else if (assigneeId && assigneeId !== 'all') {
      data = data.filter(t => t.assigneeId === assigneeId);
    }

    // Enrich tasks with branchName and assigneeName
    const enrichedTasks = await Promise.all(
      data.map(async task => {
        let assigneeName = task.assigneeName;
        if (!assigneeName && task.assigneeId) {
          const u = await dbStore.collection<User>('users').get(task.assigneeId);
          assigneeName = u?.name || 'Unassigned';
        }
        let branchName = (task as any).branchName;
        if (!branchName && task.branchId) {
          const b = await dbStore.collection<Branch>('branches').get(task.branchId);
          branchName = b?.name || '';
        }
        return {
          ...task,
          assigneeName,
          branchName,
        };
      })
    );

    return sendSuccess(res, enrichedTasks);
  }

  static async getTask(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const task = await dbStore.collection<EmployeeTask>('tasks').get(id);
    if (!task || (req.user?.role !== 'super_admin' && task.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Task not found', 404);
    }

    let branchName = (task as any).branchName;
    if (!branchName && task.branchId) {
      const b = await dbStore.collection<Branch>('branches').get(task.branchId);
      branchName = b?.name || '';
    }

    return sendSuccess(res, { ...task, branchName });
  }

  static async createTask(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const { branchId, title, description, assigneeId, priority = 'medium', dueDate, attachments = [] } = req.body;

    const assignee = await dbStore.collection<User>('users').get(assigneeId);
    if (!assignee) {
      return sendError(res, 'BAD_REQUEST', 'Assignee user not found', 400);
    }
    if (req.user?.role !== 'super_admin' && assignee.shopId && assignee.shopId !== shopId) {
      return sendError(res, 'BAD_REQUEST', 'Invalid assignee worker for this shop', 400);
    }

    // Determine effective branchId
    let effectiveBranchId = branchId;
    if (!effectiveBranchId || effectiveBranchId === 'all') {
      effectiveBranchId = req.branchId || (assignee.branchIds && assignee.branchIds[0]);
    }
    if (!effectiveBranchId || effectiveBranchId === 'all') {
      const branchesRes = await dbStore.collection<Branch>('branches').query({
        where: [{ field: 'shopId', op: '==', value: shopId }],
      });
      const defBranch = branchesRes.data.find(b => b.isDefault) || branchesRes.data[0];
      effectiveBranchId = defBranch?.id || '';
    }

    let branchName = '';
    if (effectiveBranchId) {
      const branch = await dbStore.collection<Branch>('branches').get(effectiveBranchId);
      if (branch) branchName = branch.name;
    }

    const task = await dbStore.collection<EmployeeTask>('tasks').create({
      shopId,
      branchId: effectiveBranchId,
      branchName,
      title: title.trim(),
      description: description ? description.trim() : '',
      assigneeId,
      assigneeName: assignee.name || 'Staff Member',
      createdById: req.user!.id,
      createdByName: req.user!.name,
      priority,
      status: 'todo',
      dueDate: dueDate || undefined,
      attachments,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Notify employee of task assignment
    await NotificationService.create({
      recipientId: assignee.id,
      shopId,
      title: 'New Task Assigned',
      message: `You have been assigned task: "${title}". Due date: ${dueDate || 'N/A'}`,
      type: 'info',
      link: '/shop-owner/tasks',
    }).catch(err => console.warn('Failed to notify assignee:', err));

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_TASK',
      entity: 'tasks',
      entityId: task.id,
      shopId,
      after: task,
    }).catch(err => console.warn('Failed to log audit:', err));

    return sendSuccess(res, task, undefined, 201);
  }

  static async updateTaskStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, comment } = req.body;

    const task = await dbStore.collection<EmployeeTask>('tasks').get(id);
    if (!task || (req.user?.role !== 'super_admin' && task.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Task not found', 404);
    }

    const comments = task.comments || [];
    if (comment) {
      comments.push({
        id: uuidv4(),
        userId: req.user!.id,
        userName: req.user!.name,
        comment,
        createdAt: new Date().toISOString(),
      });
    }

    const updated = await dbStore.collection<EmployeeTask>('tasks').update(id, {
      status,
      comments,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(res, updated);
  }

  static async addComment(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { comment } = req.body;

    const task = await dbStore.collection<EmployeeTask>('tasks').get(id);
    if (!task || (req.user?.role !== 'super_admin' && task.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Task not found', 404);
    }

    const newComment = {
      id: uuidv4(),
      userId: req.user!.id,
      userName: req.user!.name,
      comment,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(task.comments || []), newComment];

    const updated = await dbStore.collection<EmployeeTask>('tasks').update(id, {
      comments: updatedComments,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(res, { task: updated, comment: newComment });
  }

  static async deleteTask(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const task = await dbStore.collection<EmployeeTask>('tasks').get(id);
    if (!task || (req.user?.role !== 'super_admin' && task.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Task not found', 404);
    }

    await dbStore.collection<EmployeeTask>('tasks').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_TASK',
      entity: 'tasks',
      entityId: id,
      shopId: task.shopId,
      before: task,
    });

    return sendSuccess(res, { message: 'Task deleted successfully' });
  }
}
