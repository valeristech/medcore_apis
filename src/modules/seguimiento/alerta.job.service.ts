import { DateTime } from 'luxon';
import type { FastifyBaseLogger } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { EstadoAlerta, TipoAlerta } from '../../core/enums/seguimiento.enums.js';
import { Prioridad } from '../../core/enums/comun.enums.js';
import { ESTADOS_BANDEJA_DEFAULT } from './indicacion-seguimiento.constants.js';
import { UMBRAL_INTENTOS_SIN_CONTACTO } from './alerta.constants.js';

export type AlertaJobResult = {
  ejecutado_en: string;
  evaluadas: number;
  alertas_generadas: number;
  /** Se omite cuando ya existe una alerta (no eliminada) vinculada al mismo origen + tipo. */
  omitidas: number;
  fallidas: number;
  detalle: Array<{
    origen_id: string;
    tipo: string;
    accion: 'generada' | 'omitida' | 'error';
    error?: string;
  }>;
};

type NuevaAlerta = {
  organizacion_id: string;
  paciente_id: string;
  plan_id?: string | null;
  actividad_id?: string | null;
  indicacion_id?: string | null;
  tipo: string;
  titulo: string;
  descripcion?: string | null;
  prioridad?: string | null;
};

const INDICACION_ACTIVA_SELECT = {
  id: true,
  organizacion_id: true,
  paciente_id: true,
  descripcion: true,
  prioridad: true,
  estado: true,
  fecha_sugerida: true,
  rango_fecha_fin: true,
  dias_para_cita: true,
  intentos_contacto: true,
  created_at: true,
} as const;

type IndicacionActivaRow = Prisma.indicacion_seguimientoGetPayload<{ select: typeof INDICACION_ACTIVA_SELECT }>;

const ACTIVIDAD_VENCIDA_INCLUDE = {
  plan_seguimiento: {
    select: { id: true, nombre: true, paciente_id: true, organizacion_id: true, deleted: true, estado: true },
  },
} as const;

const PLAN_ACTIVO_INCLUDE = {
  plan_seguimiento_actividad: { where: { deleted: false }, select: { id: true, estado: true } },
} as const;

export class AlertaJobService {
  constructor(private readonly log: FastifyBaseLogger) {}

  async ejecutar(organizacionId?: string): Promise<AlertaJobResult> {
    const now = DateTime.utc();
    const result: AlertaJobResult = {
      ejecutado_en: now.toISO() ?? new Date().toISOString(),
      evaluadas: 0,
      alertas_generadas: 0,
      omitidas: 0,
      fallidas: 0,
      detalle: [],
    };

    await this.generarDesdeIndicaciones(organizacionId, result);
    await this.generarActividadPendiente(organizacionId, result);
    await this.generarPlanAbandonado(organizacionId, result);

    return result;
  }

  // ─── control_vencido + paciente_sin_contacto ───────────────────────────────

  private async generarDesdeIndicaciones(organizacionId: string | undefined, result: AlertaJobResult) {
    const hoy = DateTime.utc().startOf('day').toJSDate();

    const indicaciones = await prisma.indicacion_seguimiento.findMany({
      where: {
        deleted: false,
        estado: { in: [...ESTADOS_BANDEJA_DEFAULT] },
        ...(organizacionId ? { organizacion_id: organizacionId } : {}),
      },
      select: INDICACION_ACTIVA_SELECT,
    });

    for (const indicacion of indicaciones) {
      result.evaluadas += 1;

      if (this.plazoVencido(indicacion, hoy)) {
        await this.crearAlertaSiNoExiste(
          {
            origenCampo: 'indicacion_id',
            origenId: indicacion.id,
            tipo: TipoAlerta.ControlVencido,
          },
          {
            organizacion_id: indicacion.organizacion_id,
            paciente_id: indicacion.paciente_id,
            indicacion_id: indicacion.id,
            tipo: TipoAlerta.ControlVencido,
            titulo: 'Control de seguimiento vencido',
            descripcion: `El plazo de la indicación "${indicacion.descripcion}" ya venció sin agendarse.`,
            prioridad: indicacion.prioridad,
          },
          result,
        );
      }

      if (
        indicacion.estado === 'no_contactado' &&
        (indicacion.intentos_contacto ?? 0) >= UMBRAL_INTENTOS_SIN_CONTACTO
      ) {
        await this.crearAlertaSiNoExiste(
          {
            origenCampo: 'indicacion_id',
            origenId: indicacion.id,
            tipo: TipoAlerta.PacienteSinContacto,
          },
          {
            organizacion_id: indicacion.organizacion_id,
            paciente_id: indicacion.paciente_id,
            indicacion_id: indicacion.id,
            tipo: TipoAlerta.PacienteSinContacto,
            titulo: 'Paciente sin contacto',
            descripcion:
              `${indicacion.intentos_contacto} intentos de contacto sin éxito para la indicación ` +
              `"${indicacion.descripcion}".`,
            prioridad: indicacion.prioridad ?? Prioridad.Alta,
          },
          result,
        );
      }
    }
  }

