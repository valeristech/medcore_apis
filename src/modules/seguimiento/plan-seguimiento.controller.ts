import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { planSeguimientoService } from './plan-seguimiento.service.js';
import type {
  ActualizarActividadInput,
  CambiarEstadoPlanInput,
  CrearActividadInput,
  CrearPlanSeguimientoInput,
  ListActividadesQuery,
  ListPlanesSeguimientoQuery,
} from './plan-seguimiento.schemas.js';

type IdParams = { id: string };

export const planSeguimientoController = {
  async crearPlan(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const medicoId = request.user.sub;
    const plan = await planSeguimientoService.crearPlan(
      tenantOrgId,
      medicoId,
      request.body as CrearPlanSeguimientoInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'planes_seguimiento',
      recursoId: plan.id,
      descripcion: `Plan de seguimiento "${plan.nombre}" abierto en borrador.`,
      datosDespues: plan,
    });

    return sendOk(reply, request.requestId, { plan }, 201);
  },

  async listarPlanes(request: FastifyRequest, reply: FastifyReply) {
    const result = await planSeguimientoService.listarPlanes(
      request.user.organizacion_id,
      request.query as ListPlanesSeguimientoQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async obtenerPlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const plan = await planSeguimientoService.obtenerPlan(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { plan });
  },

  async cambiarEstadoPlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const actorId = request.user.sub;

    const plan = await planSeguimientoService.cambiarEstadoPlan(
      id,
      tenantOrgId,
      actorId,
      request.body as CambiarEstadoPlanInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'planes_seguimiento',
      recursoId: id,
      descripcion: `Plan de seguimiento pasó a estado "${plan.estado}".`,
      datosDespues: plan,
    });

    return sendOk(reply, request.requestId, { plan });
  },

  async crearActividad(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const actorId = request.user.sub;

    const actividad = await planSeguimientoService.crearActividad(
      id,
      tenantOrgId,
      actorId,
      request.body as CrearActividadInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'crear',
      recurso: 'plan_seguimiento_actividad',
      recursoId: actividad.id,
      descripcion: `Actividad agregada al plan ${id}.`,
      datosDespues: actividad,
    });

    return sendOk(reply, request.requestId, { actividad }, 201);
  },

  async listarActividades(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const result = await planSeguimientoService.listarActividades(
      id,
      request.user.organizacion_id,
      request.query as ListActividadesQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async actualizarActividad(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;
    const actorId = request.user.sub;

    const actividad = await planSeguimientoService.actualizarActividad(
      id,
      tenantOrgId,
      actorId,
      request.body as ActualizarActividadInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'actualizar',
      recurso: 'plan_seguimiento_actividad',
      recursoId: id,
      descripcion: 'Actividad de plan de seguimiento actualizada.',
      datosDespues: actividad,
    });

    return sendOk(reply, request.requestId, { actividad });
  },

  async eliminarActividad(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const tenantOrgId = request.user.organizacion_id;

    await planSeguimientoService.eliminarActividad(id, tenantOrgId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: 'eliminar',
      recurso: 'plan_seguimiento_actividad',
      recursoId: id,
      descripcion: 'Actividad de plan de seguimiento eliminada (soft delete).',
      datosDespues: { deleted: true },
    });

    return sendOk(reply, request.requestId, { ok: true });
  },
};
