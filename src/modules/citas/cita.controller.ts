import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { citaService } from './cita.service.js';
import type { CancelCitaInput, CreateCitaInput, RescheduleCitaInput } from './cita.schemas.js';

type IdParams = { id: string };

export const citaController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const cita = await citaService.create(tenantOrgId, request.body as CreateCitaInput);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'citas',
      recursoId: cita.id,
      descripcion: `Cita creada: ${cita.fecha_hora_inicio} – ${cita.tipo_cita?.nombre ?? cita.tipo_cita_id}`,
      datosDespues: cita,
    });

    return sendOk(reply, request.requestId, { cita }, 201);
  },

  async reschedule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const before = await citaService.getCitaForAudit(id, tenantOrgId);
    const cita = await citaService.reschedule(id, tenantOrgId, request.body as RescheduleCitaInput);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'reagendar',
      recurso: 'citas',
      recursoId: id,
      descripcion: `Cita reagendada: ${cita.fecha_hora_inicio}`,
      datosAntes: before,
      datosDespues: cita,
    });

    return sendOk(reply, request.requestId, { cita });
  },

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const before = await citaService.getCitaForAudit(id, tenantOrgId);
    const result = await citaService.cancel(id, tenantOrgId, request.body as CancelCitaInput);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'cancelar',
      recurso: 'citas',
      recursoId: id,
      descripcion: `Cita cancelada: ${result.cita.motivo_cancelacion ?? ''}`,
      datosAntes: before,
      datosDespues: result.cita,
    });

    return sendOk(reply, request.requestId, result);
  },
};
