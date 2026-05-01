import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { disponibilidadService } from './disponibilidad.service.js';
import type {
  CreateReglaDisponibilidadInput,
  SearchReglasQuery,
  UpdateReglaDisponibilidadInput,
} from './disponibilidad.schemas.js';

type IdParams = { id: string };
type UsuarioParams = { usuarioId: string };

export const disponibilidadController = {
  async search(request: FastifyRequest, reply: FastifyReply) {
    const result = await disponibilidadService.search(
      request.user.organizacion_id,
      request.query as SearchReglasQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async listByUsuario(request: FastifyRequest, reply: FastifyReply) {
    const { usuarioId } = request.params as UsuarioParams;
    const result = await disponibilidadService.listByUsuario(usuarioId, request.user.organizacion_id);
    return sendOk(reply, request.requestId, result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const regla = await disponibilidadService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { regla });
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const regla = await disponibilidadService.create(
      request.user.organizacion_id,
      request.body as CreateReglaDisponibilidadInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'regla_disponibilidad',
      recursoId: regla.id,
      descripcion: 'Creación de regla de disponibilidad médico/consultorio.',
      datosDespues: regla,
    });
    return sendOk(reply, request.requestId, { regla }, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await disponibilidadService.getById(id, request.user.organizacion_id);
    const regla = await disponibilidadService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdateReglaDisponibilidadInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'regla_disponibilidad',
      recursoId: id,
      descripcion: 'Actualización de regla de disponibilidad.',
      datosAntes: before,
      datosDespues: regla,
    });
    return sendOk(reply, request.requestId, { regla });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await disponibilidadService.getById(id, request.user.organizacion_id);
    await disponibilidadService.remove(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'regla_disponibilidad',
      recursoId: id,
      descripcion: 'Soft delete de regla de disponibilidad.',
      datosAntes: before,
      datosDespues: { deleted: true, deleted_at: new Date().toISOString() },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
