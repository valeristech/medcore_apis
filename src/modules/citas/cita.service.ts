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
import {
  ALERTA_TIPO_PERSONALIZADA,
  CITA_ESTADO_CANCELADA,
  CITA_ESTADO_DEFAULT,
  CITA_ESTADO_NO_ASISTIO,
  CITA_ESTADOS_CANCELADOS,
  CITA_ESTADOS_MARCABLES_NO_SHOW,
  CITA_ESTADOS_NO_MODIFICABLES,
  CITA_ESTADOS_REAGENDABLES,
} from './cita.constants.js';
import { assertRangoCitaValido, parseCitaInstant, resolveCitaFin } from './cita.scheduling.js';
import type {
  CancelCitaInput,
  CreateCitaInput,
  MarkNoShowInput,
  RescheduleCitaInput,
} from './cita.schemas.js';

const CITA_INCLUDE = {
  paciente: { select: { id: true, nombre: true, apellido: true } },
  usuario: { select: { id: true, nombre: true, apellido: true, especialidad: true } },
  consultorio: { select: { id: true, nombre: true, sede_id: true } },
  sede: { select: { id: true, nombre: true } },
  tipo_cita: { select: { id: true, nombre: true, duracion_minutos: true, color: true } },
} as const;

const LISTA_ESPERA_INCLUDE = {
  paciente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  tipo_cita: { select: { id: true, nombre: true } },
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
  excludeCitaId?: string,
): Prisma.citaWhereInput {
  return {
    deleted: false,
    estado: { notIn: [...CITA_ESTADOS_CANCELADOS] },
    fecha_hora_inicio: { lt: fin },
    fecha_hora_fin: { gt: inicio },
    ...(excludeCitaId ? { NOT: { id: excludeCitaId } } : {}),
  };
}

function assertEstadoReagendable(estado: string): void {
  if (!(CITA_ESTADOS_REAGENDABLES as readonly string[]).includes(estado)) {
    throw new HttpError(
      409,
      'ESTADO_NO_REAGENDABLE',
      `No se puede reagendar una cita en estado "${estado}". Solo: ${CITA_ESTADOS_REAGENDABLES.join(', ')}.`,
    );
  }
}

function assertEstadoCancelable(estado: string): void {
  if ((CITA_ESTADOS_NO_MODIFICABLES as readonly string[]).includes(estado)) {
    throw new HttpError(
      409,
      'ESTADO_NO_CANCELABLE',
      `No se puede cancelar una cita en estado "${estado}".`,
    );
  }
}

