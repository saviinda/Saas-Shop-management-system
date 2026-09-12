import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Role, User } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';

export class RoleController {
  static async listRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        dbStore.collection<Role>('roles').query({
          orderBy: { field: 'createdAt', direction: 'asc' },
        }),
        dbStore.collection<User>('users').query(),
      ]);

      const users = usersRes.data;

      // Count assigned users per role
      const rolesWithCounts = rolesRes.data.map(role => {
        const assignedCount = users.filter(u => {
          if (Array.isArray(u.roles) && (u.roles.includes(role.id) || u.roles.includes(role.slug || '') || u.roles.includes(role.name))) {
            return true;
          }
          return u.role === role.slug || u.role === role.id;
        }).length;

        return {
          ...role,
          userCount: assignedCount,
        };
      });

      return sendSuccess(res, rolesWithCounts);
    } catch (err: any) {
      console.error('Failed to list roles:', err);
      return sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve roles', 500);
    }
  }

  static async getRole(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const role = await dbStore.collection<Role>('roles').get(id);
    if (!role) {
      return sendError(res, 'NOT_FOUND', 'Role not found', 404);
    }
    return sendSuccess(res, role);
  }

  static async createRole(req: AuthenticatedRequest, res: Response) {
    const { name, description, permissions } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return sendError(res, 'BAD_REQUEST', 'Role name is required', 400);
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    // Check if role name or slug already exists
    const existing = await dbStore.collection<Role>('roles').query({
      where: [{ field: 'slug', op: '==', value: slug }],
    });

    if (existing.data.length > 0) {
      return sendError(res, 'CONFLICT', 'A role with this identifier already exists', 409);
    }

    const cleanPermissions = Array.isArray(permissions) ? permissions : [];

    const newRole = await dbStore.collection<Role>('roles').create({
      name: trimmedName,
      slug,
      description: description ? description.trim() : '',
      isSystem: false,
      permissions: cleanPermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await AuditLogService.log({
      actor: req.user!,
      action: 'CREATE_ROLE',
      entity: 'roles',
      entityId: newRole.id,
      after: newRole,
    });

    return sendSuccess(res, newRole, { message: 'Role created successfully' }, 201);
  }

  static async updateRole(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await dbStore.collection<Role>('roles').get(id);
    if (!role) {
      return sendError(res, 'NOT_FOUND', 'Role not found', 404);
    }

    const updates: Partial<Role> = {
      updatedAt: new Date().toISOString(),
    };

    if (name && typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : '';
    }
    if (Array.isArray(permissions)) {
      updates.permissions = permissions;
    }

    const updated = await dbStore.collection<Role>('roles').update(id, updates);

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_ROLE',
      entity: 'roles',
      entityId: id,
      before: role,
      after: updated,
    });

    return sendSuccess(res, updated, { message: 'Role updated successfully' });
  }

  static async deleteRole(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    const role = await dbStore.collection<Role>('roles').get(id);
    if (!role) {
      return sendError(res, 'NOT_FOUND', 'Role not found', 404);
    }

    if (role.isSystem || role.slug === 'super_admin' || role.id === 'role_super_admin') {
      return sendError(res, 'FORBIDDEN', 'Core system default roles cannot be deleted', 403);
    }

    // Check if any users have this role
    const usersRes = await dbStore.collection<User>('users').query();
    const activeUsersWithRole = usersRes.data.filter(u => 
      u.role === role.slug || (Array.isArray(u.roles) && (u.roles.includes(role.id) || u.roles.includes(role.slug || '')))
    );

    if (activeUsersWithRole.length > 0) {
      return sendError(
        res,
        'CONFLICT',
        `Cannot delete role: ${activeUsersWithRole.length} user account(s) currently assigned to this role. Reassign them first.`,
        409
      );
    }

    await dbStore.collection<Role>('roles').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_ROLE',
      entity: 'roles',
      entityId: id,
      before: role,
    });

    return sendSuccess(res, { id }, { message: 'Role deleted successfully' });
  }
}
