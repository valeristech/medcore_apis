import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { sedeController } from './sede.controller.js';
import {
  createConsultorioSchema,
  createSedeSchema,
  deleteConsultorioSchema,
  deleteSedeSchema,
  getConsultorioSchema,
  getSedeSchema,
  listConsultoriosSchema,
  listSedesSchema,
  searchConsultoriosSchema,
  searchSedesSchema,
  updateConsultorioSchema,
  updateSedeSchema,
} from './sede.schemas.js';

const pSedes = requirePermission('sedes', '*');
const pConsultorios = requirePermission('consultorios', '*');

export const sedeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/sedes',
    {
      ...listSedesSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.listSedes,
  );

  app.post(
    '/sedes',
    {
      ...createSedeSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.createSede,
  );

  app.get(
    '/sedes/search',
    {
      ...searchSedesSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.searchSedes,
  );

  app.get(
    '/sedes/:sedeId',
    {
      ...getSedeSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.getSede,
  );

  app.patch(
    '/sedes/:sedeId',
    {
      ...updateSedeSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.updateSede,
  );

  app.delete(
    '/sedes/:sedeId',
    {
      ...deleteSedeSchema,
      preHandler: [requireAuth, pSedes],
    },
    sedeController.deleteSede,
  );

  app.get(
    '/consultorios/search',
    {
      ...searchConsultoriosSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.searchConsultorios,
  );

  app.get(
    '/consultorios/sedes/:sedeId',
    {
      ...listConsultoriosSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.listConsultorios,
  );

  app.post(
    '/consultorios/sedes/:sedeId',
    {
      ...createConsultorioSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.createConsultorio,
  );

  app.get(
    '/consultorios/:id',
    {
      ...getConsultorioSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.getConsultorio,
  );

  app.patch(
    '/consultorios/:id',
    {
      ...updateConsultorioSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.updateConsultorio,
  );

  app.delete(
    '/consultorios/:id',
    {
      ...deleteConsultorioSchema,
      preHandler: [requireAuth, pConsultorios],
    },
    sedeController.deleteConsultorio,
  );
};
