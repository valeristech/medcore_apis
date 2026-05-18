import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { tipoCitaController } from './tipo-cita.controller.js';
import {
  createTipoCitaSchema,
  deleteTipoCitaSchema,
  getTipoCitaSchema,
  listTiposCitaSchema,
  updateTipoCitaSchema,
} from './tipo-cita.schemas.js';

const pLeer = requirePermission('agenda', 'leer');
const pCrear = requirePermission('agenda', 'crear');
const pEditar = requirePermission('agenda', 'editar');

export const tipoCitaRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    { ...listTiposCitaSchema, preHandler: [requireAuth, pLeer] },
    tipoCitaController.list,
  );

  app.post(
    '/',
    { ...createTipoCitaSchema, preHandler: [requireAuth, pCrear] },
    tipoCitaController.create,
  );

  app.get(
    '/:id',
    { ...getTipoCitaSchema, preHandler: [requireAuth, pLeer] },
    tipoCitaController.getById,
  );

  app.patch(
    '/:id',
    { ...updateTipoCitaSchema, preHandler: [requireAuth, pEditar] },
    tipoCitaController.update,
  );

  app.delete(
    '/:id',
    { ...deleteTipoCitaSchema, preHandler: [requireAuth, pEditar] },
    tipoCitaController.remove,
  );
};
