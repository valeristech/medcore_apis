import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { hceService } from './encuentro.service.js';
import type { IniciarEncuentroInput, CrearNotaInput, ActualizarNotaInput } from './encuentro.schemas.js';

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

  // UC-HCE-002 — Crear nota clínica
  async crearNota(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;
    const input = request.body as CrearNotaInput;

    const nota = await hceService.crearNota(encuentroId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'nota_clinica',
      recursoId: (nota as unknown as { id: string }).id,
      descripcion: `Nota clínica creada para encuentro ${encuentroId}.`,
      datosDespues: nota as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { nota }, 201);
  },

  // UC-HCE-002 — Actualizar nota clínica (auto-guardado)
  async actualizarNota(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const encuentroId = (request.params as { id: string }).id;
    const input = request.body as ActualizarNotaInput;

    const datosAntes = await hceService.getEncuentroOrFail(encuentroId, tenantOrgId);
    const nota = await hceService.actualizarNota(encuentroId, tenantOrgId, input);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'nota_clinica',
      recursoId: (nota as unknown as { id: string }).id,
      descripcion: `Nota clínica actualizada para encuentro ${encuentroId}.`,
      datosAntes: datosAntes as unknown as Record<string, unknown>,
      datosDespues: nota as unknown as Record<string, unknown>,
    });

    return sendOk(reply, request.requestId, { nota });
  },
};
