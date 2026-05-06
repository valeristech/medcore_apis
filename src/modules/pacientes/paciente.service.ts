import type {Prisma} from '@prisma/client';
import prisma from '../../config/prisma.js';
import {HttpError} from '../../core/errors.js';
import {cleanStr} from '../../core/utils/strings.js';
import {isValidCUI} from '../../core/utils/guatemala.js';
import type {
  CreateAlergiaInput,
  CreatePacienteInput,
  CreateSeguroInput,
  SearchPacientesQuery,
  UpdatePacienteInput,
  UpdateSeguroInput,
} from './paciente.schemas.js';
import { PACIENTE_SORT_BY_VALUES, type PacienteSortBy } from './paciente.schemas.js';

const UBICACION_INCLUDE = {
  municipio: {
    include: {
      departamento: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          activo: true,
          deleted: true,
        },
      },
    },
  },
} as const;

type PacienteUbicacionPayload = Prisma.pacienteGetPayload<{ include: typeof UBICACION_INCLUDE }>;

function buildUbicacion(m: PacienteUbicacionPayload['municipio']) {
  if (
    !m ||
    m.deleted ||
    m.activo === false ||
    !m.departamento ||
    m.departamento.deleted ||
    m.departamento.activo === false
  ) {
    return null;
  }
  return {
    municipio: { id: m.id, codigo: m.codigo, nombre: m.nombre },
    departamento: {
      id: m.departamento.id,
      codigo: m.departamento.codigo,
      nombre: m.departamento.nombre,
    },
  };
}

function datesPaciente<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row } as T & Record<string, unknown>;
  const o = out as Record<string, unknown>;
  const fn = o.fecha_nacimiento;
  if (fn instanceof Date) o.fecha_nacimiento = fn.toISOString().slice(0, 10);
  const ca = o.created_at;
  if (ca instanceof Date) o.created_at = ca.toISOString();
  const ua = o.updated_at;
  if (ua instanceof Date) o.updated_at = ua.toISOString();
  return out as T;
}

/**
 * Genera el siguiente número de expediente → EXP-2026-0001.
 */
async function generateNumeroExpediente(tenantOrgId: string): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.paciente_organizacion.count({
    where: { organizacion_id: tenantOrgId },
  });
  const correlativo = String(count + 1).padStart(4, '0');
  return `EXP-${year}-${correlativo}`;
}

export class PacienteService {
  private async assertMunicipioEnTenant(
    municipioId: string,
    tenantOrgId: string,
  ): Promise<string> {
    const m = await prisma.municipio.findFirst({
      where: {
        id: municipioId.trim(),
        organizacion_id: tenantOrgId,
        deleted: false,
        activo: true,
      },
      include: {
        departamento: { select: { id: true, deleted: true, activo: true } },
      },
    });
    if (!m) {
      throw new HttpError(400, 'MUNICIPIO_INVALIDO', 'Municipio no válido para la organización.');
    }
    if (!m.departamento || m.departamento.deleted || m.departamento.activo === false) {
      throw new HttpError(400, 'MUNICIPIO_INVALIDO', 'El departamento del municipio no está disponible.');
    }
    return m.id;
  }

  private async getPacienteTenantOr404(pacienteId: string, tenantOrgId: string) {
    const rel = await prisma.paciente_organizacion.findFirst({
      where: { paciente_id: pacienteId, organizacion_id: tenantOrgId },
      include: { paciente: { include: UBICACION_INCLUDE } },
    });
    if (!rel || !rel.paciente || rel.paciente.deleted) {
      throw new HttpError(404, 'NOT_FOUND', 'Paciente no encontrado.');
    }
    return { paciente: rel.paciente, rel };
  }

  private async assertDpiUnicoEnTenant(dpi: string, tenantOrgId: string, excludePacienteId?: string) {
    if (!isValidCUI(dpi.trim())) {
      throw new HttpError(422, 'DPI_FORMATO_INVALIDO', 'El DPI debe ser un CUI guatemalteco válido (13 dígitos).');
    }

    const existente = await prisma.paciente.findFirst({
      where: {
        dpi: dpi.trim(),
        deleted: false,
        paciente_organizacion: {
          some: { organizacion_id: tenantOrgId },
        },
        ...(excludePacienteId ? { NOT: { id: excludePacienteId } } : {}),
      },
      select: { id: true },
    });
    if (existente) {
      throw new HttpError(409, 'DPI_DUPLICADO', 'Ya existe un paciente con ese DPI en esta organización.');
    }
  }

