import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { userController } from './user.controller.js';
import {
  createUsuarioSchema,
  deleteUsuarioSchema,
  desactivarUsuarioSchema,
  getUsuarioSchema,
  listUsuariosSchema,
  searchUsuariosSchema,
  updateUsuarioSchema,
} from './user.schemas.js';

const pUsuarios = requirePermission('usuarios', '*');

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/usuarios',
    {
      ...listUsuariosSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.list,
  );

  app.get(
    '/usuarios/search',
    {
      ...searchUsuariosSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.search,
  );

  app.get(
    '/usuarios/:id',
    {
      ...getUsuarioSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.getById,
  );

  app.post(
    '/usuarios',
    {
      ...createUsuarioSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.create,
  );

  app.patch(
    '/usuarios/:id',
    {
      ...updateUsuarioSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.update,
  );

  app.patch(
    '/usuarios/:id/desactivar',
    {
      ...desactivarUsuarioSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.desactivar,
  );

  app.delete(
    '/usuarios/:id',
    {
      ...deleteUsuarioSchema,
      preHandler: [requireAuth, pUsuarios],
    },
    userController.remove,
  );
};
