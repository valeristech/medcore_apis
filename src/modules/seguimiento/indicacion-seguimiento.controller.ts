import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { indicacionSeguimientoService } from './indicacion-seguimiento.service.js';
import type {
  ActualizarGestionIndicacionInput,
  AgendarCitaIndicacionInput,
  CrearIndicacionSeguimientoInput,
  ListIndicacionesSeguimientoQuery,
} from './indicacion-seguimiento.schemas.js';

type IdParams = { id: string };

export const indicacionSeguimientoController = {
  async crear(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const medicoId = request.user.sub;
    const indicacion = await indicacionSeguimientoService.crear(
      tenantOrgId,
      medicoId,
      request.body as CrearIndicacionSeguimientoInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'indicaciones_seguimiento',
      recursoId: indicacion.id,
      descripcion: `Indicación de seguimiento (${indicacion.tipo}) registrada para el paciente ${indicacion.paciente_id}.`,
      datosDespues: indicacion,
    });

    return sendOk(reply, request.requestId, { indicacion }, 201);
  },

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const result = await indicacionSeguimientoService.listar(
      request.user.organizacion_id,
      request.query as ListIndicacionesSeguimientoQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async actualizarGestion(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const secretariaId = request.user.sub;

    const indicacion = await indicacionSeguimientoService.actualizarGestion(
      id,
      tenantOrgId,
      secretariaId,
      request.body as ActualizarGestionIndicacionInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'indicaciones_seguimiento',
      recursoId: id,
      descripcion: 'Gestión de indicación de seguimiento actualizada.',
      datosDespues: indicacion,
    });

    return sendOk(reply, request.requestId, { indicacion });
  },

  async agendarCita(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const secretariaId = request.user.sub;

    const result = await indicacionSeguimientoService.agendarCita(
      id,
      tenantOrgId,
      secretariaId,
      request.body as AgendarCitaIndicacionInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'citas',
      recursoId: result.cita.id,
      descripcion: `Cita generada desde indicación de seguimiento ${id}.`,
      datosDespues: result.cita,
    });

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'agendar',
      recurso: 'indicaciones_seguimiento',
      recursoId: id,
      descripcion: `Indicación agendada — cita ${result.cita.id}.`,
      datosDespues: result.indicacion,
    });

    return sendOk(reply, request.requestId, result);
  },
};
