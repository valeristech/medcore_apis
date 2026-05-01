import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import {
  assertIsoDateRange,
  DEFAULT_IANA_TIMEZONE,
  eachLocalDateInclusive,
  huecosEnSlots,
  intervalToIso,
  isValidIanaTimezone,
  localRangeToUtcBounds,
  localWeekdayJs,
  ocupacionesCitaEnDia,
  ventanasDesdeReglasParaDia,
} from './disponibilidad.calendario.js';
import type {
  CalendarioQuery,
  CreateReglaDisponibilidadInput,
  ExcepcionInput,
  FranjaInput,
  SearchReglasQuery,
  UpdateReglaDisponibilidadInput,
} from './disponibilidad.schemas.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = value.trim();
  if (!DATE_RE.test(s)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Fecha inválida; use YYYY-MM-DD.');
  }
  return new Date(`${s}T12:00:00.000Z`);
}

function assertVigenciaOrder(inicio: Date | null | undefined, fin: Date | null | undefined) {
  if (inicio && fin && inicio.getTime() > fin.getTime()) {
    throw new HttpError(400, 'BAD_REQUEST', '`vigencia_inicio` no puede ser posterior a `vigencia_fin`.');
  }
}

function isFranjas(value: unknown): value is FranjaInput[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return false;
    const o = item as Record<string, unknown>;
    const dia = o.dia_semana;
    if (typeof dia !== 'number' || !Number.isInteger(dia) || dia < 0 || dia > 6) return false;
    if (typeof o.hora_inicio !== 'string' || !TIME_RE.test(o.hora_inicio)) return false;
    if (typeof o.hora_fin !== 'string' || !TIME_RE.test(o.hora_fin)) return false;
    if (o.hora_inicio >= o.hora_fin) return false;
  }
  return true;
}

function isExcepciones(value: unknown): value is ExcepcionInput[] {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return false;
    const o = item as Record<string, unknown>;
    if (typeof o.fecha !== 'string' || !DATE_RE.test(o.fecha)) return false;
    if (o.cerrado === true) continue;
    if (o.franjas !== undefined && !isFranjas(o.franjas)) return false;
  }
  return true;
}

function assertFranjas(franjas: unknown) {
  if (!isFranjas(franjas) || franjas.length === 0) {
    throw new HttpError(
      400,
      'INVALID_FRANJAS',
      '`franjas` debe ser un array no vacío de { dia_semana 0-6, hora_inicio, hora_fin } en formato HH:mm.',
    );
  }
}

function assertExcepciones(excepciones: unknown) {
  if (!isExcepciones(excepciones)) {
    throw new HttpError(
      400,
      'INVALID_EXCEPCIONES',
      '`excepciones` inválidas: cada ítem requiere `fecha` YYYY-MM-DD y, si no es cerrado, `franjas` válidas.',
    );
  }
}

const reglaInclude = {
  usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
  consultorio: {
    select: { id: true, nombre: true, sede_id: true, activo: true },
  },
} as const;

type ReglaRow = Prisma.regla_disponibilidadGetPayload<{ include: typeof reglaInclude }>;

function toDateOnlyIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapRegla(r: ReglaRow) {
  return {
    id: r.id,
    usuario_id: r.usuario_id,
    consultorio_id: r.consultorio_id,
    franjas: r.franjas,
    excepciones: r.excepciones ?? [],
    vigencia_inicio: toDateOnlyIso(r.vigencia_inicio),
    vigencia_fin: toDateOnlyIso(r.vigencia_fin),
    created_at: r.created_at?.toISOString() ?? null,
    usuario: r.usuario,
    consultorio: r.consultorio,
  };
}

function tenantReglaWhere(tenantOrgId: string): Prisma.regla_disponibilidadWhereInput {
  return {
    deleted: false,
    usuario: { organizacion_id: tenantOrgId, deleted: false },
    consultorio: {
      deleted: false,
      sede: { organizacion_id: tenantOrgId, deleted: false },
    },
  };
}

export class DisponibilidadService {
  private resolveEffectiveTimezone(
    queryTz: string | undefined,
    orgZonaHoraria: string | null | undefined,
  ): string {
    const q = queryTz?.trim();
    if (q) {
      if (!isValidIanaTimezone(q)) {
        throw new HttpError(400, 'INVALID_TIMEZONE', `Zona horaria IANA inválida: "${q}".`);
      }
      return q;
    }
    const o = orgZonaHoraria?.trim();
    if (o && isValidIanaTimezone(o)) return o;
    return DEFAULT_IANA_TIMEZONE;
  }

  private async assertUsuarioMedicoTenant(usuarioId: string, tenantOrgId: string) {
    const u = await prisma.usuario.findFirst({
      where: { id: usuarioId, organizacion_id: tenantOrgId, deleted: false },
      select: { id: true },
    });
    if (!u) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado en la organización.');
  }

