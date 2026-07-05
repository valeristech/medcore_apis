import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { hceController } from './encuentro.controller.js';
import { iniciarEncuentroSchema, crearNotaSchema, actualizarNotaSchema } from './encuentro.schemas.js';

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
};
