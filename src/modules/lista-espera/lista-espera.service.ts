import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { cleanStr } from '../../core/utils/strings.js';
import {
  LISTA_ESPERA_ESTADO_ACTIVA,
  LISTA_ESPERA_ESTADO_DEFAULT,
  LISTA_ESPERA_ESTADOS,
  LISTA_ESPERA_SORT_BY_VALUES,
  type ListaEsperaEstado,
} from './lista-espera.constants.js';
import { buildListaEsperaSugerenciasWhere, type SugerenciasListaEsperaParams } from './lista-espera.suggestions.js';
import type {
  CreateListaEsperaInput,
  ListListaEsperaQuery,
  ListListaEsperaSugerenciasQuery,
  UpdateListaEsperaInput,
} from './lista-espera.schemas.js';

const LISTA_ESPERA_INCLUDE = {
  paciente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      telefono: true,
      email: true,
    },
  },
  tipo_cita: { select: { id: true, nombre: true, duracion_minutos: true, color: true } },
  usuario: { select: { id: true, nombre: true, apellido: true, especialidad: true } },
} as const;

type ListaEsperaPayload = Prisma.lista_esperaGetPayload<{ include: typeof LISTA_ESPERA_INCLUDE }>;

function mapListaEspera(row: ListaEsperaPayload) {
  return {
    ...row,
    fecha_desde: row.fecha_desde?.toISOString().slice(0, 10) ?? null,
    fecha_hasta: row.fecha_hasta?.toISOString().slice(0, 10) ?? null,
    fecha_solicitud: row.fecha_solicitud?.toISOString() ?? null,
    created_at: row.created_at?.toISOString() ?? null,
  };
}

function parseOptionalDate(value: string | null | undefined, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, 'FECHA_INVALIDA', `\`${field}\` debe ser YYYY-MM-DD.`);
  }
  return new Date(`${s}T12:00:00.000Z`);
}

function assertEstado(estado: string): ListaEsperaEstado {
  if (!(LISTA_ESPERA_ESTADOS as readonly string[]).includes(estado)) {
    throw new HttpError(
      400,
      'ESTADO_INVALIDO',
      `estado debe ser uno de: ${LISTA_ESPERA_ESTADOS.join(', ')}.`,
    );
  }
  return estado as ListaEsperaEstado;
}

function tenantPacienteWhere(tenantOrgId: string): Prisma.pacienteWhereInput {
  return {
    deleted: false,
    paciente_organizacion: {
      some: { organizacion_id: tenantOrgId, activo: true },
    },
  };
}

export class ListaEsperaService {
  private tenantWhere(tenantOrgId: string): Prisma.lista_esperaWhereInput {
    return {
      deleted: false,
      paciente: tenantPacienteWhere(tenantOrgId),
    };
  }

