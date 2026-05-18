import { DateTime } from 'luxon';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { cleanStr } from '../../core/utils/strings.js';
import {
  DEFAULT_IANA_TIMEZONE,
  isValidIanaTimezone,
  ventanasDesdeReglasParaDia,
  type IntervalMs,
} from '../disponibilidad/disponibilidad.calendario.js';
import { assertDuracionMinutos } from '../tipo-cita/tipo-cita.validation.js';
import { CITA_ESTADO_DEFAULT, CITA_ESTADOS_CANCELADOS } from './cita.constants.js';
import type { CreateCitaInput } from './cita.schemas.js';

const CITA_INCLUDE = {
  paciente: { select: { id: true, nombre: true, apellido: true } },
  usuario: { select: { id: true, nombre: true, apellido: true, especialidad: true } },
  consultorio: { select: { id: true, nombre: true, sede_id: true } },
  sede: { select: { id: true, nombre: true } },
  tipo_cita: { select: { id: true, nombre: true, duracion_minutos: true, color: true } },
} as const;

type CitaPayload = Prisma.citaGetPayload<{ include: typeof CITA_INCLUDE }>;

function mapCita(row: CitaPayload) {
  return {
    ...row,
    fecha_hora_inicio: row.fecha_hora_inicio.toISOString(),
    fecha_hora_fin: row.fecha_hora_fin.toISOString(),
    created_at: row.created_at?.toISOString() ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
  };
}

function parseInstant(value: string, field: string): Date {
  const s = value.trim();
  const dt = DateTime.fromISO(s, { setZone: true });
  if (!dt.isValid) {
    throw new HttpError(400, 'FECHA_INVALIDA', `\`${field}\` no es una fecha/hora ISO válida.`);
  }
  return dt.toUTC().toJSDate();
}

