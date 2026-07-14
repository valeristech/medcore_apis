import type { FastifyRequest, FastifyReply } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';
import type { CrearPrescripcionInput, ActualizarPrescripcionInput } from './prescripcion.schemas.js';

export const prescripcionController = {
  // UC-HCE-003 — Crear prescripción
  async crearPrescripcion(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;
    const input = request.body as CrearPrescripcionInput;

    const result = await hceService.crearPrescripcion(encuentroId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'prescripciones',
      recursoId: (result.prescripcion as unknown as { id: string }).id,
      descripcion: `Prescripción creada: "${input.medicamento}" para encuentro ${encuentroId}.${result.alertas_alergia.length ? ` ⚠ ${result.alertas_alergia.length} alerta(s) de alergia.` : ''}`,
      datosDespues: result.prescripcion as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, result, 201);
  },

  // UC-HCE-003 — Actualizar prescripción
  async actualizarPrescripcion(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const prescripcionId = (request.params as { id: string }).id;
    const input = request.body as ActualizarPrescripcionInput;

    const datosAntes = await hceService.getPrescripcionPublic(prescripcionId, tenantOrgId);
    const prescripcion = await hceService.actualizarPrescripcion(prescripcionId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'prescripciones',
      recursoId: prescripcionId,
      descripcion: `Prescripción actualizada.`,
      datosAntes: datosAntes as unknown as Record<string, unknown>,
      datosDespues: prescripcion as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { prescripcion });
  },

  // UC-HCE-003 — Eliminar prescripción (soft delete)
  async eliminarPrescripcion(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const prescripcionId = (request.params as { id: string }).id;

    const datosAntes = await hceService.getPrescripcionPublic(prescripcionId, tenantOrgId);
    await hceService.eliminarPrescripcion(prescripcionId, tenantOrgId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'eliminar',
      recurso: 'prescripciones',
      recursoId: prescripcionId,
      descripcion: `Prescripción eliminada: "${(datosAntes as { medicamento: string }).medicamento}".`,
      datosAntes: datosAntes as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { message: 'Prescripción eliminada.' });
  },

  // UC-HCE-003 — Listar prescripciones del encuentro
  async listarPrescripciones(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;

    const items = await hceService.listarPrescripciones(encuentroId, tenantOrgId);

    return sendOk(reply, request.requestId, { items });
  },
};
