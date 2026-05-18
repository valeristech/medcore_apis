import { DateTime } from 'luxon';
import type { FastifyBaseLogger } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import type { AppEnv } from '../../core/env.js';
import {
  CITA_ESTADOS_RECORDATORIO,
  RECORDATORIO_CANALES,
  RECORDATORIO_ESTADO_ENVIADO,
  RECORDATORIO_ESTADO_FALLIDO,
  type RecordatorioCanal,
} from './recordatorio.constants.js';
import { createRecordatorioProviders, type RecordatorioProvider } from './recordatorio.providers.js';
import { buildRecordatorioVars, renderRecordatorioTexto } from './recordatorio.template.js';
import type { plantilla_recordatorio } from '@prisma/client';

const CITA_JOB_INCLUDE = {
  paciente: { select: { nombre: true, apellido: true, email: true, telefono: true, telefono_secundario: true } },
  usuario: { select: { nombre: true, apellido: true } },
  sede: {
    select: {
      nombre: true,
      organizacion_id: true,
      organizacion: { select: { zona_horaria: true } },
    },
  },
  tipo_cita: { select: { nombre: true } },
  recordatorio_envios: { select: { plantilla_recordatorio_id: true } },
} as const;

type CitaJobRow = Prisma.citaGetPayload<{ include: typeof CITA_JOB_INCLUDE }>;

export type RecordatorioJobResult = {
  ejecutado_en: string;
  plantillas_evaluadas: number;
  citas_evaluadas: number;
  enviados: number;
  fallidos: number;
  omitidos: number;
  detalle: Array<{
    cita_id: string;
    plantilla_id: string;
    canal: string;
    estado: string;
    error?: string;
  }>;
};

function assertCanal(canal: string): RecordatorioCanal {
  if (!(RECORDATORIO_CANALES as readonly string[]).includes(canal)) {
    throw new Error(`Canal de recordatorio no soportado: ${canal}`);
  }
  return canal as RecordatorioCanal;
}

function resolveDestino(cita: CitaJobRow, canal: RecordatorioCanal): string | null {
  if (canal === 'email') {
    return cita.paciente.email?.trim() || null;
  }
  return cita.paciente.telefono?.trim() || cita.paciente.telefono_secundario?.trim() || null;
}

function reminderWindowUtc(horasAntes: number, now = DateTime.utc()) {
  const windowEnd = now.plus({ hours: horasAntes });
  const windowStart = now.plus({ hours: horasAntes - 1 });
  return {
    windowStart: windowStart.toJSDate(),
    windowEnd: windowEnd.toJSDate(),
  };
}

export class RecordatorioJobService {
  constructor(
    private readonly env: AppEnv,
    private readonly log: FastifyBaseLogger,
  ) {}

  async ejecutar(organizacionId?: string): Promise<RecordatorioJobResult> {
    const providers = createRecordatorioProviders(this.env, this.log);
    const now = DateTime.utc();
    const result: RecordatorioJobResult = {
      ejecutado_en: now.toISO() ?? new Date().toISOString(),
      plantillas_evaluadas: 0,
      citas_evaluadas: 0,
      enviados: 0,
      fallidos: 0,
      omitidos: 0,
      detalle: [],
    };

    const plantillas = await prisma.plantilla_recordatorio.findMany({
      where: {
        deleted: false,
        activo: true,
        ...(organizacionId ? { organizacion_id: organizacionId } : {}),
      },
    });

    for (const plantilla of plantillas) {
      result.plantillas_evaluadas += 1;
      try {
        await this.procesarPlantilla(plantilla, providers, result);
      } catch (err) {
        this.log.error({ err, plantilla_id: plantilla.id }, 'Error procesando plantilla de recordatorio');
      }
    }

    return result;
  }

