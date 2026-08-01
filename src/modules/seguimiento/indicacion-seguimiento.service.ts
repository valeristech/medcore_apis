import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoIndicacionSeguimiento } from '../../core/enums/seguimiento.enums.js';
import { Prioridad } from '../../core/enums/comun.enums.js';
import {
  ESTADOS_BANDEJA_DEFAULT,
  ESTADOS_GESTIONABLES,
  PRIORIDAD_RANK,
  type IndicacionSortBy,
} from './indicacion-seguimiento.constants.js';
import { hceService } from '../encuentros/encuentro.service.js';
import { citaService } from '../citas/cita.service.js';
import type {
  ActualizarGestionIndicacionInput,
  AgendarCitaIndicacionInput,
  CrearIndicacionSeguimientoInput,
  ListIndicacionesSeguimientoQuery,
} from './indicacion-seguimiento.schemas.js';

const INDICACION_INCLUDE = {
  paciente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      telefono: true,
      telefono_secundario: true,
      email: true,
    },
  },
  usuario_indicacion_seguimiento_medico_idTousuario: {
    select: { id: true, nombre: true, apellido: true, especialidad: true },
  },
  usuario_indicacion_seguimiento_atendida_porTousuario: {
    select: { id: true, nombre: true, apellido: true },
  },
  cita: {
    select: { id: true, estado: true, fecha_hora_inicio: true, fecha_hora_fin: true },
  },
} as const;

type IndicacionPayload = Prisma.indicacion_seguimientoGetPayload<{ include: typeof INDICACION_INCLUDE }>;

/** `YYYY-MM-DD` para columnas `@db.Date` (sin componente de hora). */
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

