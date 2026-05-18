import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { citaController } from './cita.controller.js';
import { crearCitaSchema } from './cita.schemas.js';

const pAgendaCrear = requirePermission('agenda', 'crear');

export const citaRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/',
    { ...crearCitaSchema, preHandler: [requireAuth, pAgendaCrear] },
    citaController.create,
  );
};
