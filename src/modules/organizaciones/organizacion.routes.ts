import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { organizacionController } from './organizacion.controller.js';
import {
  createOrganizacionSchema,
  deleteOrganizacionSchema,
  getOrganizacionSchema,
  listOrganizacionesSchema,
  searchOrganizacionesSchema,
  updateOrganizacionSchema,
} from './organizacion.schemas.js';

const corePermission = requirePermission('core', 'organizaciones');

export const organizacionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      ...listOrganizacionesSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.list,
  );

  app.get(
    '/search',
    {
      ...searchOrganizacionesSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.searchForTenant,
  );

  app.get(
    '/:id',
    {
      ...getOrganizacionSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.getById,
  );

  app.post(
    '/',
    {
      ...createOrganizacionSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.create,
  );

  app.patch(
    '/:id',
    {
      ...updateOrganizacionSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.update,
  );

  app.delete(
    '/:id',
    {
      ...deleteOrganizacionSchema,
      preHandler: [requireAuth, corePermission],
    },
    organizacionController.softDelete,
  );
};