  private async assertConsultorioTenant(consultorioId: string, tenantOrgId: string) {
    const c = await prisma.consultorio.findFirst({
      where: {
        id: consultorioId,
        deleted: false,
        sede: { organizacion_id: tenantOrgId, deleted: false },
      },
      select: { id: true },
    });
    if (!c) throw new HttpError(404, 'NOT_FOUND', 'Consultorio no encontrado en la organización.');
  }

  private async getReglaTenantOr404(id: string, tenantOrgId: string) {
    const regla = await prisma.regla_disponibilidad.findFirst({
      where: { id, ...tenantReglaWhere(tenantOrgId) },
      include: reglaInclude,
    });
    if (!regla) throw new HttpError(404, 'NOT_FOUND', 'Regla de disponibilidad no encontrada.');
    return regla;
  }

  async search(tenantOrgId: string, query: SearchReglasQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.regla_disponibilidadWhereInput = {
      ...tenantReglaWhere(tenantOrgId),
      ...(query.usuario_id ? { usuario_id: query.usuario_id } : {}),
      ...(query.consultorio_id ? { consultorio_id: query.consultorio_id } : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.regla_disponibilidad.count({ where }),
      prisma.regla_disponibilidad.findMany({
        where,
        include: reglaInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapRegla),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
      filters: {
        usuario_id: query.usuario_id,
        consultorio_id: query.consultorio_id,
      },
    };
  }

  async listByUsuario(usuarioId: string, tenantOrgId: string) {
    await this.assertUsuarioMedicoTenant(usuarioId, tenantOrgId);
    const rows = await prisma.regla_disponibilidad.findMany({
      where: {
        usuario_id: usuarioId,
        ...tenantReglaWhere(tenantOrgId),
      },
      include: reglaInclude,
      orderBy: { created_at: 'desc' },
    });
    return { items: rows.map(mapRegla) };
  }

  async getById(id: string, tenantOrgId: string) {
    const regla = await this.getReglaTenantOr404(id, tenantOrgId);
    return mapRegla(regla);
  }

  async create(tenantOrgId: string, input: CreateReglaDisponibilidadInput) {
    await this.assertUsuarioMedicoTenant(input.usuario_id, tenantOrgId);
    await this.assertConsultorioTenant(input.consultorio_id, tenantOrgId);
    assertFranjas(input.franjas);
    assertExcepciones(input.excepciones);

    const vigencia_inicio = parseDateOnly(input.vigencia_inicio ?? undefined);
    const vigencia_fin = parseDateOnly(input.vigencia_fin ?? undefined);
    assertVigenciaOrder(
      vigencia_inicio === undefined ? null : vigencia_inicio,
      vigencia_fin === undefined ? null : vigencia_fin,
    );

    const created = await prisma.regla_disponibilidad.create({
      data: {
        usuario_id: input.usuario_id,
        consultorio_id: input.consultorio_id,
        franjas: input.franjas as Prisma.InputJsonValue,
        excepciones: (input.excepciones ?? []) as Prisma.InputJsonValue,
        vigencia_inicio: vigencia_inicio ?? null,
        vigencia_fin: vigencia_fin ?? null,
      },
      include: reglaInclude,
    });
    return mapRegla(created);
  }

  async update(id: string, tenantOrgId: string, input: UpdateReglaDisponibilidadInput) {
    const current = await this.getReglaTenantOr404(id, tenantOrgId);

    let usuario_id = current.usuario_id;
    let consultorio_id = current.consultorio_id;

    if (input.usuario_id !== undefined) {
      await this.assertUsuarioMedicoTenant(input.usuario_id, tenantOrgId);
      usuario_id = input.usuario_id;
    }
    if (input.consultorio_id !== undefined) {
      await this.assertConsultorioTenant(input.consultorio_id, tenantOrgId);
      consultorio_id = input.consultorio_id;
    }

    if (input.franjas !== undefined) {
      assertFranjas(input.franjas);
    }
    if (input.excepciones !== undefined) {
      assertExcepciones(input.excepciones);
    }

    const data: Prisma.regla_disponibilidadUncheckedUpdateInput = {};

    if (input.usuario_id !== undefined) data.usuario_id = usuario_id;
    if (input.consultorio_id !== undefined) data.consultorio_id = consultorio_id;
    if (input.franjas !== undefined) data.franjas = input.franjas as Prisma.InputJsonValue;
    if (input.excepciones !== undefined) data.excepciones = input.excepciones as Prisma.InputJsonValue;

    let nextInicio = current.vigencia_inicio;
    let nextFin = current.vigencia_fin;

    if (input.vigencia_inicio !== undefined) {
      nextInicio = parseDateOnly(input.vigencia_inicio ?? undefined) ?? null;
      data.vigencia_inicio = nextInicio;
    }
    if (input.vigencia_fin !== undefined) {
      nextFin = parseDateOnly(input.vigencia_fin ?? undefined) ?? null;
      data.vigencia_fin = nextFin;
    }

    assertVigenciaOrder(nextInicio ?? null, nextFin ?? null);

    if (Object.keys(data).length === 0) {
      return mapRegla(current);
    }

    const updated = await prisma.regla_disponibilidad.update({
      where: { id },
      data,
      include: reglaInclude,
    });
    return mapRegla(updated);
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getReglaTenantOr404(id, tenantOrgId);
    await prisma.regla_disponibilidad.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date() },
    });
  }

  /**
   * UC-AGE-002: dos lecturas en paralelo (reglas + citas) y composición en memoria del calendario.
   * Zona horaria: query `timezone` (IANA) → `organizacion.zona_horaria` → `America/Guatemala`.
   */
  async getCalendario(tenantOrgId: string, query: CalendarioQuery) {
    const MAX_DAYS = 120;
    const slotMinutos = Math.min(120, Math.max(10, query.slot_minutos ?? 30));

    const orgTz = await prisma.organizacion.findFirst({
      where: { id: tenantOrgId, deleted: false },
      select: { zona_horaria: true },
    });
    const tz = this.resolveEffectiveTimezone(query.timezone, orgTz?.zona_horaria ?? null);

    assertIsoDateRange(query.desde, query.hasta, MAX_DAYS, tz);
    await this.assertUsuarioMedicoTenant(query.usuario_id, tenantOrgId);
    await this.assertConsultorioTenant(query.consultorio_id, tenantOrgId);

    const { desdeUtc, hastaUtc } = localRangeToUtcBounds(tz, query.desde, query.hasta);

    const reglaWhere: Prisma.regla_disponibilidadWhereInput = {
      usuario_id: query.usuario_id,
      consultorio_id: query.consultorio_id,
      ...tenantReglaWhere(tenantOrgId),
    };

    const [reglasRaw, citasRaw] = await prisma.$transaction([
      prisma.regla_disponibilidad.findMany({
        where: reglaWhere,
        select: {
          id: true,
          franjas: true,
          excepciones: true,
          vigencia_inicio: true,
          vigencia_fin: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.cita.findMany({
        where: {
          usuario_id: query.usuario_id,
          consultorio_id: query.consultorio_id,
          deleted: false,
          estado: { notIn: ['cancelada', 'cancelado'] },
          sede: { organizacion_id: tenantOrgId, deleted: false },
          fecha_hora_inicio: { lte: hastaUtc },
          fecha_hora_fin: { gte: desdeUtc },
        },
        select: {
          id: true,
          fecha_hora_inicio: true,
          fecha_hora_fin: true,
          estado: true,
          tipo_cita_id: true,
          paciente_id: true,
          tipo_cita: { select: { nombre: true, duracion_minutos: true } },
        },
        orderBy: { fecha_hora_inicio: 'asc' },
      }),
    ]);

    const reglasResumen = reglasRaw.map((r) => ({
      id: r.id,
      franjas: r.franjas,
      excepciones: r.excepciones ?? [],
      vigencia_inicio: toDateOnlyIso(r.vigencia_inicio),
      vigencia_fin: toDateOnlyIso(r.vigencia_fin),
    }));

    const ocupaciones = citasRaw.map((c) => ({
      id: c.id,
      fecha_hora_inicio: c.fecha_hora_inicio.toISOString(),
      fecha_hora_fin: c.fecha_hora_fin.toISOString(),
      estado: c.estado,
      tipo_cita_id: c.tipo_cita_id,
      paciente_id: c.paciente_id,
      tipo_cita: c.tipo_cita,
    }));

    const fechas = eachLocalDateInclusive(tz, query.desde, query.hasta);
    const dias = fechas.map((fecha) => {
      const dow = localWeekdayJs(tz, fecha);
      const ventanas = ventanasDesdeReglasParaDia(reglasRaw, fecha, tz);
      const ocupadas = ocupacionesCitaEnDia(fecha, citasRaw, tz);
      const huecos = huecosEnSlots(ventanas, ocupadas, slotMinutos);
      return {
        fecha,
        dia_semana: dow,
        ventanas: ventanas.map(intervalToIso),
        huecos_disponibles: huecos.map(intervalToIso),
        ocupaciones_dia: ocupadas.map(intervalToIso),
      };
    });

    return {
      periodo: {
        desde: query.desde,
        hasta: query.hasta,
        timezone: tz,
        interpretacion: 'IANA' as const,
        descripcion:
          'Las fechas `desde`/`hasta`, `dia_semana` de las franjas y las excepciones se interpretan en la zona IANA `timezone`. Las horas de respuesta (`inicio`/`fin`) están en ISO-8601 (UTC).',
      },
      usuario_id: query.usuario_id,
      consultorio_id: query.consultorio_id,
      slot_minutos: slotMinutos,
      reglas: reglasResumen,
      ocupaciones,
      dias,
    };
  }
}

export const disponibilidadService = new DisponibilidadService();
