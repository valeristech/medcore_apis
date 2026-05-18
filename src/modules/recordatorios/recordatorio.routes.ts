import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import { requireCronSecret } from '../../core/auth/requireCronSecret.js';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { plantillaRecordatorioController } from './plantilla-recordatorio.controller.js';
import {
  createPlantillaRecordatorioSchema,
  deletePlantillaRecordatorioSchema,
  ejecutarRecordatoriosSchema,
  getPlantillaRecordatorioSchema,
  listPlantillasRecordatorioSchema,
  updatePlantillaRecordatorioSchema,
} from './plantilla-recordatorio.schemas.js';
import { createRecordatorioController } from './recordatorio.controller.js';

const pLeer = requirePermission('agenda', 'leer');
const pEditar = requirePermission('agenda', 'editar');

export const recordatorioRoutes = (env: AppEnv): FastifyPluginAsync => {
  const recordatorioController = createRecordatorioController(env);
  const cronAuth = requireCronSecret(env);

  return async (app) => {
    app.get(
      '/plantillas',
      { ...listPlantillasRecordatorioSchema, preHandler: [requireAuth, pLeer] },
      plantillaRecordatorioController.list,
    );

    app.post(
      '/plantillas',
      { ...createPlantillaRecordatorioSchema, preHandler: [requireAuth, pEditar] },
      plantillaRecordatorioController.create,
    );

    app.get(
      '/plantillas/:id',
      { ...getPlantillaRecordatorioSchema, preHandler: [requireAuth, pLeer] },
      plantillaRecordatorioController.getById,
    );

    app.patch(
      '/plantillas/:id',
      { ...updatePlantillaRecordatorioSchema, preHandler: [requireAuth, pEditar] },
      plantillaRecordatorioController.update,
    );

    app.delete(
      '/plantillas/:id',
      { ...deletePlantillaRecordatorioSchema, preHandler: [requireAuth, pEditar] },
      plantillaRecordatorioController.remove,
    );

    app.post(
      '/ejecutar',
      { ...ejecutarRecordatoriosSchema, preHandler: [cronAuth] },
      recordatorioController.ejecutar,
    );
  };
};