function assertEstadoMarcableNoShow(estado: string): void {
  if (estado === CITA_ESTADO_NO_ASISTIO || estado === 'no_asistió') {
    throw new HttpError(409, 'YA_NO_ASISTIO', 'La cita ya está marcada como no asistió.');
  }
  if (!(CITA_ESTADOS_MARCABLES_NO_SHOW as readonly string[]).includes(estado)) {
    throw new HttpError(
      409,
      'ESTADO_NO_MARCABLE',
      `No se puede marcar no-show en estado "${estado}". Solo: ${CITA_ESTADOS_MARCABLES_NO_SHOW.join(', ')}.`,
    );
  }
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

  private async getOrgTimezone(tenantOrgId: string) {
    const org = await prisma.organizacion.findFirst({
      where: { id: tenantOrgId, deleted: false },
      select: { zona_horaria: true },
    });
    if (!org) throw new HttpError(404, 'NOT_FOUND', 'Organización no encontrada.');
    return org;
  }

  private async getCitaTenantOr404(citaId: string, tenantOrgId: string) {
    const cita = await prisma.cita.findFirst({
      where: {
        id: citaId,
        deleted: false,
        sede: { organizacion_id: tenantOrgId, deleted: false },
      },
      include: CITA_INCLUDE,
    });
    if (!cita) throw new HttpError(404, 'NOT_FOUND', 'Cita no encontrada.');
    return cita;
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
    excludeCitaId?: string,
  ) {
    const overlap = activeCitaOverlapWhere(inicio, fin, excludeCitaId);
    const tenantSede = { sede: { organizacion_id: tenantOrgId, deleted: false } };

    const [medico, consultorio, paciente] = await Promise.all([
      prisma.cita.findFirst({
        where: { ...overlap, usuario_id: usuarioId, ...tenantSede },
        select: { id: true },
      }),
      prisma.cita.findFirst({
        where: { ...overlap, consultorio_id: consultorioId, ...tenantSede },
        select: { id: true },
      }),
      prisma.cita.findFirst({
        where: { ...overlap, paciente_id: pacienteId, ...tenantSede },
        select: { id: true },
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

  private async validateCitaSlot(
    tenantOrgId: string,
    params: {
      pacienteId: string;
      usuarioId: string;
      consultorioId: string;
      sedeId: string;
      tipoCitaId: string;
      fechaHoraInicio: string;
      fechaHoraFin?: string;
      timezone?: string;
      excludeCitaId?: string;
    },
  ) {
    const org = await this.getOrgTimezone(tenantOrgId);
    const tz = this.resolveTimezone(params.timezone, org.zona_horaria);

    await this.assertPacienteTenant(params.pacienteId, tenantOrgId);
    await this.assertUsuarioMedicoTenant(params.usuarioId, tenantOrgId);
    await this.assertSedeTenant(params.sedeId, tenantOrgId);
    await this.assertConsultorioEnSede(params.consultorioId, params.sedeId, tenantOrgId);

    const tipo = await this.assertTipoCitaTenant(params.tipoCitaId, tenantOrgId);

    const inicio = parseCitaInstant(params.fechaHoraInicio, 'fecha_hora_inicio');
    const fin = resolveCitaFin(inicio, params.fechaHoraFin, tipo.duracion_minutos);
    assertRangoCitaValido(inicio, fin);

    await this.assertNoConflicts(
      tenantOrgId,
      inicio,
      fin,
      params.usuarioId,
      params.consultorioId,
      params.pacienteId,
      params.excludeCitaId,
    );

    await this.assertWithinAvailability(
      tenantOrgId,
      params.usuarioId,
      params.consultorioId,
      inicio,
      fin,
      tz,
    );

    return { inicio, fin, tipo };
  }

  private async findListaEsperaSugerencia(cita: CitaPayload) {
    const where: Prisma.lista_esperaWhereInput = {
      deleted: false,
      estado: 'activa',
      OR: [{ usuario_id: cita.usuario_id }, { usuario_id: null }],
      AND: [
        {
          OR: [{ tipo_cita_id: cita.tipo_cita_id }, { tipo_cita_id: null }],
        },
      ],
    };

    const [total, items] = await prisma.$transaction([
      prisma.lista_espera.count({ where }),
      prisma.lista_espera.findMany({
        where,
        include: LISTA_ESPERA_INCLUDE,
        orderBy: { fecha_solicitud: 'asc' },
        take: 10,
      }),
    ]);

    if (total === 0) return undefined;

    return {
      total,
      items: items.map((row) => ({
        id: row.id,
        paciente_id: row.paciente_id,
        paciente: row.paciente,
        tipo_cita_id: row.tipo_cita_id,
        tipo_cita: row.tipo_cita,
        usuario_id: row.usuario_id,
        fecha_desde: row.fecha_desde?.toISOString().slice(0, 10) ?? null,
        fecha_hasta: row.fecha_hasta?.toISOString().slice(0, 10) ?? null,
        notas: row.notas,
      })),
    };
  }

  async getCitaForAudit(citaId: string, tenantOrgId: string) {
    const cita = await this.getCitaTenantOr404(citaId, tenantOrgId);
    return mapCita(cita);
  }

  async create(tenantOrgId: string, input: CreateCitaInput) {
    const { inicio, fin } = await this.validateCitaSlot(tenantOrgId, {
      pacienteId: input.paciente_id,
      usuarioId: input.usuario_id,
      consultorioId: input.consultorio_id,
      sedeId: input.sede_id,
      tipoCitaId: input.tipo_cita_id,
      fechaHoraInicio: input.fecha_hora_inicio,
      fechaHoraFin: input.fecha_hora_fin,
      timezone: input.timezone,
    });

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

  async reschedule(citaId: string, tenantOrgId: string, input: RescheduleCitaInput) {
    const current = await this.getCitaTenantOr404(citaId, tenantOrgId);
    assertEstadoReagendable(current.estado);

    const pacienteId = input.paciente_id ?? current.paciente_id;
    const usuarioId = input.usuario_id ?? current.usuario_id;
    const consultorioId = input.consultorio_id ?? current.consultorio_id;
    const sedeId = input.sede_id ?? current.sede_id;
    const tipoCitaId = input.tipo_cita_id ?? current.tipo_cita_id;
    const fechaHoraInicio = input.fecha_hora_inicio ?? current.fecha_hora_inicio.toISOString();

    const scheduleChanged =
      input.fecha_hora_inicio !== undefined ||
      input.fecha_hora_fin !== undefined ||
      input.usuario_id !== undefined ||
      input.consultorio_id !== undefined ||
      input.sede_id !== undefined ||
      input.tipo_cita_id !== undefined;

    const { inicio, fin } = await this.validateCitaSlot(tenantOrgId, {
      pacienteId,
      usuarioId,
      consultorioId,
      sedeId,
      tipoCitaId,
      fechaHoraInicio,
      fechaHoraFin: input.fecha_hora_fin,
      timezone: input.timezone,
      excludeCitaId: citaId,
    });

    const updated = await prisma.cita.update({
      where: { id: citaId },
      data: {
        paciente_id: pacienteId,
        usuario_id: usuarioId,
        consultorio_id: consultorioId,
        sede_id: sedeId,
        tipo_cita_id: tipoCitaId,
        fecha_hora_inicio: inicio,
        fecha_hora_fin: fin,
        notas: input.notas !== undefined ? cleanStr(input.notas) ?? null : current.notas,
        recordatorio_enviado: scheduleChanged ? false : current.recordatorio_enviado,
        updated_at: new Date(),
      },
      include: CITA_INCLUDE,
    });

    return mapCita(updated);
  }

  async cancel(citaId: string, tenantOrgId: string, input: CancelCitaInput) {
    const current = await this.getCitaTenantOr404(citaId, tenantOrgId);
    assertEstadoCancelable(current.estado);

    const motivo = cleanStr(input.motivo_cancelacion);
    if (!motivo) {
      throw new HttpError(400, 'MOTIVO_REQUERIDO', 'El motivo de cancelación es obligatorio.');
    }

    const lista_espera = await this.findListaEsperaSugerencia(current);

    const updated = await prisma.cita.update({
      where: { id: citaId },
      data: {
        estado: CITA_ESTADO_CANCELADA,
        motivo_cancelacion: motivo,
        updated_at: new Date(),
      },
      include: CITA_INCLUDE,
    });

    return {
      cita: mapCita(updated),
      lista_espera,
    };
  }

  async markNoShow(citaId: string, tenantOrgId: string, input: MarkNoShowInput) {
    const current = await this.getCitaTenantOr404(citaId, tenantOrgId);
    assertEstadoMarcableNoShow(current.estado);

    const now = new Date();
    if (current.fecha_hora_inicio.getTime() > now.getTime()) {
      throw new HttpError(
        400,
        'CITA_FUTURA',
        'No se puede marcar no-show antes de la hora de inicio de la cita.',
      );
    }

    const notasExtra = cleanStr(input.notas);
    const crearAlerta = input.crear_alerta !== false;
    const prioridad = input.prioridad_alerta?.trim() || 'normal';

    const notasActualizadas =
      notasExtra !== undefined
        ? [current.notas?.trim(), `No-show: ${notasExtra}`].filter(Boolean).join('\n') || null
        : current.notas;

    const pacienteNombre = `${current.paciente.nombre} ${current.paciente.apellido}`.trim();
    const medicoNombre = `${current.usuario.nombre} ${current.usuario.apellido}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const cita = await tx.cita.update({
        where: { id: citaId },
        data: {
          estado: CITA_ESTADO_NO_ASISTIO,
          notas: notasActualizadas ?? null,
          updated_at: new Date(),
        },
        include: CITA_INCLUDE,
      });

      let alerta: {
        id: string;
        titulo: string;
        tipo: string;
        prioridad: string | null;
      } | null = null;

      if (crearAlerta) {
        const titulo = `No asistió a cita — ${pacienteNombre}`;
        const descripcion = [
          `Cita del ${cita.fecha_hora_inicio.toISOString()} con ${medicoNombre} en ${cita.sede.nombre}.`,
          notasExtra ? `Notas: ${notasExtra}` : null,
        ]
          .filter(Boolean)
          .join(' ');

        alerta = await tx.alerta_preventiva.create({
          data: {
            organizacion_id: tenantOrgId,
            paciente_id: cita.paciente_id,
            tipo: ALERTA_TIPO_PERSONALIZADA,
            titulo,
            descripcion,
            prioridad,
            estado: 'activa',
            visible_para: 'ambos',
            deleted: false,
          },
          select: { id: true, titulo: true, tipo: true, prioridad: true },
        });
      }

      return { cita, alerta };
    });

    return {
      cita: mapCita(result.cita),
      alerta: result.alerta,
    };
  }
}

export const citaService = new CitaService();
