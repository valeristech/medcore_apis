import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { hasPermission } from '../../core/auth/permissions.js';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { sendFail } from '../../core/http/response.js';
import { citaController } from './cita.controller.js';
import {
  cancelarCitaSchema,
  crearCitaSchema,
  marcarNoShowCitaSchema,
  reagendarCitaSchema,
} from './cita.schemas.js';

const pAgendaCrear = requirePermission('agenda', 'crear');
const pAgendaEditar = requirePermission('agenda', 'editar');

/** `agenda.cancelar` o `agenda.editar` (médico/secretaria según UC-AGE-004). */
function requireAgendaCancelar() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const permisos = request.user?.permisos;
    if (
      !permisos ||
      (!hasPermission(permisos, 'agenda', 'cancelar') && !hasPermission(permisos, 'agenda', 'editar'))
    ) {
      return sendFail(
        reply,
        request.requestId,
        403,
        'FORBIDDEN',
        'No tienes permiso para cancelar citas.',
      );
    }
  };
}

const pAgendaCancelar = requireAgendaCancelar();

export const citaRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/',
    { ...crearCitaSchema, preHandler: [requireAuth, pAgendaCrear] },
    citaController.create,
  );

  app.put(
    '/:id',
    { ...reagendarCitaSchema, preHandler: [requireAuth, pAgendaEditar] },
    citaController.reschedule,
  );

  app.post(
    '/:id/cancelar',
    { ...cancelarCitaSchema, preHandler: [requireAuth, pAgendaCancelar] },
    citaController.cancel,
  );

  app.put(
    '/:id/no-show',
    { ...marcarNoShowCitaSchema, preHandler: [requireAuth, pAgendaEditar] },
    citaController.markNoShow,
  );
};