function parseFechaHora(value: string | undefined, campo: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Fecha/hora inválida en "${campo}".`);
  }
  return parsed;
}

function mapIndicacion(row: IndicacionPayload) {
  const {
    usuario_indicacion_seguimiento_medico_idTousuario: medico,
    usuario_indicacion_seguimiento_atendida_porTousuario: atendidaPorUsuario,
    cita,
    ...rest
  } = row;

  const serialized = serializeDates(rest);

  return {
    ...serialized,
    fecha_sugerida: toDateOnly(rest.fecha_sugerida),
    rango_fecha_inicio: toDateOnly(rest.rango_fecha_inicio),
    rango_fecha_fin: toDateOnly(rest.rango_fecha_fin),
    fecha_gestion: rest.fecha_gestion?.toISOString() ?? null,
    fecha_contacto_paciente: rest.fecha_contacto_paciente?.toISOString() ?? null,
    medico,
    atendida_por_usuario: atendidaPorUsuario,
    cita: cita
      ? {
          ...cita,
          fecha_hora_inicio: cita.fecha_hora_inicio.toISOString(),
          fecha_hora_fin: cita.fecha_hora_fin.toISOString(),
        }
      : null,
  };
}

function rankPrioridad(prioridad: string | null): number {
  return PRIORIDAD_RANK[prioridad ?? ''] ?? PRIORIDAD_RANK[Prioridad.Normal];
}

export class IndicacionSeguimientoService {
  // ─── Guards privados ────────────────────────────────────────────────────────

  private assertPlazoValido(input: CrearIndicacionSeguimientoInput): void {
    const tieneDias = input.dias_para_cita !== undefined;
    const tieneFecha = input.fecha_sugerida !== undefined;
    const tieneRangoInicio = input.rango_fecha_inicio !== undefined;
    const tieneRangoFin = input.rango_fecha_fin !== undefined;

    if (tieneRangoInicio !== tieneRangoFin) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'El rango de fechas requiere "rango_fecha_inicio" y "rango_fecha_fin" juntos.',
      );
    }

    if (!tieneDias && !tieneFecha && !tieneRangoInicio) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Debe indicar un plazo: "dias_para_cita", "fecha_sugerida" o un rango de fechas.',
      );
    }
  }

  private async getIndicacionTenantOr404(id: string, tenantOrgId: string): Promise<IndicacionPayload> {
    const row = await prisma.indicacion_seguimiento.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: INDICACION_INCLUDE,
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Indicación de seguimiento no encontrada.');
    return row;
  }

  // ─── UC-SEG-001 ─────────────────────────────────────────────────────────────

  async crear(tenantOrgId: string, medicoId: string, input: CrearIndicacionSeguimientoInput) {
    this.assertPlazoValido(input);

    const encuentro = await hceService.getEncuentroOrFail(input.encuentro_id, tenantOrgId);

    if (encuentro.usuario_id !== medicoId) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Solo el médico dueño del encuentro puede indicar seguimiento.',
      );
    }

    const fechaSugerida = parseFechaOnly(input.fecha_sugerida, 'fecha_sugerida');
    const rangoInicio = parseFechaOnly(input.rango_fecha_inicio, 'rango_fecha_inicio');
    const rangoFin = parseFechaOnly(input.rango_fecha_fin, 'rango_fecha_fin');

    if (rangoInicio && rangoFin && rangoInicio.getTime() > rangoFin.getTime()) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        '"rango_fecha_inicio" no puede ser posterior a "rango_fecha_fin".',
      );
    }

    const created = await prisma.indicacion_seguimiento.create({
      data: {
        encuentro_id: encuentro.id,
        paciente_id: encuentro.paciente_id,
        medico_id: medicoId,
        organizacion_id: tenantOrgId,
        tipo: input.tipo,
        descripcion: input.descripcion.trim(),
        dias_para_cita: input.dias_para_cita ?? null,
        fecha_sugerida: fechaSugerida ?? null,
        rango_fecha_inicio: rangoInicio ?? null,
        rango_fecha_fin: rangoFin ?? null,
        prioridad: cleanStr(input.prioridad) ?? Prioridad.Normal,
        notas_medico: cleanStr(input.notas) ?? null,
        estado: EstadoIndicacionSeguimiento.Pendiente,
        deleted: false,
      },
      include: INDICACION_INCLUDE,
    });

    return mapIndicacion(created);
  }

  // ─── UC-SEG-002 ─────────────────────────────────────────────────────────────

  async listar(tenantOrgId: string, query: ListIndicacionesSeguimientoQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy: IndicacionSortBy = query.sortBy ?? 'prioridad';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

    const where: Prisma.indicacion_seguimientoWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      estado: query.estado ? query.estado : { in: [...ESTADOS_BANDEJA_DEFAULT] },
      ...(query.medico_id ? { medico_id: query.medico_id } : {}),
      ...(query.paciente_id ? { paciente_id: query.paciente_id } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad } : {}),
    };

    if (sortBy === 'created_at') {
      const [total, rows] = await prisma.$transaction([
        prisma.indicacion_seguimiento.count({ where }),
        prisma.indicacion_seguimiento.findMany({
          where,
          include: INDICACION_INCLUDE,
          orderBy: { created_at: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(mapIndicacion),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        sort: { sortBy, sortOrder },
      };
    }

    // sortBy === 'prioridad' (default): urgencia + antigüedad. No hay convención de
    // $queryRaw en este repo, así que se ordena/pagina en memoria (ver constants.ts).
    const all = await prisma.indicacion_seguimiento.findMany({
      where,
      include: INDICACION_INCLUDE,
      orderBy: { created_at: 'asc' },
    });

    const ranked = all
      .slice()
      .sort(
        (a, b) =>
          rankPrioridad(a.prioridad) - rankPrioridad(b.prioridad) ||
          (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0),
      );

    const total = ranked.length;
    const start = (page - 1) * pageSize;
    const pageItems = ranked.slice(start, start + pageSize);

    return {
      items: pageItems.map(mapIndicacion),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      sort: { sortBy, sortOrder: 'asc' as const },
    };
  }

  async actualizarGestion(
    id: string,
    tenantOrgId: string,
    secretariaId: string,
    input: ActualizarGestionIndicacionInput,
  ) {
    const current = await this.getIndicacionTenantOr404(id, tenantOrgId);

    if (current.estado === EstadoIndicacionSeguimiento.Agendada) {
      throw new HttpError(
        409,
        'INDICACION_YA_AGENDADA',
        'La indicación ya fue agendada; no se puede modificar.',
      );
    }

    if (
      input.estado !== undefined &&
      !(ESTADOS_GESTIONABLES as readonly string[]).includes(input.estado)
    ) {
      throw new HttpError(
        400,
        'ESTADO_NO_PERMITIDO',
        `estado debe ser uno de: ${ESTADOS_GESTIONABLES.join(', ')}. Para agendar use POST /:id/agendar-cita.`,
      );
    }

    const fechaContacto = parseFechaHora(input.fecha_contacto_paciente, 'fecha_contacto_paciente');

    const data: Prisma.indicacion_seguimientoUncheckedUpdateInput = {
      atendida_por: secretariaId,
      fecha_gestion: new Date(),
      updated_at: new Date(),
    };

    if (input.estado !== undefined) data.estado = input.estado;
    if (input.notas_secretaria !== undefined) data.notas_secretaria = cleanStr(input.notas_secretaria) ?? null;
    if (fechaContacto !== undefined) data.fecha_contacto_paciente = fechaContacto;
    if (input.preferencia_horario !== undefined) {
      data.preferencia_horario = cleanStr(input.preferencia_horario) ?? null;
    }
    if (input.registrar_intento === true) {
      data.intentos_contacto = { increment: 1 };
    }

    const updated = await prisma.indicacion_seguimiento.update({
      where: { id },
      data,
      include: INDICACION_INCLUDE,
    });

    return mapIndicacion(updated);
  }

  async agendarCita(
    id: string,
    tenantOrgId: string,
    secretariaId: string,
    input: AgendarCitaIndicacionInput,
  ) {
    const current = await this.getIndicacionTenantOr404(id, tenantOrgId);

    if (current.estado === EstadoIndicacionSeguimiento.Agendada || current.cita_generada_id) {
      throw new HttpError(409, 'INDICACION_YA_AGENDADA', 'La indicación ya fue agendada.');
    }

    const cita = await citaService.create(tenantOrgId, {
      paciente_id: current.paciente_id,
      usuario_id: input.usuario_id ?? current.medico_id,
      consultorio_id: input.consultorio_id,
      sede_id: input.sede_id,
      tipo_cita_id: input.tipo_cita_id,
      fecha_hora_inicio: input.fecha_hora_inicio,
      fecha_hora_fin: input.fecha_hora_fin,
      notas: cleanStr(input.notas) ?? `Seguimiento: ${current.descripcion}`,
      origen: 'seguimiento',
      timezone: input.timezone,
    });

    const updated = await prisma.indicacion_seguimiento.update({
      where: { id },
      data: {
        cita_generada_id: cita.id,
        estado: EstadoIndicacionSeguimiento.Agendada,
        atendida_por: secretariaId,
        fecha_gestion: new Date(),
        updated_at: new Date(),
      },
      include: INDICACION_INCLUDE,
    });

    return { indicacion: mapIndicacion(updated), cita };
  }
}

export const indicacionSeguimientoService = new IndicacionSeguimientoService();
