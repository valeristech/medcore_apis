import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { citaService } from './cita.service.js';
import type { CreateCitaInput } from './cita.schemas.js';

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
};
