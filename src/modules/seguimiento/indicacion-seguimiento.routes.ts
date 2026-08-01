import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { indicacionSeguimientoController } from './indicacion-seguimiento.controller.js';
import {
  actualizarGestionIndicacionSchema,
  agendarCitaIndicacionSchema,
  crearIndicacionSeguimientoSchema,
  listIndicacionesSeguimientoSchema,
} from './indicacion-seguimiento.schemas.js';

const pSeguimientoLeer = requirePermission('seguimiento', 'leer');
const pSeguimientoCrear = requirePermission('seguimiento', 'crear');
const pSeguimientoEditar = requirePermission('seguimiento', 'editar');
const pAgendaCrear = requirePermission('agenda', 'crear');

export const indicacionSeguimientoRoutes: FastifyPluginAsync = async (app) => {
  // UC-SEG-001 — Médico indica seguimiento
  app.post(
    '/indicaciones-seguimiento',
    { ...crearIndicacionSeguimientoSchema, preHandler: [requireAuth, pSeguimientoCrear] },
    indicacionSeguimientoController.crear,
  );

  // UC-SEG-002 — Bandeja de secretaría
  app.get(
    '/indicaciones-seguimiento',
    { ...listIndicacionesSeguimientoSchema, preHandler: [requireAuth, pSeguimientoLeer] },
    indicacionSeguimientoController.listar,
  );

  // UC-SEG-002 — Actualizar gestión (contacto, notas, transición de estado)
  app.put(
    '/indicaciones-seguimiento/:id',
    { ...actualizarGestionIndicacionSchema, preHandler: [requireAuth, pSeguimientoEditar] },
    indicacionSeguimientoController.actualizarGestion,
  );

  // UC-SEG-002 — Cerrar el ciclo: agendar cita (reutiliza módulo de citas)
  app.post(
    '/indicaciones-seguimiento/:id/agendar-cita',
    {
      ...agendarCitaIndicacionSchema,
      preHandler: [requireAuth, pSeguimientoEditar, pAgendaCrear],
    },
    indicacionSeguimientoController.agendarCita,
  );
};
