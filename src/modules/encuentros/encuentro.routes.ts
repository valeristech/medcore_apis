import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { hceController } from './encuentro.controller.js';
import { iniciarEncuentroSchema, crearNotaSchema, actualizarNotaSchema } from './encuentro.schemas.js';
import { prescripcionController } from './prescripcion.controller.js';
import {
  crearPrescripcionSchema,
  listarPrescripcionesSchema,
  actualizarPrescripcionSchema,
  eliminarPrescripcionSchema,
} from './prescripcion.schemas.js';

const pHceLeer = requirePermission('hce', 'leer');
const pHceCrear = requirePermission('hce', 'crear');
const pHceEditar = requirePermission('hce', 'editar');

export const encuentroRoutes: FastifyPluginAsync = async (app) => {
  // UC-HCE-001 — Iniciar consulta (abrir encuentro)
  app.post(
    '/encuentros',
    { ...iniciarEncuentroSchema, preHandler: [requireAuth, pHceCrear] },
    hceController.iniciarEncuentro,
  );

  // UC-HCE-002 — Crear nota clínica
  app.post(
    '/encuentros/:id/nota',
    { ...crearNotaSchema, preHandler: [requireAuth, pHceCrear] },
    hceController.crearNota,
  );

  // UC-HCE-002 — Actualizar nota clínica (auto-guardado)
  app.patch(
    '/encuentros/:id/nota',
    { ...actualizarNotaSchema, preHandler: [requireAuth, pHceEditar] },
    hceController.actualizarNota,
  );

  // UC-HCE-003 — Crear prescripción
  app.post(
    '/encuentros/:id/prescripciones',
    { ...crearPrescripcionSchema, preHandler: [requireAuth, pHceCrear] },
    prescripcionController.crearPrescripcion,
  );

  // UC-HCE-003 — Listar prescripciones del encuentro
  app.get(
    '/encuentros/:id/prescripciones',
    { ...listarPrescripcionesSchema, preHandler: [requireAuth, pHceLeer] },
    prescripcionController.listarPrescripciones,
  );

  // UC-HCE-003 — Actualizar prescripción
  app.patch(
    '/prescripciones/:id',
    { ...actualizarPrescripcionSchema, preHandler: [requireAuth, pHceEditar] },
    prescripcionController.actualizarPrescripcion,
  );

  // UC-HCE-003 — Eliminar prescripción (soft delete)
  app.delete(
    '/prescripciones/:id',
    { ...eliminarPrescripcionSchema, preHandler: [requireAuth, pHceEditar] },
    prescripcionController.eliminarPrescripcion,
  );
};
