import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { listaEsperaService } from './lista-espera.service.js';
import type {
  CreateListaEsperaInput,
  ListListaEsperaQuery,
  ListListaEsperaSugerenciasQuery,
  UpdateListaEsperaInput,
} from './lista-espera.schemas.js';

type IdParams = { id: string };

export const listaEsperaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await listaEsperaService.list(
      request.user.organizacion_id,
      request.query as ListListaEsperaQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async sugerencias(request: FastifyRequest, reply: FastifyReply) {
    const result = await listaEsperaService.sugerencias(
      request.user.organizacion_id,
      request.query as ListListaEsperaSugerenciasQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const lista_espera = await listaEsperaService.create(
      request.user.organizacion_id,
      request.body as CreateListaEsperaInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'lista_espera',
      recursoId: lista_espera.id,
      descripcion: `Lista de espera: paciente ${lista_espera.paciente_id}`,
      datosDespues: lista_espera,
    });
    return sendOk(reply, request.requestId, { lista_espera }, 201);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const lista_espera = await listaEsperaService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { lista_espera });
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await listaEsperaService.getById(id, request.user.organizacion_id);
    const lista_espera = await listaEsperaService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdateListaEsperaInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'lista_espera',
      recursoId: id,
      descripcion: 'Actualización de lista de espera.',
      datosAntes: before,
      datosDespues: lista_espera,
    });
    return sendOk(reply, request.requestId, { lista_espera });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await listaEsperaService.getById(id, request.user.organizacion_id);
    await listaEsperaService.remove(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'lista_espera',
      recursoId: id,
      descripcion: 'Baja de entrada en lista de espera.',
      datosAntes: before,
      datosDespues: { deleted: true, estado: 'cancelada' },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