  // ─── CRUD Paciente ──────────────────────────────────────────────────────────

  async create(tenantOrgId: string, input: CreatePacienteInput) {
    const dpi = cleanStr(input.dpi);
    if (dpi) await this.assertDpiUnicoEnTenant(dpi, tenantOrgId);

    const municipioId =
      input.municipio_id !== undefined && input.municipio_id !== null && String(input.municipio_id).trim() !== ''
        ? await this.assertMunicipioEnTenant(String(input.municipio_id), tenantOrgId)
        : null;

    const numeroExpediente = await generateNumeroExpediente(tenantOrgId);

    const paciente = await prisma.$transaction(async (tx) => {
      const created = await tx.paciente.create({
        data: {
          nombre:        input.nombre.trim(),
          apellido:      input.apellido.trim(),
          dpi:           dpi ?? null,
          nit:           cleanStr(input.nit) ?? null,
          fecha_nacimiento: input.fecha_nacimiento ? new Date(input.fecha_nacimiento) : null,
          genero:        cleanStr(input.genero) ?? null,
          telefono:      cleanStr(input.telefono) ?? null,
          telefono_secundario:          cleanStr(input.telefono_secundario) ?? null,
          email:         cleanStr(input.email)?.toLowerCase() ?? null,
          direccion:     cleanStr(input.direccion) ?? null,
          municipio_id:  municipioId,
          contacto_emergencia_nombre:   cleanStr(input.contacto_emergencia_nombre) ?? null,
          contacto_emergencia_telefono: cleanStr(input.contacto_emergencia_telefono) ?? null,
          contacto_emergencia_relacion: cleanStr(input.contacto_emergencia_relacion) ?? null,
          grupo_sanguineo:  cleanStr(input.grupo_sanguineo) ?? null,
          notas_globales:   cleanStr(input.notas_globales) ?? null,
          activo:  true,
          deleted: false,
        },
      });

      await tx.paciente_organizacion.create({
        data: {
          paciente_id:      created.id,
          organizacion_id:  tenantOrgId,
          numero_expediente: numeroExpediente,
          activo: true,
        },
      });

      return created;
    });

    return this.getById(paciente.id, tenantOrgId);
  }

