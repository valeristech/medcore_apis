import type { FastifyRequest, FastifyReply } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';
import type { CrearEstudioInput, ActualizarEstudioInput } from './estudio.schemas.js';

export const estudioController = {
  // UC-HCE-004 — Solicitar estudio
  async crearEstudio(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;
    const input = request.body as CrearEstudioInput;

    const estudio = await hceService.crearEstudio(encuentroId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'estudios',
      recursoId: (estudio as unknown as { id: string }).id,
      descripcion: `Estudio solicitado: "${input.nombre}" (${input.tipo}) para encuentro ${encuentroId}.`,
      datosDespues: estudio as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { estudio }, 201);
  },

  // UC-HCE-004 — Listar estudios del encuentro
  async listarEstudios(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;

    const items = await hceService.listarEstudios(encuentroId, tenantOrgId);

    return sendOk(reply, request.requestId, { items });
  },

  // UC-HCE-004 — Actualizar estudio (registrar resultado / cambiar estado)
  async actualizarEstudio(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const estudioId = (request.params as { id: string }).id;
    const input = request.body as ActualizarEstudioInput;

    const datosAntes = await hceService.getEstudioPublic(estudioId, tenantOrgId);
    const estudio = await hceService.actualizarEstudio(estudioId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'estudios',
      recursoId: estudioId,
      descripcion: `Estudio actualizado.${input.estado ? ` Estado → "${input.estado}".` : ''}`,
      datosAntes: datosAntes as unknown as Record<string, unknown>,
      datosDespues: estudio as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { estudio });
  },
};
