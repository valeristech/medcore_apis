import type { FastifyRequest, FastifyReply } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';
import type { CrearEvolucionInput } from './evolucion.schemas.js';

export const evolucionController = {
  // UC-HCE-005 — Agregar evolución
  async crearEvolucion(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const usuarioId = request.user.sub;
    const encuentroId = (request.params as { id: string }).id;
    const input = request.body as CrearEvolucionInput;

    const evolucion = await hceService.crearEvolucion(encuentroId, tenantOrgId, usuarioId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'evoluciones',
      recursoId: (evolucion as unknown as { id: string }).id,
      descripcion: `Evolución (${(evolucion as unknown as { tipo: string }).tipo}) agregada al encuentro ${encuentroId}.`,
      datosDespues: evolucion as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { evolucion }, 201);
  },

  // UC-HCE-005 — Listar evoluciones del encuentro
  async listarEvoluciones(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;

    const items = await hceService.listarEvoluciones(encuentroId, tenantOrgId);

    return sendOk(reply, request.requestId, { items });
  },
};
