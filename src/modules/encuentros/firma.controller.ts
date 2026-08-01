import type { FastifyRequest, FastifyReply } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';

export const firmaController = {
  // UC-HCE-006 — Firmar y cerrar encuentro
  async firmarEncuentro(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const medicoId = request.user.sub;
    const encuentroId = (request.params as { id: string }).id;

    const result = await hceService.firmarEncuentro(encuentroId, tenantOrgId, medicoId, request.ip);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'firmar',
      recurso: 'encuentros',
      recursoId: encuentroId,
      descripcion: `Encuentro firmado y cerrado. Hash: ${(result.firma as unknown as { hash_documento: string }).hash_documento}.`,
      datosDespues: result as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, result);
  },
};
