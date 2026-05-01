import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { roleController } from './role.controller.js';
import {
  createRoleSchema,
  deleteRoleSchema,
  getRoleSchema,
  getRoleTemplateSchema,
  listRolesSchema,
  listRoleTemplatesSchema,
  searchRolesSchema,
  updateRoleSchema,
} from './role.schemas.js';

const pRoles = requirePermission('roles', '*');

export const roleRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/roles',
    {
      ...listRolesSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.list,
  );

  app.get(
    '/roles/search',
    {
      ...searchRolesSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.search,
  );

  app.get(
    '/roles/templates',
    {
      ...listRoleTemplatesSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.listTemplates,
  );

  app.get(
    '/roles/templates/:key',
    {
      ...getRoleTemplateSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.getTemplateByKey,
  );

  app.get(
    '/roles/:id',
    {
      ...getRoleSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.getById,
  );

  app.post(
    '/roles',
    {
      ...createRoleSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.create,
  );

  app.patch(
    '/roles/:id',
    {
      ...updateRoleSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.update,
  );

  app.delete(
    '/roles/:id',
    {
      ...deleteRoleSchema,
      preHandler: [requireAuth, pRoles],
    },
    roleController.remove,
  );
};
