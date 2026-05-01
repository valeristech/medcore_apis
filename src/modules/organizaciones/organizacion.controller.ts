import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { organizacionService } from './organizacion.service.js';
import type {
  CreateOrganizacionInput,
  SearchOrganizacionesQuery,
  UpdateOrganizacionInput,
} from './organizacion.schemas.js';

type IdParams = { id: string };

export const organizacionController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const items = await organizacionService.listForTenant(request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async searchForTenant(request: FastifyRequest, reply: FastifyReply) {
    const result = await organizacionService.searchForTenant(
      request.user.organizacion_id,
      request.query as SearchOrganizacionesQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const organizacion = await organizacionService.getByIdForTenant(
      id,
      request.user.organizacion_id,
    );
    return sendOk(reply, request.requestId, { organizacion });
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const organizacion = await organizacionService.create(
      request.body as CreateOrganizacionInput,
    );
    await writeAuditLog({
      request,
      organizacionId: organizacion.id,
      accion: 'create',
      recurso: 'organizacion',
      recursoId: organizacion.id,
      descripcion: 'Creación de organización.',
      datosDespues: organizacion,
    });
    return sendOk(reply, request.requestId, { organizacion }, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await organizacionService.getByIdForTenant(id, request.user.organizacion_id);
    const organizacion = await organizacionService.updateForTenant(
      id,
      request.user.organizacion_id,
      request.body as UpdateOrganizacionInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'organizacion',
      recursoId: id,
      descripcion: 'Actualización de organización.',
      datosAntes: before,
      datosDespues: organizacion,
    });
    return sendOk(reply, request.requestId, { organizacion });
  },

  async softDelete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await organizacionService.getByIdForTenant(id, request.user.organizacion_id);
    await organizacionService.softDeleteForTenant(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'organizacion',
      recursoId: id,
      descripcion: 'Soft delete de organización.',
      datosAntes: before,
      datosDespues: { deleted: true, deleted_at: new Date().toISOString(), activo: false },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
