import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoActividadSeguimiento, EstadoPlanSeguimiento } from '../../core/enums/seguimiento.enums.js';
import {
  ESTADOS_ACTIVIDAD_GESTIONABLES,
  ESTADOS_PLAN_TERMINALES,
  TRANSICIONES_PLAN_VALIDAS,
} from './plan-seguimiento.constants.js';
import { hceService } from '../encuentros/encuentro.service.js';
import type {
  ActualizarActividadInput,
  CambiarEstadoPlanInput,
  CrearActividadInput,
  CrearPlanSeguimientoInput,
  ListActividadesQuery,
  ListPlanesSeguimientoQuery,
} from './plan-seguimiento.schemas.js';

const PLAN_INCLUDE = {
  paciente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  usuario_plan_seguimiento_medico_idTousuario: {
    select: { id: true, nombre: true, apellido: true, especialidad: true },
  },
} as const;

const PLAN_INCLUDE_CON_ACTIVIDADES = {
  ...PLAN_INCLUDE,
  plan_seguimiento_actividad: {
    where: { deleted: false },
    orderBy: { numero_orden: 'asc' as const },
  },
} as const;

type PlanPayload = Prisma.plan_seguimientoGetPayload<{ include: typeof PLAN_INCLUDE }>;
type PlanConActividadesPayload = Prisma.plan_seguimientoGetPayload<{
  include: typeof PLAN_INCLUDE_CON_ACTIVIDADES;
}>;
type ActividadRow = Prisma.plan_seguimiento_actividadGetPayload<Record<string, never>>;

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseFechaOnly(value: string | undefined, campo: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Fecha inválida en "${campo}".`);
  }
  return parsed;
}

function parseFechaOnlyNullable(
  value: string | null | undefined,
  campo: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseFechaOnly(value, campo);
}

function mapActividad(row: ActividadRow) {
  const serialized = serializeDates(row);
  return {
    ...serialized,
    fecha_programada: toDateOnly(row.fecha_programada),
    fecha_limite: toDateOnly(row.fecha_limite),
    fecha_gestion: row.fecha_gestion?.toISOString() ?? null,
  };
}

function mapPlan(row: PlanPayload | PlanConActividadesPayload) {
  const { usuario_plan_seguimiento_medico_idTousuario: medico, ...rest } = row;
  const actividades = 'plan_seguimiento_actividad' in row ? row.plan_seguimiento_actividad : undefined;

  const serialized = serializeDates(rest);

  return {
    ...serialized,
    fecha_inicio: toDateOnly(rest.fecha_inicio),
    fecha_fin_estimada: toDateOnly(rest.fecha_fin_estimada),
    fecha_completado: rest.fecha_completado?.toISOString() ?? null,
    medico,
    ...(actividades !== undefined ? { actividades: actividades.map(mapActividad) } : {}),
  };
}

export class PlanSeguimientoService {
  // ─── Guards privados ────────────────────────────────────────────────────────

  private async assertPacienteTenant(pacienteId: string, tenantOrgId: string) {
    const rel = await prisma.paciente_organizacion.findFirst({
      where: {
        paciente_id: pacienteId,
        organizacion_id: tenantOrgId,
        activo: true,
        paciente: { deleted: false },
      },
      select: { paciente_id: true },
    });
    if (!rel) {
      throw new HttpError(404, 'PACIENTE_INVALIDO', 'Paciente no encontrado en la organización.');
    }
  }

  private async getPlanTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.plan_seguimiento.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: PLAN_INCLUDE,
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Plan de seguimiento no encontrado.');
    return row;
  }

  private async getPlanConActividadesTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.plan_seguimiento.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: PLAN_INCLUDE_CON_ACTIVIDADES,
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Plan de seguimiento no encontrado.');
    return row;
  }

  private async getActividadTenantOr404(actividadId: string, tenantOrgId: string) {
    const row = await prisma.plan_seguimiento_actividad.findFirst({
      where: {
        id: actividadId,
        deleted: false,
        plan_seguimiento: { organizacion_id: tenantOrgId, deleted: false },
      },
      include: { plan_seguimiento: { select: { id: true, estado: true } } },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Actividad no encontrada.');
    return row;
  }

  private assertPlanNoTerminal(estado: string): void {
    if ((ESTADOS_PLAN_TERMINALES as readonly string[]).includes(estado)) {
      throw new HttpError(
        409,
        'PLAN_TERMINAL',
        `El plan está en estado "${estado}" y no admite más cambios.`,
      );
    }
  }

  // ─── Plan ───────────────────────────────────────────────────────────────────

  async crearPlan(tenantOrgId: string, medicoId: string, input: CrearPlanSeguimientoInput) {
    await this.assertPacienteTenant(input.paciente_id, tenantOrgId);

    if (input.encuentro_origen_id) {
      const encuentro = await hceService.getEncuentroOrFail(input.encuentro_origen_id, tenantOrgId);
      if (encuentro.usuario_id !== medicoId) {
        throw new HttpError(
          403,
          'FORBIDDEN',
          'Solo el médico dueño del encuentro puede abrir el plan desde esa consulta.',
        );
      }
      if (encuentro.paciente_id !== input.paciente_id) {
        throw new HttpError(
          409,
          'ENCUENTRO_PACIENTE_INVALIDO',
          'El paciente no corresponde al encuentro indicado.',
        );
      }
    }

    const fechaInicio = parseFechaOnly(input.fecha_inicio, 'fecha_inicio');
    const fechaFin = parseFechaOnly(input.fecha_fin_estimada, 'fecha_fin_estimada');
    if (fechaInicio && fechaFin && fechaInicio.getTime() > fechaFin.getTime()) {
      throw new HttpError(400, 'VALIDATION_ERROR', '"fecha_inicio" no puede ser posterior a "fecha_fin_estimada".');
    }

    const created = await prisma.plan_seguimiento.create({
      data: {
        paciente_id: input.paciente_id,
        organizacion_id: tenantOrgId,
        medico_id: medicoId,
        encuentro_origen_id: input.encuentro_origen_id ?? null,
        nombre: input.nombre.trim(),
        indicacion_medico: cleanStr(input.indicacion_medico) ?? null,
        diagnostico_asociado: cleanStr(input.diagnostico_asociado) ?? null,
        codigo_icd10: cleanStr(input.codigo_icd10) ?? null,
        frecuencia_dias: input.frecuencia_dias ?? null,
        descripcion: cleanStr(input.descripcion) ?? null,
        ...(fechaInicio ? { fecha_inicio: fechaInicio } : {}),
        fecha_fin_estimada: fechaFin ?? null,
        estado: EstadoPlanSeguimiento.Borrador,
        deleted: false,
      },
      include: PLAN_INCLUDE,
    });

    return mapPlan(created);
  }

  async listarPlanes(tenantOrgId: string, query: ListPlanesSeguimientoQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.plan_seguimientoWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.paciente_id ? { paciente_id: query.paciente_id } : {}),
      ...(query.medico_id ? { medico_id: query.medico_id } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.plan_seguimiento.count({ where }),
      prisma.plan_seguimiento.findMany({
        where,
        include: PLAN_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapPlan),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      sort: { sortBy, sortOrder },
    };
  }

  async obtenerPlan(id: string, tenantOrgId: string) {
    const row = await this.getPlanConActividadesTenantOr404(id, tenantOrgId);
    return mapPlan(row);
  }

  async cambiarEstadoPlan(
    id: string,
    tenantOrgId: string,
    actorId: string,
    input: CambiarEstadoPlanInput,
  ) {
    const current = await this.getPlanTenantOr404(id, tenantOrgId);
    this.assertPlanNoTerminal(current.estado);

    const permitidos = TRANSICIONES_PLAN_VALIDAS[current.estado] ?? [];
    if (!(permitidos as readonly string[]).includes(input.estado)) {
      throw new HttpError(
        409,
        'TRANSICION_INVALIDA',
        `No se puede pasar de "${current.estado}" a "${input.estado}". Permitidos: ${
          permitidos.length ? permitidos.join(', ') : 'ninguno (estado terminal)'
        }.`,
      );
    }

    if (input.estado === EstadoPlanSeguimiento.Activo) {
      const actividadesCount = await prisma.plan_seguimiento_actividad.count({
        where: { plan_id: id, deleted: false },
      });
      if (actividadesCount === 0) {
        throw new HttpError(
          400,
          'PLAN_SIN_ACTIVIDADES',
          'No se puede activar un plan sin actividades. Agregue al menos una con POST /:id/actividades.',
        );
      }
    }

    const motivoCierre = cleanStr(input.motivo_cierre);
    if (input.estado === EstadoPlanSeguimiento.Cancelado && !motivoCierre) {
      throw new HttpError(400, 'MOTIVO_REQUERIDO', 'El motivo de cierre es obligatorio para cancelar el plan.');
    }

    const data: Prisma.plan_seguimientoUncheckedUpdateInput = {
      estado: input.estado,
      updated_at: new Date(),
    };

    // No hay columna dedicada para "cancelado_por/fecha_cancelacion"; se reutilizan
    // completado_por/fecha_completado para registrar quién cerró el plan y cuándo,
    // sea por completado o por cancelado.
    if (
      input.estado === EstadoPlanSeguimiento.Completado ||
      input.estado === EstadoPlanSeguimiento.Cancelado
    ) {
      data.completado_por = actorId;
      data.fecha_completado = new Date();
    }
    if (input.estado === EstadoPlanSeguimiento.Cancelado) {
      data.motivo_cierre = motivoCierre;
    }

    const updated = await prisma.plan_seguimiento.update({
      where: { id },
      data,
      include: PLAN_INCLUDE,
    });

    return mapPlan(updated);
  }

  // ─── Actividades ────────────────────────────────────────────────────────────

  async crearActividad(
    planId: string,
    tenantOrgId: string,
    actorId: string,
    input: CrearActividadInput,
  ) {
    const plan = await this.getPlanTenantOr404(planId, tenantOrgId);
    this.assertPlanNoTerminal(plan.estado);

    const fechaProgramada = parseFechaOnly(input.fecha_programada, 'fecha_programada');
    const fechaLimite = parseFechaOnly(input.fecha_limite, 'fecha_limite');
    if (fechaProgramada && fechaLimite && fechaProgramada.getTime() > fechaLimite.getTime()) {
      throw new HttpError(400, 'VALIDATION_ERROR', '"fecha_programada" no puede ser posterior a "fecha_limite".');
    }

    let numeroOrden = input.numero_orden;
    if (numeroOrden === undefined) {
      const max = await prisma.plan_seguimiento_actividad.aggregate({
        where: { plan_id: planId, deleted: false },
        _max: { numero_orden: true },
      });
      numeroOrden = (max._max.numero_orden ?? 0) + 1;
    }

    const created = await prisma.plan_seguimiento_actividad.create({
      data: {
        plan_id: planId,
        numero_orden: numeroOrden,
        tipo: input.tipo,
        descripcion: input.descripcion.trim(),
        fecha_programada: fechaProgramada ?? null,
        fecha_limite: fechaLimite ?? null,
        dias_desde_inicio: input.dias_desde_inicio ?? null,
        instrucciones_paciente: cleanStr(input.instrucciones_paciente) ?? null,
        requiere_preparacion: input.requiere_preparacion ?? false,
        detalle_preparacion: cleanStr(input.detalle_preparacion) ?? null,
        creada_por: actorId,
        estado: EstadoActividadSeguimiento.Pendiente,
        deleted: false,
      },
    });

    return mapActividad(created);
  }

  async listarActividades(planId: string, tenantOrgId: string, query: ListActividadesQuery) {
    await this.getPlanTenantOr404(planId, tenantOrgId);

    const rows = await prisma.plan_seguimiento_actividad.findMany({
      where: {
        plan_id: planId,
        deleted: false,
        ...(query.estado ? { estado: query.estado } : {}),
      },
      orderBy: { numero_orden: 'asc' },
    });

    return { items: rows.map(mapActividad) };
  }

  async actualizarActividad(
    actividadId: string,
    tenantOrgId: string,
    actorId: string,
    input: ActualizarActividadInput,
  ) {
    const current = await this.getActividadTenantOr404(actividadId, tenantOrgId);
    this.assertPlanNoTerminal(current.plan_seguimiento.estado);

    if (
      input.estado !== undefined &&
      !(ESTADOS_ACTIVIDAD_GESTIONABLES as readonly string[]).includes(input.estado)
    ) {
      throw new HttpError(
        400,
        'ESTADO_NO_PERMITIDO',
        `estado debe ser uno de: ${ESTADOS_ACTIVIDAD_GESTIONABLES.join(', ')}.`,
      );
    }

    const fechaProgramada = parseFechaOnlyNullable(input.fecha_programada, 'fecha_programada');
    const fechaLimite = parseFechaOnlyNullable(input.fecha_limite, 'fecha_limite');

    const data: Prisma.plan_seguimiento_actividadUncheckedUpdateInput = { updated_at: new Date() };

    if (input.tipo !== undefined) data.tipo = input.tipo;
    if (input.descripcion !== undefined) data.descripcion = input.descripcion.trim();
    if (fechaProgramada !== undefined) data.fecha_programada = fechaProgramada;
    if (fechaLimite !== undefined) data.fecha_limite = fechaLimite;
    if (input.dias_desde_inicio !== undefined) data.dias_desde_inicio = input.dias_desde_inicio;
    if (input.instrucciones_paciente !== undefined) {
      data.instrucciones_paciente = cleanStr(input.instrucciones_paciente ?? undefined) ?? null;
    }
    if (input.requiere_preparacion !== undefined) data.requiere_preparacion = input.requiere_preparacion;
    if (input.detalle_preparacion !== undefined) {
      data.detalle_preparacion = cleanStr(input.detalle_preparacion ?? undefined) ?? null;
    }
    if (input.numero_orden !== undefined) data.numero_orden = input.numero_orden;

    const tocaGestion =
      input.estado !== undefined || input.resultado_resumen !== undefined || input.notas !== undefined;

    if (input.estado !== undefined) data.estado = input.estado;
    if (input.resultado_resumen !== undefined) data.resultado_resumen = cleanStr(input.resultado_resumen) ?? null;
    if (input.notas !== undefined) data.notas = cleanStr(input.notas) ?? null;
    if (tocaGestion) {
      data.gestionada_por = actorId;
      data.fecha_gestion = new Date();
    }

    const updated = await prisma.plan_seguimiento_actividad.update({
      where: { id: actividadId },
      data,
    });

    return mapActividad(updated);
  }

  async eliminarActividad(actividadId: string, tenantOrgId: string) {
    const current = await this.getActividadTenantOr404(actividadId, tenantOrgId);
    this.assertPlanNoTerminal(current.plan_seguimiento.estado);

    if (current.estado === EstadoActividadSeguimiento.Completada) {
      throw new HttpError(409, 'ACTIVIDAD_COMPLETADA', 'No se puede eliminar una actividad ya completada.');
    }

    await prisma.plan_seguimiento_actividad.update({
      where: { id: actividadId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const planSeguimientoService = new PlanSeguimientoService();
