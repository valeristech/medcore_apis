import type { FastifyReply, FastifyRequest } from 'fastify';
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
    return sendOk(reply, request.requestId, { organizacion }, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const organizacion = await organizacionService.updateForTenant(
      id,
      request.user.organizacion_id,
      request.body as UpdateOrganizacionInput,
    );
    return sendOk(reply, request.requestId, { organizacion });
  },

  async softDelete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    await organizacionService.softDeleteForTenant(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { ok: true });
  },
};