  async search(tenantOrgId: string, query: SearchPacientesQuery) {
    const page     = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rawSortBy = (query.sortBy ?? 'created_at') as string;
    const sortBy: PacienteSortBy = (PACIENTE_SORT_BY_VALUES as readonly string[]).includes(rawSortBy)
      ? (rawSortBy as PacienteSortBy)
      : 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';
    const q = query.q?.trim();

    // Construir filtro de búsqueda full-text en los campos clave
    const searchFilter: Prisma.pacienteWhereInput = q
      ? {
          OR: [
            { nombre:   { contains: q, mode: 'insensitive' } },
            { apellido: { contains: q, mode: 'insensitive' } },
            { dpi:      { contains: q, mode: 'insensitive' } },
            { nit:      { contains: q, mode: 'insensitive' } },
            { telefono: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const where: Prisma.pacienteWhereInput = {
      deleted: false,
      paciente_organizacion: {
        some: { organizacion_id: tenantOrgId },
      },
      ...searchFilter,
    };

    const [total, items] = await prisma.$transaction([
      prisma.paciente.count({ where }),
      prisma.paciente.findMany({
        where,
        include: {
          municipio: UBICACION_INCLUDE.municipio,
          paciente_organizacion: {
            where: { organizacion_id: tenantOrgId },
            select: { numero_expediente: true, fecha_registro: true, activo: true },
          },
          alergia: {
            where: { deleted: false, activo: true },
            select: { id: true, sustancia: true, severidad: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((p) => {
        const { paciente_organizacion, alergia, municipio, ...rest } = p;
        return {
          ...datesPaciente(rest),
          ubicacion: buildUbicacion(municipio),
          alergia,
          expediente: paciente_organizacion[0] ?? null,
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
      filters: { q },
    };
  }

  async getById(pacienteId: string, tenantOrgId: string) {
    const { paciente, rel } = await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    const { municipio, ...rest } = paciente;
    return {
      ...datesPaciente(rest),
      ubicacion: buildUbicacion(municipio),
      expediente: {
        numero_expediente: rel.numero_expediente,
        fecha_registro:    rel.fecha_registro,
        activo:            rel.activo,
      },
    };
  }

  async update(pacienteId: string, tenantOrgId: string, input: UpdatePacienteInput) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);

    const dpi = input.dpi !== undefined ? cleanStr(input.dpi) : undefined;
    if (dpi) await this.assertDpiUnicoEnTenant(dpi, tenantOrgId, pacienteId);

    const data: Prisma.pacienteUncheckedUpdateInput = { updated_at: new Date() };

    if (input.nombre       !== undefined) data.nombre       = input.nombre.trim();
    if (input.apellido     !== undefined) data.apellido     = input.apellido.trim();
    if (input.dpi          !== undefined) data.dpi          = dpi ?? null;
    if (input.nit          !== undefined) data.nit          = cleanStr(input.nit) ?? null;
    if (input.fecha_nacimiento !== undefined) {
      data.fecha_nacimiento = input.fecha_nacimiento ? new Date(input.fecha_nacimiento) : null;
    }
    if (input.genero       !== undefined) data.genero       = cleanStr(input.genero) ?? null;
    if (input.telefono     !== undefined) data.telefono     = cleanStr(input.telefono) ?? null;
    if (input.telefono_secundario !== undefined) {
      data.telefono_secundario = cleanStr(input.telefono_secundario) ?? null;
    }
    if (input.email        !== undefined) data.email        = cleanStr(input.email)?.toLowerCase() ?? null;
    if (input.direccion    !== undefined) data.direccion    = cleanStr(input.direccion) ?? null;
    if (input.municipio_id !== undefined) {
      if (input.municipio_id === null || String(input.municipio_id).trim() === '') {
        data.municipio_id = null;
      } else {
        data.municipio_id = await this.assertMunicipioEnTenant(String(input.municipio_id), tenantOrgId);
      }
    }
    if (input.contacto_emergencia_nombre   !== undefined) {
      data.contacto_emergencia_nombre = cleanStr(input.contacto_emergencia_nombre) ?? null;
    }
    if (input.contacto_emergencia_telefono !== undefined) {
      data.contacto_emergencia_telefono = cleanStr(input.contacto_emergencia_telefono) ?? null;
    }
    if (input.contacto_emergencia_relacion !== undefined) {
      data.contacto_emergencia_relacion = cleanStr(input.contacto_emergencia_relacion) ?? null;
    }
    if (input.grupo_sanguineo  !== undefined) data.grupo_sanguineo  = cleanStr(input.grupo_sanguineo) ?? null;
    if (input.notas_globales   !== undefined) data.notas_globales   = cleanStr(input.notas_globales) ?? null;

    await prisma.paciente.update({ where: { id: pacienteId }, data });
    return this.getById(pacienteId, tenantOrgId);
  }

  async remove(pacienteId: string, tenantOrgId: string) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    await prisma.paciente.update({
      where: { id: pacienteId },
      data: { deleted: true, deleted_at: new Date(), updated_at: new Date() },
    });
  }

  /** Perfil completo: datos + alergias + seguros + últimos encuentros + planes activos */
  async getPerfil(pacienteId: string, tenantOrgId: string) {
    const { paciente, rel } = await this.getPacienteTenantOr404(pacienteId, tenantOrgId);

    const [alergias, seguros, encuentros, planesActivos] = await Promise.all([
      prisma.alergia.findMany({
        where: { paciente_id: pacienteId, deleted: false },
        orderBy: { created_at: 'desc' },
      }),
      prisma.paciente_seguro.findMany({
        where: { paciente_id: pacienteId, deleted: false },
        include: { aseguradora: { select: { id: true, nombre: true, nit: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.encuentro.findMany({
        where: { paciente_id: pacienteId, deleted: false },
        select: {
          id: true,
          fecha: true,
          tipo: true,
          estado: true,
          motivo_consulta: true,
          usuario: { select: { id: true, nombre: true, apellido: true, especialidad: true } },
          sede:   { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: 'desc' },
        take: 10,
      }),
      prisma.plan_seguimiento.findMany({
        where: { paciente_id: pacienteId, organizacion_id: tenantOrgId, deleted: false, estado: 'activo' },
        select: { id: true, nombre: true, estado: true, fecha_inicio: true, fecha_fin_estimada: true },
      }),
    ]);

    const { municipio, ...rest } = paciente;
    return {
      ...datesPaciente(rest),
      ubicacion: buildUbicacion(municipio),
      expediente: {
        numero_expediente: rel.numero_expediente,
        fecha_registro:    rel.fecha_registro,
        activo:            rel.activo,
      },
      alergias,
      seguros,
      ultimos_encuentros: encuentros,
      planes_activos: planesActivos,
    };
  }

  // ─── Alergias ───────────────────────────────────────────────────────────────

  async createAlergia(pacienteId: string, tenantOrgId: string, input: CreateAlergiaInput) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    return prisma.alergia.create({
      data: {
        paciente_id:   pacienteId,
        sustancia:     input.sustancia.trim(),
        tipo_reaccion: cleanStr(input.tipo_reaccion) ?? null,
        severidad:     input.severidad,
        notas:         cleanStr(input.notas) ?? null,
        activo:  true,
        deleted: false,
      },
    });
  }

  async listAlergias(pacienteId: string, tenantOrgId: string) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    return prisma.alergia.findMany({
      where: { paciente_id: pacienteId, deleted: false },
      orderBy: { created_at: 'desc' },
    });
  }

  async removeAlergia(pacienteId: string, alergiaId: string, tenantOrgId: string) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    const alergia = await prisma.alergia.findFirst({
      where: { id: alergiaId, paciente_id: pacienteId, deleted: false },
    });
    if (!alergia) throw new HttpError(404, 'NOT_FOUND', 'Alergia no encontrada.');
    await prisma.alergia.update({
      where: { id: alergiaId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }

  // ─── Seguros ────────────────────────────────────────────────────────────────

  async createSeguro(pacienteId: string, tenantOrgId: string, input: CreateSeguroInput) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);

    // Verificar que la aseguradora exista
    const aseguradora = await prisma.aseguradora.findFirst({
      where: { id: input.aseguradora_id, deleted: false },
      select: { id: true },
    });
    if (!aseguradora) throw new HttpError(404, 'NOT_FOUND', 'Aseguradora no encontrada.');

    return prisma.paciente_seguro.create({
      data: {
        paciente_id:    pacienteId,
        aseguradora_id: input.aseguradora_id,
        numero_poliza:  input.numero_poliza.trim(),
        tipo_plan:      cleanStr(input.tipo_plan) ?? null,
        vigencia_inicio: input.vigencia_inicio ? new Date(input.vigencia_inicio) : null,
        vigencia_fin:    input.vigencia_fin    ? new Date(input.vigencia_fin)    : null,
        activo:  true,
        deleted: false,
      },
      include: { aseguradora: { select: { id: true, nombre: true } } },
    });
  }

  async listSeguros(pacienteId: string, tenantOrgId: string) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);
    return prisma.paciente_seguro.findMany({
      where: { paciente_id: pacienteId, deleted: false },
      include: { aseguradora: { select: { id: true, nombre: true, nit: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateSeguro(pacienteId: string, seguroId: string, tenantOrgId: string, input: UpdateSeguroInput) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);

    const seguro = await prisma.paciente_seguro.findFirst({
      where: { id: seguroId, paciente_id: pacienteId, deleted: false },
    });
    if (!seguro) throw new HttpError(404, 'NOT_FOUND', 'Seguro no encontrado.');

    const data: Prisma.paciente_seguroUncheckedUpdateInput = {};

    if (input.numero_poliza   !== undefined) data.numero_poliza   = input.numero_poliza.trim();
    if (input.tipo_plan       !== undefined) data.tipo_plan       = cleanStr(input.tipo_plan) ?? null;
    if (input.vigencia_inicio !== undefined) data.vigencia_inicio = input.vigencia_inicio ? new Date(input.vigencia_inicio) : null;
    if (input.vigencia_fin    !== undefined) data.vigencia_fin    = input.vigencia_fin    ? new Date(input.vigencia_fin)    : null;
    if (input.activo          !== undefined) data.activo          = input.activo;

    return prisma.paciente_seguro.update({
      where: { id: seguroId },
      data,
      include: { aseguradora: { select: { id: true, nombre: true } } },
    });
  }

  async removeSeguro(pacienteId: string, seguroId: string, tenantOrgId: string) {
    await this.getPacienteTenantOr404(pacienteId, tenantOrgId);

    const seguro = await prisma.paciente_seguro.findFirst({
      where: { id: seguroId, paciente_id: pacienteId, deleted: false },
    });
    if (!seguro) throw new HttpError(404, 'NOT_FOUND', 'Seguro no encontrado.');

    await prisma.paciente_seguro.update({
      where: { id: seguroId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const pacienteService = new PacienteService();
