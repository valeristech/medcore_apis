import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';
import type { IniciarEncuentroInput } from './encuentro.schemas.js';

export const hceController = {
  async iniciarEncuentro(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const medicoId = request.user.sub;
    const input = request.body as IniciarEncuentroInput;

    const result = await hceService.iniciarEncuentro(tenantOrgId, medicoId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'encuentros',
      recursoId: result.encuentro.id,
      descripcion: `Encuentro iniciado para paciente ${input.paciente_id}. Tipo: ${input.tipo}.`,
      datosDespues: result.encuentro,
    });

    return sendOk(reply, request.requestId, result, 201);
  },
};
