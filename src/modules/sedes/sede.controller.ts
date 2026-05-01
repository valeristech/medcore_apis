import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendOk } from '../../core/http/response.js';
import { sedeService } from './sede.service.js';
import type {
  CreateConsultorioInput,
  CreateSedeInput,
  SearchConsultoriosQuery,
  SearchSedesQuery,
  UpdateConsultorioInput,
  UpdateSedeInput,
} from './sede.schemas.js';

type SedeParams = { sedeId: string };
type SedeConsultorioParams = { sedeId: string; id: string };

export const sedeController = {
  async listSedes(request: FastifyRequest, reply: FastifyReply) {
    const items = await sedeService.listSedes(request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async createSede(request: FastifyRequest, reply: FastifyReply) {
    const sede = await sedeService.createSede(
      request.user.organizacion_id,
      request.body as CreateSedeInput,
    );
    return sendOk(reply, request.requestId, { sede }, 201);
  },

  async searchSedes(request: FastifyRequest, reply: FastifyReply) {
    const result = await sedeService.searchSedes(
      request.user.organizacion_id,
      request.query as SearchSedesQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async getSede(request: FastifyRequest, reply: FastifyReply) {
    const { sedeId } = request.params as SedeParams;
    const sede = await sedeService.getSede(sedeId, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { sede });
  },

  async updateSede(request: FastifyRequest, reply: FastifyReply) {
    const { sedeId } = request.params as SedeParams;
    const sede = await sedeService.updateSede(
      sedeId,
      request.user.organizacion_id,
      request.body as UpdateSedeInput,
    );
    return sendOk(reply, request.requestId, { sede });
  },

  async deleteSede(request: FastifyRequest, reply: FastifyReply) {
    const { sedeId } = request.params as SedeParams;
    await sedeService.deleteSede(sedeId, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { ok: true });
  },

  async listConsultorios(request: FastifyRequest, reply: FastifyReply) {
    const { sedeId } = request.params as SedeParams;
    const items = await sedeService.listConsultorios(sedeId, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async searchConsultorios(request: FastifyRequest, reply: FastifyReply) {
    const result = await sedeService.searchConsultorios(
      request.user.organizacion_id,
      request.query as SearchConsultoriosQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async createConsultorio(request: FastifyRequest, reply: FastifyReply) {
    const { sedeId } = request.params as SedeParams;
    const consultorio = await sedeService.createConsultorio(
      sedeId,
      request.user.organizacion_id,
      request.body as CreateConsultorioInput,
    );
    return sendOk(reply, request.requestId, { consultorio }, 201);
  },

  async getConsultorio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const consultorio = await sedeService.getConsultorio(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { consultorio });
  },

  async updateConsultorio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const consultorio = await sedeService.updateConsultorioById(
      id,
      request.user.organizacion_id,
      request.body as UpdateConsultorioInput,
    );
    return sendOk(reply, request.requestId, { consultorio });
  },

  async deleteConsultorio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await sedeService.deleteConsultorioById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { ok: true });
  },
};
