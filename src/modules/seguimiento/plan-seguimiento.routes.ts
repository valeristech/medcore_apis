import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { requireCronSecret } from '../../core/auth/requireCronSecret.js';
import { planSeguimientoController } from './plan-seguimiento.controller.js';
import { planSeguimientoJobController } from './plan-seguimiento.job.controller.js';
import {
  actualizarActividadSchema,
  cambiarEstadoPlanSchema,
  crearActividadSchema,
  crearPlanSeguimientoSchema,
  ejecutarPlanSeguimientoJobSchema,
  eliminarActividadSchema,
  getPlanSeguimientoSchema,
  listActividadesSchema,
  listPlanesSeguimientoSchema,
} from './plan-seguimiento.schemas.js';

const pSeguimientoLeer = requirePermission('seguimiento', 'leer');
const pSeguimientoCrear = requirePermission('seguimiento', 'crear');
const pSeguimientoEditar = requirePermission('seguimiento', 'editar');

export const planSeguimientoRoutes = (env: AppEnv): FastifyPluginAsync => {
  const cronAuth = requireCronSecret(env);

  return async (app) => {
    // UC-SEG-003 — Médico abre el plan
    app.post(
      '/planes-seguimiento',
      { ...crearPlanSeguimientoSchema, preHandler: [requireAuth, pSeguimientoCrear] },
      planSeguimientoController.crearPlan,
    );

    app.get(
      '/planes-seguimiento',
      { ...listPlanesSeguimientoSchema, preHandler: [requireAuth, pSeguimientoLeer] },
      planSeguimientoController.listarPlanes,
    );

    app.get(
      '/planes-seguimiento/:id',
      { ...getPlanSeguimientoSchema, preHandler: [requireAuth, pSeguimientoLeer] },
      planSeguimientoController.obtenerPlan,
    );

    // UC-SEG-003 — Cambio de estado (activar / completar / cancelar)
    app.put(
      '/planes-seguimiento/:id/estado',
      { ...cambiarEstadoPlanSchema, preHandler: [requireAuth, pSeguimientoEditar] },
      planSeguimientoController.cambiarEstadoPlan,
    );

    // UC-SEG-003 — CRUD de actividades (secretaría completa el plan)
    app.post(
      '/planes-seguimiento/:id/actividades',
      { ...crearActividadSchema, preHandler: [requireAuth, pSeguimientoEditar] },
      planSeguimientoController.crearActividad,
    );

    app.get(
      '/planes-seguimiento/:id/actividades',
      { ...listActividadesSchema, preHandler: [requireAuth, pSeguimientoLeer] },
      planSeguimientoController.listarActividades,
    );

    app.patch(
      '/planes-seguimiento/actividades/:id',
      { ...actualizarActividadSchema, preHandler: [requireAuth, pSeguimientoEditar] },
      planSeguimientoController.actualizarActividad,
    );

    app.delete(
      '/planes-seguimiento/actividades/:id',
      { ...eliminarActividadSchema, preHandler: [requireAuth, pSeguimientoEditar] },
      planSeguimientoController.eliminarActividad,
    );

    // UC-SEG-003 — Job diario (cron externo, sin JWT)
    app.post(
      '/planes-seguimiento/cron/ejecutar',
      { ...ejecutarPlanSeguimientoJobSchema, preHandler: [cronAuth] },
      planSeguimientoJobController.ejecutar,
    );
  };
};
