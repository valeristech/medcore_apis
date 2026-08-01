import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { alertaService } from './alerta.service.js';
import type { GestionarAlertaInput, ListAlertasQuery } from './alerta.schemas.js';

type IdParams = { id: string };

export const alertaController = {
  async listar(request: FastifyRequest, reply: FastifyReply) {
    const result = await alertaService.listar(
      request.user.organizacion_id,
      request.query as ListAlertasQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async gestionar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const actorId = request.user.sub;

    const alerta = await alertaService.gestionar(
      id,
      tenantOrgId,
      actorId,
      request.body as GestionarAlertaInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'alertas_preventivas',
      recursoId: id,
      descripcion: `Alerta pasó a estado "${alerta.estado}".`,
      datosDespues: alerta,
    });

    return sendOk(reply, request.requestId, { alerta });
  },
};
