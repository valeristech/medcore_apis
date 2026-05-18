import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { tipoCitaService } from './tipo-cita.service.js';
import type {
  CreateTipoCitaInput,
  ListTiposCitaQuery,
  UpdateTipoCitaInput,
} from './tipo-cita.schemas.js';

type IdParams = { id: string };

export const tipoCitaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await tipoCitaService.list(
      request.user.organizacion_id,
      request.query as ListTiposCitaQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const tipo_cita = await tipoCitaService.create(
      request.user.organizacion_id,
      request.body as CreateTipoCitaInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'tipo_cita',
      recursoId: tipo_cita.id,
      descripcion: `Catálogo tipo de cita: ${tipo_cita.nombre}`,
      datosDespues: tipo_cita,
    });
    return sendOk(reply, request.requestId, { tipo_cita }, 201);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tipo_cita = await tipoCitaService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { tipo_cita });
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await tipoCitaService.getById(id, request.user.organizacion_id);
    const tipo_cita = await tipoCitaService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdateTipoCitaInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'tipo_cita',
      recursoId: id,
      descripcion: 'Actualización de tipo de cita.',
      datosAntes: before,
      datosDespues: tipo_cita,
    });
    return sendOk(reply, request.requestId, { tipo_cita });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await tipoCitaService.getById(id, request.user.organizacion_id);
    await tipoCitaService.remove(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'tipo_cita',
      recursoId: id,
      descripcion: 'Soft delete de tipo de cita.',
      datosAntes: before,
      datosDespues: { deleted: true },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
