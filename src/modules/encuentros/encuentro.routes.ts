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
import { estudioController } from './estudio.controller.js';
import { crearEstudioSchema, listarEstudiosSchema, actualizarEstudioSchema } from './estudio.schemas.js';
import { evolucionController } from './evolucion.controller.js';
import { crearEvolucionSchema, listarEvolucionesSchema } from './evolucion.schemas.js';
import { firmaController } from './firma.controller.js';
import { firmarEncuentroSchema } from './firma.schemas.js';

const pHceLeer = requirePermission('hce', 'leer');
const pHceCrear = requirePermission('hce', 'crear');
const pHceEditar = requirePermission('hce', 'editar');
const pHceFirmar = requirePermission('hce', 'firmar');

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

  // UC-HCE-004 — Solicitar estudio
  app.post(
    '/encuentros/:id/estudios',
    { ...crearEstudioSchema, preHandler: [requireAuth, pHceCrear] },
    estudioController.crearEstudio,
  );

  // UC-HCE-004 — Listar estudios del encuentro
  app.get(
    '/encuentros/:id/estudios',
    { ...listarEstudiosSchema, preHandler: [requireAuth, pHceLeer] },
    estudioController.listarEstudios,
  );

  // UC-HCE-004 — Actualizar estudio (registrar resultado / cambiar estado)
  app.patch(
    '/estudios/:id',
    { ...actualizarEstudioSchema, preHandler: [requireAuth, pHceEditar] },
    estudioController.actualizarEstudio,
  );

  // UC-HCE-005 — Agregar evolución
  app.post(
    '/encuentros/:id/evoluciones',
    { ...crearEvolucionSchema, preHandler: [requireAuth, pHceCrear] },
    evolucionController.crearEvolucion,
  );

  // UC-HCE-005 — Listar evoluciones del encuentro
  app.get(
    '/encuentros/:id/evoluciones',
    { ...listarEvolucionesSchema, preHandler: [requireAuth, pHceLeer] },
    evolucionController.listarEvoluciones,
  );

  // UC-HCE-006 — Firmar y cerrar encuentro
  app.post(
    '/encuentros/:id/firmar',
    { ...firmarEncuentroSchema, preHandler: [requireAuth, pHceFirmar] },
    firmaController.firmarEncuentro,
  );
};
