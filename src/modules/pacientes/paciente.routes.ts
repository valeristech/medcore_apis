import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { pacienteController } from './paciente.controller.js';
import {
  crearPacienteSchema,
  actualizarPacienteSchema,
  buscarPacientesSchema,
  obtenerPacienteSchema,
  perfilPacienteSchema,
  eliminarPacienteSchema,
  crearAlergiaSchema,
  listarAlergiasSchema,
  eliminarAlergiaSchema,
  crearSeguroSchema,
  listarSegurosSchema,
  actualizarSeguroSchema,
  eliminarSeguroSchema,
} from './paciente.schemas.js';

export const pacienteRoutes: FastifyPluginAsync = async (app) => {
  // Permisos granulares por acción — compatibles con '*' (admin) y arrays (secretaria, enfermeria)
  const pLeer    = requirePermission('pacientes', 'leer');
  const pCrear   = requirePermission('pacientes', 'crear');
  const pEditar  = requirePermission('pacientes', 'editar');
  const pEliminar = requirePermission('pacientes', 'eliminar');

  // ── CRUD Paciente ───────────────────────────────────────────────────────────

  /** GET /pacientes — Buscar/listar pacientes del tenant */
  app.get('/pacientes', {
    ...buscarPacientesSchema,
    preHandler: [requireAuth, pLeer],
  }, pacienteController.search);

  /** POST /pacientes — Registrar nuevo paciente */
  app.post('/pacientes', {
    ...crearPacienteSchema,
    preHandler: [requireAuth, pCrear],
  }, pacienteController.create);

  /** GET /pacientes/:id — Obtener paciente por ID */
  app.get('/pacientes/:id', {
    ...obtenerPacienteSchema,
    preHandler: [requireAuth, pLeer],
  }, pacienteController.getById);

  /** PATCH /pacientes/:id — Actualizar datos del paciente */
  app.patch('/pacientes/:id', {
    ...actualizarPacienteSchema,
    preHandler: [requireAuth, pEditar],
  }, pacienteController.update);

  /** DELETE /pacientes/:id — Eliminar paciente (soft delete) */
  app.delete('/pacientes/:id', {
    ...eliminarPacienteSchema,
    preHandler: [requireAuth, pEliminar],
  }, pacienteController.remove);

  /** GET /pacientes/:id/perfil — Perfil completo del paciente */
  app.get('/pacientes/:id/perfil', {
    ...perfilPacienteSchema,
    preHandler: [requireAuth, pLeer],
  }, pacienteController.getPerfil);

  // ── Alergias ────────────────────────────────────────────────────────────────

  /** GET /pacientes/:id/alergias — Listar alergias */
  app.get('/pacientes/:id/alergias', {
    ...listarAlergiasSchema,
    preHandler: [requireAuth, pLeer],
  }, pacienteController.listAlergias);

  /** POST /pacientes/:id/alergias — Agregar alergia */
  app.post('/pacientes/:id/alergias', {
    ...crearAlergiaSchema,
    preHandler: [requireAuth, pCrear],
  }, pacienteController.createAlergia);

  /** DELETE /pacientes/:id/alergias/:alergiaId — Eliminar alergia */
  app.delete('/pacientes/:id/alergias/:alergiaId', {
    ...eliminarAlergiaSchema,
    preHandler: [requireAuth, pEliminar],
  }, pacienteController.removeAlergia);

  // ── Seguros ─────────────────────────────────────────────────────────────────

  /** GET /pacientes/:id/seguros — Listar seguros */
  app.get('/pacientes/:id/seguros', {
    ...listarSegurosSchema,
    preHandler: [requireAuth, pLeer],
  }, pacienteController.listSeguros);

  /** POST /pacientes/:id/seguros — Agregar seguro */
  app.post('/pacientes/:id/seguros', {
    ...crearSeguroSchema,
    preHandler: [requireAuth, pCrear],
  }, pacienteController.createSeguro);

  /** PATCH /pacientes/:id/seguros/:seguroId — Actualizar seguro */
  app.patch('/pacientes/:id/seguros/:seguroId', {
    ...actualizarSeguroSchema,
    preHandler: [requireAuth, pEditar],
  }, pacienteController.updateSeguro);

  /** DELETE /pacientes/:id/seguros/:seguroId — Eliminar seguro */
  app.delete('/pacientes/:id/seguros/:seguroId', {
    ...eliminarSeguroSchema,
    preHandler: [requireAuth, pEliminar],
  }, pacienteController.removeSeguro);
};