function intervalContainedInWindows(slot: IntervalMs, windows: IntervalMs[]): boolean {
  return windows.some((w) => slot.start >= w.start && slot.end <= w.end);
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

function activeCitaOverlapWhere(
  inicio: Date,
  fin: Date,
): Pick<Prisma.citaWhereInput, 'deleted' | 'estado' | 'fecha_hora_inicio' | 'fecha_hora_fin'> {
  return {
    deleted: false,
    estado: { notIn: [...CITA_ESTADOS_CANCELADOS] },
    fecha_hora_inicio: { lt: fin },
    fecha_hora_fin: { gt: inicio },
  };
}

export class CitaService {
  private resolveTimezone(queryTz: string | undefined, orgZonaHoraria: string | null | undefined): string {
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

  private async assertUsuarioMedicoTenant(usuarioId: string, tenantOrgId: string) {
    const u = await prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        organizacion_id: tenantOrgId,
        deleted: false,
        estado: 'activo',
      },
      select: { id: true },
    });
    if (!u) {
      throw new HttpError(404, 'MEDICO_INVALIDO', 'Usuario (médico) no encontrado o inactivo en la organización.');
    }
  }

  private async assertSedeTenant(sedeId: string, tenantOrgId: string) {
    const sede = await prisma.sede.findFirst({
      where: {
        id: sedeId,
        organizacion_id: tenantOrgId,
        deleted: false,
        activo: true,
      },
      select: { id: true, nombre: true },
    });
    if (!sede) {
      throw new HttpError(404, 'SEDE_INVALIDA', 'Sede no encontrada o inactiva en la organización.');
    }
    return sede;
  }

  private async assertConsultorioEnSede(consultorioId: string, sedeId: string, tenantOrgId: string) {
    const c = await prisma.consultorio.findFirst({
      where: {
        id: consultorioId,
        sede_id: sedeId,
        deleted: false,
        activo: true,
        sede: { organizacion_id: tenantOrgId, deleted: false },
      },
      select: { id: true, nombre: true, sede_id: true },
    });
    if (!c) {
      throw new HttpError(
        400,
        'CONSULTORIO_SEDE_INVALIDO',
        'El consultorio no pertenece a la sede indicada o no está activo.',
      );
    }
    return c;
  }

  private async assertTipoCitaTenant(tipoCitaId: string, tenantOrgId: string) {
    const tipo = await prisma.tipo_cita.findFirst({
      where: {
        id: tipoCitaId,
        organizacion_id: tenantOrgId,
        deleted: false,
        activo: true,
      },
      select: { id: true, nombre: true, duracion_minutos: true },
    });
    if (!tipo) {
      throw new HttpError(404, 'TIPO_CITA_INVALIDO', 'Tipo de cita no encontrado o inactivo en la organización.');
    }
    assertDuracionMinutos(tipo.duracion_minutos);
    return tipo;
  }

  private async assertNoConflicts(
    tenantOrgId: string,
    inicio: Date,
    fin: Date,
    usuarioId: string,
    consultorioId: string,
    pacienteId: string,
  ) {
    const overlap = activeCitaOverlapWhere(inicio, fin);
    const tenantSede = { sede: { organizacion_id: tenantOrgId, deleted: false } };

    const [medico, consultorio, paciente] = await Promise.all([
      prisma.cita.findFirst({
        where: { ...overlap, usuario_id: usuarioId, ...tenantSede },
        select: { id: true, fecha_hora_inicio: true, fecha_hora_fin: true },
      }),
      prisma.cita.findFirst({
        where: { ...overlap, consultorio_id: consultorioId, ...tenantSede },
        select: { id: true, fecha_hora_inicio: true, fecha_hora_fin: true },
      }),
      prisma.cita.findFirst({
        where: { ...overlap, paciente_id: pacienteId, ...tenantSede },
        select: { id: true, fecha_hora_inicio: true, fecha_hora_fin: true },
      }),
    ]);

    if (medico) {
      throw new HttpError(409, 'CONFLICTO_MEDICO', 'El médico ya tiene otra cita en ese horario.');
    }
    if (consultorio) {
      throw new HttpError(409, 'CONFLICTO_CONSULTORIO', 'El consultorio ya está ocupado en ese horario.');
    }
    if (paciente) {
      throw new HttpError(409, 'CONFLICTO_PACIENTE', 'El paciente ya tiene otra cita en ese horario.');
    }
  }

  private async assertWithinAvailability(
    tenantOrgId: string,
    usuarioId: string,
    consultorioId: string,
    inicio: Date,
    fin: Date,
    tz: string,
  ) {
    const reglas = await prisma.regla_disponibilidad.findMany({
      where: {
        usuario_id: usuarioId,
        consultorio_id: consultorioId,
        ...tenantReglaWhere(tenantOrgId),
      },
      select: {
        id: true,
        franjas: true,
        excepciones: true,
        vigencia_inicio: true,
        vigencia_fin: true,
      },
    });

    if (reglas.length === 0) {
      throw new HttpError(
        400,
        'SIN_DISPONIBILIDAD',
        'No hay reglas de disponibilidad configuradas para este médico y consultorio.',
      );
    }

    const localDate = DateTime.fromJSDate(inicio, { zone: 'utc' }).setZone(tz).toISODate();
    if (!localDate) {
      throw new HttpError(400, 'FECHA_INVALIDA', 'No se pudo interpretar la fecha en la zona horaria indicada.');
    }

    const ventanas = ventanasDesdeReglasParaDia(reglas, localDate, tz);
    if (ventanas.length === 0) {
      throw new HttpError(
        400,
        'FUERA_DE_HORARIO',
        'No hay ventana de atención configurada para ese día.',
      );
    }

    const slot: IntervalMs = { start: inicio.getTime(), end: fin.getTime() };
    if (!intervalContainedInWindows(slot, ventanas)) {
      throw new HttpError(
        400,
        'FUERA_DE_HORARIO',
        'La cita no cae completamente dentro del horario de disponibilidad del médico.',
      );
    }
  }

  async create(tenantOrgId: string, input: CreateCitaInput) {
    const org = await prisma.organizacion.findFirst({
      where: { id: tenantOrgId, deleted: false },
      select: { zona_horaria: true },
    });
    if (!org) throw new HttpError(404, 'NOT_FOUND', 'Organización no encontrada.');

    const tz = this.resolveTimezone(input.timezone, org.zona_horaria);

    await this.assertPacienteTenant(input.paciente_id, tenantOrgId);
    await this.assertUsuarioMedicoTenant(input.usuario_id, tenantOrgId);
    await this.assertSedeTenant(input.sede_id, tenantOrgId);
    await this.assertConsultorioEnSede(input.consultorio_id, input.sede_id, tenantOrgId);

    const tipo = await this.assertTipoCitaTenant(input.tipo_cita_id, tenantOrgId);

    const inicio = parseInstant(input.fecha_hora_inicio, 'fecha_hora_inicio');
    let fin: Date;
    if (input.fecha_hora_fin !== undefined && input.fecha_hora_fin !== null && String(input.fecha_hora_fin).trim() !== '') {
      fin = parseInstant(String(input.fecha_hora_fin), 'fecha_hora_fin');
    } else {
      fin = new Date(inicio.getTime() + tipo.duracion_minutos * 60 * 1000);
    }

    if (fin.getTime() <= inicio.getTime()) {
      throw new HttpError(400, 'RANGO_INVALIDO', '`fecha_hora_fin` debe ser posterior a `fecha_hora_inicio`.');
    }

    await this.assertNoConflicts(
      tenantOrgId,
      inicio,
      fin,
      input.usuario_id,
      input.consultorio_id,
      input.paciente_id,
    );

    await this.assertWithinAvailability(
      tenantOrgId,
      input.usuario_id,
      input.consultorio_id,
      inicio,
      fin,
      tz,
    );

    const created = await prisma.cita.create({
      data: {
        paciente_id: input.paciente_id,
        usuario_id: input.usuario_id,
        consultorio_id: input.consultorio_id,
        sede_id: input.sede_id,
        tipo_cita_id: input.tipo_cita_id,
        fecha_hora_inicio: inicio,
        fecha_hora_fin: fin,
        estado: CITA_ESTADO_DEFAULT,
        notas: cleanStr(input.notas) ?? null,
        origen: cleanStr(input.origen) ?? 'manual',
        deleted: false,
      },
      include: CITA_INCLUDE,
    });

    return mapCita(created);
  }
}

export const citaService = new CitaService();
