import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { listaEsperaController } from './lista-espera.controller.js';
import {
  createListaEsperaSchema,
  deleteListaEsperaSchema,
  getListaEsperaSchema,
  listListaEsperaSchema,
  listListaEsperaSugerenciasSchema,
  updateListaEsperaSchema,
} from './lista-espera.schemas.js';

const pLeer = requirePermission('agenda', 'leer');
const pCrear = requirePermission('agenda', 'crear');
const pEditar = requirePermission('agenda', 'editar');

export const listaEsperaRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/sugerencias',
    { ...listListaEsperaSugerenciasSchema, preHandler: [requireAuth, pLeer] },
    listaEsperaController.sugerencias,
  );

  app.get(
    '/',
    { ...listListaEsperaSchema, preHandler: [requireAuth, pLeer] },
    listaEsperaController.list,
  );

  app.post(
    '/',
    { ...createListaEsperaSchema, preHandler: [requireAuth, pCrear] },
    listaEsperaController.create,
  );

  app.get(
    '/:id',
    { ...getListaEsperaSchema, preHandler: [requireAuth, pLeer] },
    listaEsperaController.getById,
  );

  app.patch(
    '/:id',
    { ...updateListaEsperaSchema, preHandler: [requireAuth, pEditar] },
    listaEsperaController.update,
  );

  app.delete(
    '/:id',
    { ...deleteListaEsperaSchema, preHandler: [requireAuth, pEditar] },
    listaEsperaController.remove,
  );
};
