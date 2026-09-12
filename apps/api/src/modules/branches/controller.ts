import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Branch } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { PackageLimitService } from '../../services/packageLimit.service';
import { AuditLogService } from '../../services/auditLog.service';

export class BranchController {
  static async listBranches(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'shopId is required', 400);

    const branches = await dbStore.collection<Branch>('branches').query({
      where: [{ field: 'shopId', op: '==', value: shopId }],
      orderBy: { field: 'createdAt', direction: 'asc' },
    });

    return sendSuccess(res, branches.data);
  }

  static async createBranch(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'shopId is required', 400);

    try {
      // Package limit check (BR-03, BR-14)
      await PackageLimitService.checkBranchLimit(shopId);

      const { name, address, phone, code } = req.body;
      const branch = await dbStore.collection<Branch>('branches').create({
        shopId,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        code: code ? code.trim() : `BR-${Date.now().toString().slice(-4)}`,
        isDefault: false,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await AuditLogService.log({
        actor: req.user!,
        action: 'CREATE_BRANCH',
        entity: 'branches',
        entityId: branch.id,
        shopId,
        after: branch,
      });

      return sendSuccess(res, branch, undefined, 201);
    } catch (err: any) {
      if (err.code === 'PACKAGE_LIMIT_EXCEEDED' || err.statusCode === 403) {
        return sendError(
          res,
          'PACKAGE_LIMIT_EXCEEDED',
          err.message || 'Branch limit reached. You cannot create a new branch under your current plan.',
          403
        );
      }
      return sendError(res, err.code || 'BAD_REQUEST', err.message || 'Failed to create branch', err.statusCode || 400);
    }
  }

  static async updateBranch(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const branch = await dbStore.collection<Branch>('branches').get(id);
    if (!branch || (req.user?.role !== 'super_admin' && branch.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Branch not found', 404);
    }

    const { name, address, phone, status } = req.body;
    const updated = await dbStore.collection<Branch>('branches').update(id, {
      ...(name && { name: name.trim() }),
      ...(address && { address: address.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(status && { status }),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_BRANCH',
      entity: 'branches',
      entityId: id,
      shopId: branch.shopId,
      before: branch,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async updateBranchStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const branch = await dbStore.collection<Branch>('branches').get(id);
    if (!branch || (req.user?.role !== 'super_admin' && branch.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Branch not found', 404);
    }

    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return sendError(res, 'BAD_REQUEST', 'Status must be active or inactive', 400);
    }

    if (branch.isDefault && status === 'inactive') {
      return sendError(res, 'BAD_REQUEST', 'Cannot deactivate the primary default branch', 400);
    }

    const updated = await dbStore.collection<Branch>('branches').update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: `BRANCH_STATUS_${status.toUpperCase()}`,
      entity: 'branches',
      entityId: id,
      shopId: branch.shopId,
      before: { status: branch.status },
      after: { status },
    });

    return sendSuccess(res, updated);
  }

  static async deleteBranch(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const branch = await dbStore.collection<Branch>('branches').get(id);
    if (!branch || (req.user?.role !== 'super_admin' && branch.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Branch not found', 404);
    }

    if (branch.isDefault) {
      return sendError(res, 'BAD_REQUEST', 'Cannot delete the primary default branch', 400);
    }

    await dbStore.collection<Branch>('branches').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_BRANCH',
      entity: 'branches',
      entityId: id,
      shopId: branch.shopId,
      before: branch,
    });

    return sendSuccess(res, { message: 'Branch deleted successfully', id });
  }
}