  private async procesarPlantilla(
    plantilla: plantilla_recordatorio,
    providers: Record<RecordatorioCanal, RecordatorioProvider>,
    result: RecordatorioJobResult,
  ) {
    if (plantilla.horas_antes < 1) return;

    const { windowStart, windowEnd } = reminderWindowUtc(plantilla.horas_antes);
    const canal = assertCanal(plantilla.canal);

    const citas = await prisma.cita.findMany({
      where: {
        deleted: false,
        estado: { in: [...CITA_ESTADOS_RECORDATORIO] },
        fecha_hora_inicio: { gte: windowStart, lt: windowEnd },
        sede: { organizacion_id: plantilla.organizacion_id, deleted: false },
        recordatorio_envios: { none: { plantilla_recordatorio_id: plantilla.id } },
      },
      include: CITA_JOB_INCLUDE,
    });

    for (const cita of citas) {
      result.citas_evaluadas += 1;
      const destino = resolveDestino(cita, canal);

      if (!destino) {
        result.omitidos += 1;
        await this.registrarEnvio({
          citaId: cita.id,
          plantillaId: plantilla.id,
          canal,
          destino: null,
          estado: RECORDATORIO_ESTADO_FALLIDO,
          error: `Paciente sin contacto para canal ${canal}.`,
        });
        result.detalle.push({
          cita_id: cita.id,
          plantilla_id: plantilla.id,
          canal,
          estado: RECORDATORIO_ESTADO_FALLIDO,
          error: 'Sin destino de contacto',
        });
        continue;
      }

      const vars = buildRecordatorioVars({
        paciente: cita.paciente,
        usuario: cita.usuario,
        sede: cita.sede,
        tipo_cita: cita.tipo_cita,
        fecha_hora_inicio: cita.fecha_hora_inicio,
        zona_horaria: cita.sede.organizacion.zona_horaria,
      });
      const cuerpo = renderRecordatorioTexto(plantilla.texto, vars);
      const asunto = plantilla.asunto ? renderRecordatorioTexto(plantilla.asunto, vars) : null;

      try {
        await providers[canal].send({
          canal,
          destino,
          asunto,
          cuerpo,
          cita_id: cita.id,
          plantilla_id: plantilla.id,
          organizacion_id: plantilla.organizacion_id,
        });

        await this.registrarEnvio({
          citaId: cita.id,
          plantillaId: plantilla.id,
          canal,
          destino,
          estado: RECORDATORIO_ESTADO_ENVIADO,
        });

        await this.escribirAuditoriaSistema({
          organizacionId: plantilla.organizacion_id,
          citaId: cita.id,
          plantillaId: plantilla.id,
          canal,
          destino,
        });

        result.enviados += 1;
        result.detalle.push({
          cita_id: cita.id,
          plantilla_id: plantilla.id,
          canal,
          estado: RECORDATORIO_ESTADO_ENVIADO,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido al enviar';
        result.fallidos += 1;
        await this.registrarEnvio({
          citaId: cita.id,
          plantillaId: plantilla.id,
          canal,
          destino,
          estado: RECORDATORIO_ESTADO_FALLIDO,
          error: message,
        });
        result.detalle.push({
          cita_id: cita.id,
          plantilla_id: plantilla.id,
          canal,
          estado: RECORDATORIO_ESTADO_FALLIDO,
          error: message,
        });
        this.log.error({ err, cita_id: cita.id, plantilla_id: plantilla.id }, 'Fallo envío recordatorio');
      }
    }
  }

  private async registrarEnvio(params: {
    citaId: string;
    plantillaId: string;
    canal: string;
    destino: string | null;
    estado: string;
    error?: string;
  }) {
    await prisma.cita_recordatorio_envio.upsert({
      where: {
        cita_id_plantilla_recordatorio_id: {
          cita_id: params.citaId,
          plantilla_recordatorio_id: params.plantillaId,
        },
      },
      create: {
        cita_id: params.citaId,
        plantilla_recordatorio_id: params.plantillaId,
        canal: params.canal,
        destino: params.destino,
        estado: params.estado,
        error_mensaje: params.error ?? null,
      },
      update: {
        canal: params.canal,
        destino: params.destino,
        estado: params.estado,
        error_mensaje: params.error ?? null,
        enviado_at: new Date(),
      },
    });

    if (params.estado === RECORDATORIO_ESTADO_ENVIADO) {
      await prisma.cita.update({
        where: { id: params.citaId },
        data: { recordatorio_enviado: true, updated_at: new Date() },
      });
    }
  }

  private async escribirAuditoriaSistema(params: {
    organizacionId: string;
    citaId: string;
    plantillaId: string;
    canal: string;
    destino: string;
  }) {
    await prisma.audit_log.create({
      data: {
        organizacion_id: params.organizacionId,
        accion: 'recordatorio.enviado',
        recurso: 'citas',
        recurso_id: params.citaId,
        descripcion: `Recordatorio ${params.canal} enviado a ${params.destino}`,
        datos_despues: {
          plantilla_id: params.plantillaId,
          canal: params.canal,
          destino: params.destino,
        },
        fecha: new Date(),
      },
    });
  }
}

export function createRecordatorioJobService(env: AppEnv, log: FastifyBaseLogger) {
  return new RecordatorioJobService(env, log);
}
