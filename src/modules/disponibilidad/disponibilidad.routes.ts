import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { disponibilidadController } from './disponibilidad.controller.js';
import {
  createReglaSchema,
  deleteReglaSchema,
  getReglaSchema,
  listReglasByUsuarioSchema,
  searchReglasSchema,
  updateReglaSchema,
} from './disponibilidad.schemas.js';

const pAgendaLeer = requirePermission('agenda', 'leer');
const pAgendaCrear = requirePermission('agenda', 'crear');
const pAgendaEditar = requirePermission('agenda', 'editar');

export const disponibilidadRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/reglas/search',
    {
      ...searchReglasSchema,
      preHandler: [requireAuth, pAgendaLeer],
    },
    disponibilidadController.search,
  );

  app.get(
    '/usuarios/:usuarioId/reglas',
    {
      ...listReglasByUsuarioSchema,
      preHandler: [requireAuth, pAgendaLeer],
    },
    disponibilidadController.listByUsuario,
  );

  app.post(
    '/reglas',
    {
      ...createReglaSchema,
      preHandler: [requireAuth, pAgendaCrear],
    },
    disponibilidadController.create,
  );

  app.get(
    '/reglas/:id',
    {
      ...getReglaSchema,
      preHandler: [requireAuth, pAgendaLeer],
    },
    disponibilidadController.getById,
  );

  app.patch(
    '/reglas/:id',
    {
      ...updateReglaSchema,
      preHandler: [requireAuth, pAgendaEditar],
    },
    disponibilidadController.update,
  );

  app.delete(
    '/reglas/:id',
    {
      ...deleteReglaSchema,
      preHandler: [requireAuth, pAgendaEditar],
    },
    disponibilidadController.remove,
  );
};
