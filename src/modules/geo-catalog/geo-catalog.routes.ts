import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { geoCatalogController } from './geo-catalog.controller.js';
import {
  createDepartamentoSchema,
  createMunicipioSchema,
  deleteDepartamentoSchema,
  deleteMunicipioSchema,
  getDepartamentoSchema,
  getMunicipioSchema,
  listDepartamentosSchema,
  listMunicipiosByDeptoSchema,
  updateDepartamentoSchema,
  updateMunicipioSchema,
} from './geo-catalog.schemas.js';

const pLeer = requirePermission('catalogos_geo', 'leer');
const pCrear = requirePermission('catalogos_geo', 'crear');
const pEditar = requirePermission('catalogos_geo', 'editar');

export const geoCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/departamentos',
    { ...listDepartamentosSchema, preHandler: [requireAuth, pLeer] },
    geoCatalogController.listDepartamentos,
  );

  app.post(
    '/departamentos',
    { ...createDepartamentoSchema, preHandler: [requireAuth, pCrear] },
    geoCatalogController.createDepartamento,
  );

  app.get(
    '/departamentos/:id',
    { ...getDepartamentoSchema, preHandler: [requireAuth, pLeer] },
    geoCatalogController.getDepartamento,
  );

  app.patch(
    '/departamentos/:id',
    { ...updateDepartamentoSchema, preHandler: [requireAuth, pEditar] },
    geoCatalogController.updateDepartamento,
  );

  app.delete(
    '/departamentos/:id',
    { ...deleteDepartamentoSchema, preHandler: [requireAuth, pEditar] },
    geoCatalogController.removeDepartamento,
  );

  app.get(
    '/municipios/departamentos/:departamentoId',
    { ...listMunicipiosByDeptoSchema, preHandler: [requireAuth, pLeer] },
    geoCatalogController.listMunicipios,
  );

  app.post(
    '/municipios',
    { ...createMunicipioSchema, preHandler: [requireAuth, pCrear] },
    geoCatalogController.createMunicipio,
  );

  app.get(
    '/municipios/:id',
    { ...getMunicipioSchema, preHandler: [requireAuth, pLeer] },
    geoCatalogController.getMunicipio,
  );

  app.patch(
    '/municipios/:id',
    { ...updateMunicipioSchema, preHandler: [requireAuth, pEditar] },
    geoCatalogController.updateMunicipio,
  );

  app.delete(
    '/municipios/:id',
    { ...deleteMunicipioSchema, preHandler: [requireAuth, pEditar] },
    geoCatalogController.removeMunicipio,
  );
};
