import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { requireCronSecret } from '../../core/auth/requireCronSecret.js';
import { alertaController } from './alerta.controller.js';
import { alertaJobController } from './alerta.job.controller.js';
import { ejecutarAlertaJobSchema, gestionarAlertaSchema, listAlertasSchema } from './alerta.schemas.js';

const pSeguimientoLeer = requirePermission('seguimiento', 'leer');
const pSeguimientoEditar = requirePermission('seguimiento', 'editar');

export const alertaRoutes = (env: AppEnv): FastifyPluginAsync => {
  const cronAuth = requireCronSecret(env);

  return async (app) => {
    // UC-SEG-004 — Bandeja de alertas preventivas
    app.get(
      '/alertas',
      { ...listAlertasSchema, preHandler: [requireAuth, pSeguimientoLeer] },
      alertaController.listar,
    );

    // UC-SEG-004 — Gestionar/cerrar una alerta
    app.patch(
      '/alertas/:id',
      { ...gestionarAlertaSchema, preHandler: [requireAuth, pSeguimientoEditar] },
      alertaController.gestionar,
    );

    // UC-SEG-004 — Job diario (cron externo, sin JWT)
    app.post(
      '/alertas/cron/ejecutar',
      { ...ejecutarAlertaJobSchema, preHandler: [cronAuth] },
      alertaJobController.ejecutar,
    );
  };
};
