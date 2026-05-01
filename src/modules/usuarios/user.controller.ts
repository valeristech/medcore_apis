import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import type { CreateUsuarioInput, SearchUsuariosQuery, UpdateUsuarioInput } from './user.schemas.js';
import { userService } from './user.service.js';

export const userController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const items = await userService.list(request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const usuario = await userService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { usuario });
  },

  async search(request: FastifyRequest, reply: FastifyReply) {
    const result = await userService.search(
      request.user.organizacion_id,
      request.query as SearchUsuariosQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const usuario = await userService.create(
      request.user.organizacion_id,
      request.body as CreateUsuarioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'usuario',
      recursoId: usuario.id,
      descripcion: 'Creación de usuario.',
      datosDespues: usuario,
    });
    return sendOk(reply, request.requestId, { usuario }, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const before = await userService.getById(id, request.user.organizacion_id);
    const usuario = await userService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdateUsuarioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'usuario',
      recursoId: id,
      descripcion: 'Actualización de usuario.',
      datosAntes: before,
      datosDespues: usuario,
    });
    return sendOk(reply, request.requestId, { usuario });
  },

  async desactivar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const before = await userService.getById(id, request.user.organizacion_id);
    await userService.desactivar(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'disable',
      recurso: 'usuario',
      recursoId: id,
      descripcion: 'Desactivación de usuario e invalidación de refresh.',
      datosAntes: before,
      datosDespues: { estado: 'inactivo' },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const before = await userService.getById(id, request.user.organizacion_id);
    await userService.remove(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'usuario',
      recursoId: id,
      descripcion: 'Soft delete de usuario e invalidación de refresh.',
      datosAntes: before,
      datosDespues: {
        deleted: true,
        deleted_at: new Date().toISOString(),
        estado: 'inactivo',
      },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