  private async getListaEsperaTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.lista_espera.findFirst({
      where: { id, ...this.tenantWhere(tenantOrgId) },
      include: LISTA_ESPERA_INCLUDE,
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Registro de lista de espera no encontrado.');
    return row;
  }

  private async assertPacienteTenant(pacienteId: string, tenantOrgId: string) {
    const rel = await prisma.paciente_organizacion.findFirst({
      where: {
        paciente_id: pacienteId,
        organizacion_id: tenantOrgId,
        activo: true,
        paciente: { deleted: false },
      },
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
    });
    if (!u) {
      throw new HttpError(404, 'MEDICO_INVALIDO', 'Usuario (médico) no encontrado o inactivo en la organización.');
    }
  }

  private async assertTipoCitaTenant(tipoCitaId: string, tenantOrgId: string) {
    const tipo = await prisma.tipo_cita.findFirst({
      where: {
        id: tipoCitaId,
        organizacion_id: tenantOrgId,
        deleted: false,
        activo: true,
      },
    });
    if (!tipo) {
      throw new HttpError(404, 'TIPO_CITA_INVALIDO', 'Tipo de cita no encontrado o inactivo en la organización.');
    }
  }

  private async assertNoDuplicadoActivo(
    tenantOrgId: string,
    pacienteId: string,
    usuarioId: string | null | undefined,
    tipoCitaId: string | null | undefined,
    excludeId?: string,
  ) {
    const exists = await prisma.lista_espera.findFirst({
      where: {
        ...this.tenantWhere(tenantOrgId),
        paciente_id: pacienteId,
        estado: LISTA_ESPERA_ESTADO_ACTIVA,
        usuario_id: usuarioId ?? null,
        tipo_cita_id: tipoCitaId ?? null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) {
      throw new HttpError(
        409,
        'LISTA_ESPERA_DUPLICADA',
        'El paciente ya tiene una entrada activa en lista de espera con el mismo médico y tipo de cita.',
      );
    }
  }

  private resolveSort(query: ListListaEsperaQuery) {
    const sortBy = query.sortBy ?? 'fecha_solicitud';
    if (!LISTA_ESPERA_SORT_BY_VALUES.includes(sortBy)) {
      throw new HttpError(
        400,
        'SORT_BY_INVALIDO',
        `sortBy debe ser uno de: ${LISTA_ESPERA_SORT_BY_VALUES.join(', ')}.`,
      );
    }
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    return { sortBy, sortOrder };
  }

  async list(tenantOrgId: string, query: ListListaEsperaQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { sortBy, sortOrder } = this.resolveSort(query);

    const q = query.q?.trim();

    const where: Prisma.lista_esperaWhereInput = {
      ...this.tenantWhere(tenantOrgId),
      ...(query.estado ? { estado: assertEstado(query.estado) } : {}),
      ...(query.solo_activas === true ? { estado: LISTA_ESPERA_ESTADO_ACTIVA } : {}),
      ...(query.usuario_id ? { usuario_id: query.usuario_id } : {}),
      ...(query.tipo_cita_id ? { tipo_cita_id: query.tipo_cita_id } : {}),
      ...(query.paciente_id ? { paciente_id: query.paciente_id } : {}),
      ...(q
        ? {
            paciente: {
              ...tenantPacienteWhere(tenantOrgId),
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { apellido: { contains: q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.lista_espera.count({ where }),
      prisma.lista_espera.findMany({
        where,
        include: LISTA_ESPERA_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapListaEspera),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
    };
  }

  async sugerencias(tenantOrgId: string, query: ListListaEsperaSugerenciasQuery) {
    const limit = query.limit ?? 10;
    const where: Prisma.lista_esperaWhereInput = {
      ...buildListaEsperaSugerenciasWhere({
        usuario_id: query.usuario_id,
        tipo_cita_id: query.tipo_cita_id,
        fecha: query.fecha,
      }),
      paciente: tenantPacienteWhere(tenantOrgId),
    };

    const [total, items] = await prisma.$transaction([
      prisma.lista_espera.count({ where }),
      prisma.lista_espera.findMany({
        where,
        include: LISTA_ESPERA_INCLUDE,
        orderBy: { fecha_solicitud: 'asc' },
        take: limit,
      }),
    ]);

    return { total, items: items.map(mapListaEspera) };
  }

  /** Usado al cancelar cita (UC-AGE-004). Devuelve `undefined` si no hay candidatos. */
  async sugerenciasParaCita(
    tenantOrgId: string,
    params: SugerenciasListaEsperaParams,
    limit = 10,
  ) {
    const result = await this.sugerencias(tenantOrgId, {
      usuario_id: params.usuario_id,
      tipo_cita_id: params.tipo_cita_id,
      fecha: params.fecha,
      limit,
    });
    if (result.total === 0) return undefined;
    return result;
  }

  async create(tenantOrgId: string, input: CreateListaEsperaInput) {
    await this.assertPacienteTenant(input.paciente_id, tenantOrgId);

    const usuarioId = input.usuario_id ?? null;
    const tipoCitaId = input.tipo_cita_id ?? null;

    if (usuarioId) await this.assertUsuarioMedicoTenant(usuarioId, tenantOrgId);
    if (tipoCitaId) await this.assertTipoCitaTenant(tipoCitaId, tenantOrgId);

    const fechaDesde = parseOptionalDate(input.fecha_desde, 'fecha_desde');
    const fechaHasta = parseOptionalDate(input.fecha_hasta, 'fecha_hasta');
    if (fechaDesde && fechaHasta && fechaDesde.getTime() > fechaHasta.getTime()) {
      throw new HttpError(400, 'RANGO_INVALIDO', '`fecha_desde` no puede ser posterior a `fecha_hasta`.');
    }

    await this.assertNoDuplicadoActivo(tenantOrgId, input.paciente_id, usuarioId, tipoCitaId);

    const created = await prisma.lista_espera.create({
      data: {
        paciente_id: input.paciente_id,
        usuario_id: usuarioId,
        tipo_cita_id: tipoCitaId,
        fecha_desde: fechaDesde ?? null,
        fecha_hasta: fechaHasta ?? null,
        notas: cleanStr(input.notas) ?? null,
        estado: input.estado ? assertEstado(input.estado) : LISTA_ESPERA_ESTADO_DEFAULT,
        deleted: false,
      },
      include: LISTA_ESPERA_INCLUDE,
    });

    return mapListaEspera(created);
  }

  async getById(id: string, tenantOrgId: string) {
    const row = await this.getListaEsperaTenantOr404(id, tenantOrgId);
    return mapListaEspera(row);
  }

  async update(id: string, tenantOrgId: string, input: UpdateListaEsperaInput) {
    const current = await this.getListaEsperaTenantOr404(id, tenantOrgId);

    const data: Prisma.lista_esperaUncheckedUpdateInput = {};

    let usuarioId = current.usuario_id;
    let tipoCitaId = current.tipo_cita_id;

    if (input.usuario_id !== undefined) {
      usuarioId = input.usuario_id;
      if (usuarioId) await this.assertUsuarioMedicoTenant(usuarioId, tenantOrgId);
      data.usuario_id = usuarioId;
    }
    if (input.tipo_cita_id !== undefined) {
      tipoCitaId = input.tipo_cita_id;
      if (tipoCitaId) await this.assertTipoCitaTenant(tipoCitaId, tenantOrgId);
      data.tipo_cita_id = tipoCitaId;
    }
    if (input.fecha_desde !== undefined) data.fecha_desde = parseOptionalDate(input.fecha_desde, 'fecha_desde');
    if (input.fecha_hasta !== undefined) data.fecha_hasta = parseOptionalDate(input.fecha_hasta, 'fecha_hasta');

    const fechaDesde =
      input.fecha_desde !== undefined ? (data.fecha_desde as Date | null) : current.fecha_desde;
    const fechaHasta =
      input.fecha_hasta !== undefined ? (data.fecha_hasta as Date | null) : current.fecha_hasta;
    if (fechaDesde && fechaHasta && fechaDesde.getTime() > fechaHasta.getTime()) {
      throw new HttpError(400, 'RANGO_INVALIDO', '`fecha_desde` no puede ser posterior a `fecha_hasta`.');
    }

    const nuevoEstado = input.estado !== undefined ? assertEstado(input.estado) : current.estado;
    if (input.estado !== undefined) data.estado = nuevoEstado;
    if (input.notas !== undefined) data.notas = cleanStr(input.notas) ?? null;

    if (nuevoEstado === LISTA_ESPERA_ESTADO_ACTIVA) {
      await this.assertNoDuplicadoActivo(
        tenantOrgId,
        current.paciente_id,
        usuarioId,
        tipoCitaId,
        id,
      );
    }

    const updated = await prisma.lista_espera.update({
      where: { id },
      data,
      include: LISTA_ESPERA_INCLUDE,
    });

    return mapListaEspera(updated);
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getListaEsperaTenantOr404(id, tenantOrgId);
    await prisma.lista_espera.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date(), estado: 'cancelada' },
    });
  }
}

export const listaEsperaService = new ListaEsperaService();