  private plazoVencido(indicacion: IndicacionActivaRow, hoy: Date): boolean {
    if (indicacion.fecha_sugerida && indicacion.fecha_sugerida.getTime() < hoy.getTime()) return true;
    if (indicacion.rango_fecha_fin && indicacion.rango_fecha_fin.getTime() < hoy.getTime()) return true;
    if (indicacion.dias_para_cita != null && indicacion.created_at) {
      const limite = DateTime.fromJSDate(indicacion.created_at)
        .plus({ days: indicacion.dias_para_cita })
        .toJSDate();
      if (limite.getTime() < hoy.getTime()) return true;
    }
    return false;
  }

  // ─── actividad_pendiente ────────────────────────────────────────────────────

  private async generarActividadPendiente(organizacionId: string | undefined, result: AlertaJobResult) {
    const actividades = await prisma.plan_seguimiento_actividad.findMany({
      where: {
        deleted: false,
        estado: 'vencida',
        plan_seguimiento: {
          deleted: false,
          estado: 'activo',
          ...(organizacionId ? { organizacion_id: organizacionId } : {}),
        },
      },
      include: ACTIVIDAD_VENCIDA_INCLUDE,
    });

    for (const actividad of actividades) {
      result.evaluadas += 1;
      const plan = actividad.plan_seguimiento;

      await this.crearAlertaSiNoExiste(
        { origenCampo: 'actividad_id', origenId: actividad.id, tipo: TipoAlerta.ActividadPendiente },
        {
          organizacion_id: plan.organizacion_id,
          paciente_id: plan.paciente_id,
          plan_id: plan.id,
          actividad_id: actividad.id,
          tipo: TipoAlerta.ActividadPendiente,
          titulo: `Actividad vencida — ${plan.nombre}`,
          descripcion: `La actividad "${actividad.descripcion}" del plan "${plan.nombre}" está vencida.`,
          prioridad: Prioridad.Alta,
        },
        result,
      );
    }
  }

  // ─── plan_abandonado ────────────────────────────────────────────────────────

  private async generarPlanAbandonado(organizacionId: string | undefined, result: AlertaJobResult) {
    const planes = await prisma.plan_seguimiento.findMany({
      where: {
        deleted: false,
        estado: 'activo',
        ...(organizacionId ? { organizacion_id: organizacionId } : {}),
      },
      include: PLAN_ACTIVO_INCLUDE,
    });

    for (const plan of planes) {
      result.evaluadas += 1;
      const actividades = plan.plan_seguimiento_actividad;
      const abandonado = actividades.length > 0 && actividades.every((a) => a.estado === 'vencida');
      if (!abandonado) continue;

      await this.crearAlertaSiNoExiste(
        { origenCampo: 'plan_id', origenId: plan.id, tipo: TipoAlerta.PlanAbandonado },
        {
          organizacion_id: plan.organizacion_id,
          paciente_id: plan.paciente_id,
          plan_id: plan.id,
          tipo: TipoAlerta.PlanAbandonado,
          titulo: `Plan de seguimiento abandonado — ${plan.nombre}`,
          descripcion: `Todas las actividades del plan "${plan.nombre}" están vencidas.`,
          prioridad: Prioridad.Alta,
        },
        result,
      );
    }
  }

  // ─── helper compartido: crear con idempotencia + contadores ────────────────

  private async crearAlertaSiNoExiste(
    origen: { origenCampo: 'indicacion_id' | 'actividad_id' | 'plan_id'; origenId: string; tipo: string },
    data: NuevaAlerta,
    result: AlertaJobResult,
  ) {
    try {
      const existente = await prisma.alerta_preventiva.findFirst({
        where: { [origen.origenCampo]: origen.origenId, tipo: origen.tipo, deleted: false },
        select: { id: true },
      });

      if (existente) {
        result.omitidas += 1;
        result.detalle.push({ origen_id: origen.origenId, tipo: origen.tipo, accion: 'omitida' });
        return;
      }

      await prisma.alerta_preventiva.create({
        data: {
          organizacion_id: data.organizacion_id,
          paciente_id: data.paciente_id,
          plan_id: data.plan_id ?? null,
          actividad_id: data.actividad_id ?? null,
          indicacion_id: data.indicacion_id ?? null,
          tipo: data.tipo,
          titulo: data.titulo,
          descripcion: data.descripcion ?? null,
          prioridad: data.prioridad ?? Prioridad.Normal,
          estado: EstadoAlerta.Activa,
          visible_para: 'ambos',
          deleted: false,
        },
      });

      result.alertas_generadas += 1;
      result.detalle.push({ origen_id: origen.origenId, tipo: origen.tipo, accion: 'generada' });
    } catch (err) {
      result.fallidas += 1;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      result.detalle.push({ origen_id: origen.origenId, tipo: origen.tipo, accion: 'error', error: message });
      this.log.error({ err, origen_id: origen.origenId, tipo: origen.tipo }, 'Error generando alerta preventiva');
    }
  }
}

export function createAlertaJobService(log: FastifyBaseLogger) {
  return new AlertaJobService(log);
}
