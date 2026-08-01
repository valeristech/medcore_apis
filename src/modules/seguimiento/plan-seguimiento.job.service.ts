import { DateTime } from 'luxon';
import type { FastifyBaseLogger } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { EstadoActividadSeguimiento, EstadoIndicacionSeguimiento } from '../../core/enums/seguimiento.enums.js';
import { DIAS_ANTELACION_GENERAR_INDICACION } from './plan-seguimiento.constants.js';

const ACTIVIDAD_GENERACION_INCLUDE = {
  plan_seguimiento: {
    select: {
      id: true,
      nombre: true,
      paciente_id: true,
      medico_id: true,
      organizacion_id: true,
      encuentro_origen_id: true,
      deleted: true,
    },
  },
} as const;

type ActividadGeneracionRow = Prisma.plan_seguimiento_actividadGetPayload<{
  include: typeof ACTIVIDAD_GENERACION_INCLUDE;
}>;

export type PlanSeguimientoJobResult = {
  ejecutado_en: string;
  actividades_evaluadas: number;
  indicaciones_generadas: number;
  omitidas: number;
  fallidas: number;
  actividades_vencidas_marcadas: number;
  detalle: Array<{
    actividad_id: string;
    plan_id: string;
    accion: 'indicacion_generada' | 'omitida' | 'error';
    error?: string;
  }>;
};

export class PlanSeguimientoJobService {
  constructor(private readonly log: FastifyBaseLogger) {}

  async ejecutar(organizacionId?: string): Promise<PlanSeguimientoJobResult> {
    const now = DateTime.utc();
    const result: PlanSeguimientoJobResult = {
      ejecutado_en: now.toISO() ?? new Date().toISOString(),
      actividades_evaluadas: 0,
      indicaciones_generadas: 0,
      omitidas: 0,
      fallidas: 0,
      actividades_vencidas_marcadas: 0,
      detalle: [],
    };

    await this.generarIndicacionesAutomaticas(organizacionId, result);
    result.actividades_vencidas_marcadas = await this.marcarActividadesVencidas(organizacionId);

    return result;
  }

  private async generarIndicacionesAutomaticas(
    organizacionId: string | undefined,
    result: PlanSeguimientoJobResult,
  ) {
    const hoy = DateTime.utc().startOf('day').toJSDate();
    const limiteVentana = DateTime.utc()
      .startOf('day')
      .plus({ days: DIAS_ANTELACION_GENERAR_INDICACION })
      .toJSDate();

    const actividades = await prisma.plan_seguimiento_actividad.findMany({
      where: {
        deleted: false,
        estado: EstadoActividadSeguimiento.Pendiente,
        fecha_programada: { not: null, gte: hoy, lte: limiteVentana },
        plan_seguimiento: {
          deleted: false,
          estado: 'activo',
          ...(organizacionId ? { organizacion_id: organizacionId } : {}),
        },
      },
      include: ACTIVIDAD_GENERACION_INCLUDE,
    });

    for (const actividad of actividades) {
      result.actividades_evaluadas += 1;
      try {
        await this.generarIndicacionParaActividad(actividad, result);
      } catch (err) {
        result.fallidas += 1;
        const message = err instanceof Error ? err.message : 'Error desconocido';
        result.detalle.push({
          actividad_id: actividad.id,
          plan_id: actividad.plan_id,
          accion: 'error',
          error: message,
        });
        this.log.error({ err, actividad_id: actividad.id }, 'Error generando indicación automática');
      }
    }
  }

  private async generarIndicacionParaActividad(
    actividad: ActividadGeneracionRow,
    result: PlanSeguimientoJobResult,
  ) {
    const plan = actividad.plan_seguimiento;
    const encuentroId = actividad.encuentro_id ?? plan.encuentro_origen_id;

    if (!encuentroId) {
      result.omitidas += 1;
      result.detalle.push({
        actividad_id: actividad.id,
        plan_id: plan.id,
        accion: 'omitida',
        error: 'Sin encuentro_id (ni en la actividad ni en el plan de origen); indicacion_seguimiento lo requiere.',
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const indicacion = await tx.indicacion_seguimiento.create({
        data: {
          encuentro_id: encuentroId,
          paciente_id: plan.paciente_id,
          medico_id: plan.medico_id,
          organizacion_id: plan.organizacion_id,
          plan_id: plan.id,
          tipo: actividad.tipo,
          descripcion: `${plan.nombre}: ${actividad.descripcion}`,
          fecha_sugerida: actividad.fecha_programada,
          notas_medico: actividad.instrucciones_paciente ?? null,
          prioridad: 'normal',
          estado: EstadoIndicacionSeguimiento.Pendiente,
          deleted: false,
        },
        select: { id: true },
      });

      await tx.plan_seguimiento_actividad.update({
        where: { id: actividad.id },
        data: {
          estado: EstadoActividadSeguimiento.IndicacionCreada,
          indicacion_id: indicacion.id,
          updated_at: new Date(),
        },
      });
    });

    result.indicaciones_generadas += 1;
    result.detalle.push({ actividad_id: actividad.id, plan_id: plan.id, accion: 'indicacion_generada' });
  }

  private async marcarActividadesVencidas(organizacionId: string | undefined): Promise<number> {
    const hoy = DateTime.utc().startOf('day').toJSDate();

    const { count } = await prisma.plan_seguimiento_actividad.updateMany({
      where: {
        deleted: false,
        estado: { in: [EstadoActividadSeguimiento.Pendiente, EstadoActividadSeguimiento.IndicacionCreada] },
        OR: [
          { fecha_limite: { lt: hoy } },
          { fecha_limite: null, fecha_programada: { lt: hoy } },
        ],
        plan_seguimiento: {
          deleted: false,
          estado: 'activo',
          ...(organizacionId ? { organizacion_id: organizacionId } : {}),
        },
      },
      data: { estado: EstadoActividadSeguimiento.Vencida, updated_at: new Date() },
    });

    return count;
  }
}

export function createPlanSeguimientoJobService(log: FastifyBaseLogger) {
  return new PlanSeguimientoJobService(log);
}
