import type { FastifyReply, FastifyRequest } from "fastify";
import { sendOk } from "../../core/http/response.js";
import { writeAuditLog } from "../../core/audit/auditLog.js";
import { pacienteService } from "./paciente.service.js";
import { alergiaService } from "./alergia.service.js";
import { seguroService } from "./seguro.service.js";
import type {
  CreateAlergiaInput,
  CreatePacienteInput,
  CreateSeguroInput,
  SearchPacientesQuery,
  SearchSegurosQuery,
  UpdateAlergiaInput,
  UpdatePacienteInput,
  UpdateSeguroInput,
} from "./paciente.schemas.js";

// ─── Tipos de parámetros de ruta ──────────────────────────────────────────────

type IdParam = { id: string };
type IdAlergiaParam = { id: string; alergiaId: string };
type IdSeguroParam = { id: string; seguroId: string };

// ─── Controller ───────────────────────────────────────────────────────────────

export const pacienteController = {
  // ── CRUD Paciente ───────────────────────────────────────────────────────────

  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const paciente = await pacienteService.create(
      tenantOrgId,
      request.body as CreatePacienteInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "crear",
      recurso: "pacientes",
      recursoId: paciente.id,
      descripcion: `Paciente creado: ${paciente.nombre} ${paciente.apellido}`,
      datosAntes: undefined,
      datosDespues: paciente,
    });

    return sendOk(reply, request.requestId, paciente, 201);
  },

  async search(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const result = await pacienteService.search(
      tenantOrgId,
      request.query as SearchPacientesQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    const paciente = await pacienteService.getById(id, tenantOrgId);
    return sendOk(reply, request.requestId, paciente);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    const paciente = await pacienteService.update(
      id,
      tenantOrgId,
      request.body as UpdatePacienteInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "actualizar",
      recurso: "pacientes",
      recursoId: id,
      descripcion: `Paciente actualizado: ${paciente.nombre} ${paciente.apellido}`,
      datosAntes: undefined,
      datosDespues: request.body,
    });

    return sendOk(reply, request.requestId, paciente);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;

    await pacienteService.remove(id, tenantOrgId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "eliminar",
      recurso: "pacientes",
      recursoId: id,
      descripcion: "Paciente eliminado (soft delete).",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, null, 204);
  },

  async getPerfil(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    const perfil = await pacienteService.getPerfil(id, tenantOrgId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "leer",
      recurso: "pacientes/perfil",
      recursoId: id,
      descripcion: "Perfil completo del paciente consultado.",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, perfil);
  },

  // ── Alergias ────────────────────────────────────────────────────────────────

  async createAlergia(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const alergia = await alergiaService.create(
      id,
      request.body as CreateAlergiaInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "crear",
      recurso: "pacientes/alergias",
      recursoId: alergia.id,
      descripcion: `Alergia registrada: ${alergia.sustancia} (${alergia.severidad})`,
      datosAntes: undefined,
      datosDespues: alergia,
    });

    return sendOk(reply, request.requestId, alergia, 201);
  },

  async listAlergias(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const alergias = await alergiaService.list(id);
    return sendOk(reply, request.requestId, { items: alergias });
  },

  async getAlergia(request: FastifyRequest, reply: FastifyReply) {
    const { id, alergiaId } = request.params as IdAlergiaParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const alergia = await alergiaService.getById(id, alergiaId);
    return sendOk(reply, request.requestId, alergia);
  },

  async updateAlergia(request: FastifyRequest, reply: FastifyReply) {
    const { id, alergiaId } = request.params as IdAlergiaParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const alergia = await alergiaService.update(
      id,
      alergiaId,
      request.body as UpdateAlergiaInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "actualizar",
      recurso: "pacientes/alergias",
      recursoId: alergiaId,
      descripcion: `Alergia actualizada: ${alergia.sustancia} (${alergia.severidad})`,
      datosAntes: undefined,
      datosDespues: request.body,
    });

    return sendOk(reply, request.requestId, alergia);
  },

  async removeAlergia(request: FastifyRequest, reply: FastifyReply) {
    const { id, alergiaId } = request.params as IdAlergiaParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    await alergiaService.remove(id, alergiaId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "eliminar",
      recurso: "pacientes/alergias",
      recursoId: alergiaId,
      descripcion: "Alergia eliminada (soft delete).",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, null, 204);
  },

  // ── Seguros ─────────────────────────────────────────────────────────────────

  async createSeguro(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const seguro = await seguroService.create(
      id,
      request.body as CreateSeguroInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "crear",
      recurso: "pacientes/seguros",
      recursoId: seguro.id,
      descripcion: `Seguro registrado: póliza ${seguro.numero_poliza}`,
      datosAntes: undefined,
      datosDespues: seguro,
    });

    return sendOk(reply, request.requestId, seguro, 201);
  },

  async listSeguros(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const result = await seguroService.list(id, request.query as SearchSegurosQuery);
    return sendOk(reply, request.requestId, result);
  },

  async getSeguro(request: FastifyRequest, reply: FastifyReply) {
    const { id, seguroId } = request.params as IdSeguroParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const seguro = await seguroService.getById(id, seguroId);
    return sendOk(reply, request.requestId, seguro);
  },

  async updateSeguro(request: FastifyRequest, reply: FastifyReply) {
    const { id, seguroId } = request.params as IdSeguroParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    const seguro = await seguroService.update(
      id,
      seguroId,
      request.body as UpdateSeguroInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "actualizar",
      recurso: "pacientes/seguros",
      recursoId: seguroId,
      descripcion: `Seguro actualizado: póliza ${seguro.numero_poliza}`,
      datosAntes: undefined,
      datosDespues: request.body,
    });

    return sendOk(reply, request.requestId, seguro);
  },

  async removeSeguro(request: FastifyRequest, reply: FastifyReply) {
    const { id, seguroId } = request.params as IdSeguroParam;
    const tenantOrgId = request.user.organizacion_id;
    await pacienteService.getPacienteTenantOr404(id, tenantOrgId);
    await seguroService.remove(id, seguroId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "eliminar",
      recurso: "pacientes/seguros",
      recursoId: seguroId,
      descripcion: "Seguro eliminado (soft delete).",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, null, 204);
  },
};
