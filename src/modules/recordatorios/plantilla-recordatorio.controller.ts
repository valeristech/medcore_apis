import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { plantillaRecordatorioService } from './plantilla-recordatorio.service.js';
import type {
  CreatePlantillaRecordatorioInput,
  ListPlantillasRecordatorioQuery,
  UpdatePlantillaRecordatorioInput,
} from './plantilla-recordatorio.schemas.js';

type IdParams = { id: string };

export const plantillaRecordatorioController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await plantillaRecordatorioService.list(
      request.user.organizacion_id,
      request.query as ListPlantillasRecordatorioQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const plantilla = await plantillaRecordatorioService.create(
      request.user.organizacion_id,
      request.body as CreatePlantillaRecordatorioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'plantilla_recordatorio',
      recursoId: plantilla.id,
      descripcion: `Plantilla recordatorio ${plantilla.canal} (${plantilla.horas_antes}h)`,
      datosDespues: plantilla,
    });
    return sendOk(reply, request.requestId, { plantilla }, 201);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const plantilla = await plantillaRecordatorioService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { plantilla });
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await plantillaRecordatorioService.getById(id, request.user.organizacion_id);
    const plantilla = await plantillaRecordatorioService.update(
      id,
      request.user.organizacion_id,
      request.body as UpdatePlantillaRecordatorioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'plantilla_recordatorio',
      recursoId: id,
      descripcion: 'Actualización plantilla recordatorio',
      datosAntes: before,
      datosDespues: plantilla,
    });
    return sendOk(reply, request.requestId, { plantilla });
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await plantillaRecordatorioService.getById(id, request.user.organizacion_id);
    await plantillaRecordatorioService.remove(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'plantilla_recordatorio',
      recursoId: id,
      descripcion: 'Soft delete plantilla recordatorio',
      datosAntes: before,
      datosDespues: { deleted: true },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
