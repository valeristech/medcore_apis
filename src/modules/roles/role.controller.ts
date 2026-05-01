import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendOk } from '../../core/http/response.js';
import { roleService } from './role.service.js';
import type { CreateRoleInput, SearchRolesQuery, UpdateRoleInput } from './role.schemas.js';

export const roleController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const items = await roleService.list(request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const rol = await roleService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { rol });
  },

  async search(request: FastifyRequest, reply: FastifyReply) {
    const result = await roleService.search(
      request.user.organizacion_id,
      request.query as SearchRolesQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const rol = await roleService.create(
      request.user.organizacion_id,
      request.body as CreateRoleInput,
    );
    return sendOk(reply, request.requestId, { rol }, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const rol = await roleService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdateRoleInput,
    );
    return sendOk(reply, request.requestId, { rol });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await roleService.remove(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { ok: true });
  },

  async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    const items = roleService.listTemplates();
    return sendOk(reply, request.requestId, { items });
  },

  async getTemplateByKey(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string };
    const template = roleService.getTemplateByKey(key);
    return sendOk(reply, request.requestId, { template });
  },
};
