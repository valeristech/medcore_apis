import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { hceController } from './encuentro.controller.js';
import { iniciarEncuentroSchema } from './encuentro.schemas.js';

const pHceLeer = requirePermission('hce', 'leer');
const pHceCrear = requirePermission('hce', 'crear');

export const encuentroRoutes: FastifyPluginAsync = async (app) => {
  // UC-HCE-001 — Iniciar consulta (abrir encuentro)
  app.post(
    '/encuentros',
    { ...iniciarEncuentroSchema, preHandler: [requireAuth, pHceCrear] },
    hceController.iniciarEncuentro,
  );
};
