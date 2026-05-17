import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { cleanStr as cleanString } from '../../core/utils/strings.js';
import type {
  CreateConsultorioInput,
  CreateSedeInput,
  SearchConsultoriosQuery,
  SearchSedesQuery,
  UpdateConsultorioInput,
  UpdateSedeInput,
} from './sede.schemas.js';

function sedeCreateData(
  organizacionId: string,
  input: CreateSedeInput,
): Prisma.sedeUncheckedCreateInput {
  return {
    organizacion_id: organizacionId,
    nombre: input.nombre.trim(),
    direccion: cleanString(input.direccion),
    telefono: cleanString(input.telefono),
    horarios: input.horarios as Prisma.InputJsonValue | undefined,
    activo: input.activo,
  };
}

function sedeUpdateData(input: UpdateSedeInput): Prisma.sedeUncheckedUpdateInput {
  const data: Prisma.sedeUncheckedUpdateInput = { updated_at: new Date() };
  if (input.nombre !== undefined) data.nombre = input.nombre.trim();
  if (input.direccion !== undefined) data.direccion = cleanString(input.direccion) ?? null;
  if (input.telefono !== undefined) data.telefono = cleanString(input.telefono) ?? null;
  if (input.horarios !== undefined) data.horarios = input.horarios as Prisma.InputJsonValue;
  if (input.activo !== undefined) data.activo = input.activo;
  return data;
}

function consultorioCreateData(
  sedeId: string,
  input: CreateConsultorioInput,
): Prisma.consultorioUncheckedCreateInput {
  return {
    sede_id: sedeId,
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    activo: input.activo,
  };
}

function consultorioUpdateData(
  input: UpdateConsultorioInput,
): Prisma.consultorioUncheckedUpdateInput {
  const data: Prisma.consultorioUncheckedUpdateInput = {};
  if (input.nombre !== undefined) data.nombre = input.nombre.trim();
  if (input.tipo !== undefined) data.tipo = input.tipo;
  if (input.activo !== undefined) data.activo = input.activo;
  return data;
}

export class SedeService {
  private normalizeSedeWithConsultorios<T extends { consultorio?: unknown[] }>(
    sede: T,
  ): Omit<T, 'consultorio'> & { consultorios: unknown[] } {
    const { consultorio, ...rest } = sede;
    return {
      ...rest,
      consultorios: consultorio ?? [],
    };
  }

  private async getSedeTenantOr404(sedeId: string, tenantOrgId: string) {
    const sede = await prisma.sede.findFirst({
      where: {
        id: sedeId,
        organizacion_id: tenantOrgId,
        deleted: false,
      },
      include: {
        consultorio: {
          where: { deleted: false },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!sede) throw new HttpError(404, 'NOT_FOUND', 'Sede no encontrada.');
    return this.normalizeSedeWithConsultorios(sede);
  }

  private async getConsultorioTenantOr404(consultorioId: string, sedeId: string, tenantOrgId: string) {
    const consultorio = await prisma.consultorio.findFirst({
      where: {
        id: consultorioId,
        sede_id: sedeId,
        deleted: false,
        sede: {
          organizacion_id: tenantOrgId,
          deleted: false,
        },
      },
    });
    if (!consultorio) throw new HttpError(404, 'NOT_FOUND', 'Consultorio no encontrado.');
    return consultorio;
  }

  async listSedes(tenantOrgId: string) {
    const sedes = await prisma.sede.findMany({
      where: { organizacion_id: tenantOrgId, deleted: false },
      include: {
        consultorio: {
          where: { deleted: false },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'asc' },
    });
    return sedes.map((s) => this.normalizeSedeWithConsultorios(s));
  }

  async searchSedes(tenantOrgId: string, query: SearchSedesQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.sedeWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...(query.organizacion_id
        ? { organizacion_id: query.organizacion_id.trim() }
        : {}),
      ...(query.nombre ? { nombre: { contains: query.nombre.trim(), mode: 'insensitive' } } : {}),
      ...(query.direccion
        ? { direccion: { contains: query.direccion.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.sede.count({ where }),
      prisma.sede.findMany({
        where,
        include: {
          consultorio: {
            where: { deleted: false },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((s) => this.normalizeSedeWithConsultorios(s)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
      filters: {
        organizacion_id: query.organizacion_id,
        nombre: query.nombre,
        direccion: query.direccion,
      },
    };
  }

  async createSede(tenantOrgId: string, input: CreateSedeInput) {
    const sede = await prisma.sede.create({
      data: sedeCreateData(tenantOrgId, input),
      include: {
        consultorio: {
          where: { deleted: false },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    return this.normalizeSedeWithConsultorios(sede);
  }

  async getSede(sedeId: string, tenantOrgId: string) {
    return this.getSedeTenantOr404(sedeId, tenantOrgId);
  }

  async updateSede(sedeId: string, tenantOrgId: string, input: UpdateSedeInput) {
    await this.getSedeTenantOr404(sedeId, tenantOrgId);
    const sede = await prisma.sede.update({
      where: { id: sedeId },
      data: sedeUpdateData(input),
      include: {
        consultorio: {
          where: { deleted: false },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    return this.normalizeSedeWithConsultorios(sede);
  }

  async deleteSede(sedeId: string, tenantOrgId: string) {
    await this.getSedeTenantOr404(sedeId, tenantOrgId);
    await prisma.$transaction([
      prisma.consultorio.updateMany({
        where: { sede_id: sedeId, deleted: false },
        data: { deleted: true, deleted_at: new Date(), activo: false },
      }),
      prisma.sede.update({
        where: { id: sedeId },
        data: {
          deleted: true,
          deleted_at: new Date(),
          activo: false,
          updated_at: new Date(),
        },
      }),
    ]);
  }

  async listConsultorios(sedeId: string, tenantOrgId: string) {
    await this.getSedeTenantOr404(sedeId, tenantOrgId);
    return prisma.consultorio.findMany({
      where: { sede_id: sedeId, deleted: false },
      orderBy: { created_at: 'asc' },
    });
  }

  async searchConsultorios(tenantOrgId: string, query: SearchConsultoriosQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.consultorioWhereInput = {
      deleted: false,
      sede: {
        organizacion_id: tenantOrgId,
        deleted: false,
      },
      ...(query.sede_id ? { sede_id: query.sede_id.trim() } : {}),
      ...(query.nombre ? { nombre: { contains: query.nombre.trim(), mode: 'insensitive' } } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.consultorio.count({ where }),
      prisma.consultorio.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
      filters: {
        sede_id: query.sede_id,
        nombre: query.nombre,
        tipo: query.tipo,
      },
    };
  }

  async createConsultorio(sedeId: string, tenantOrgId: string, input: CreateConsultorioInput) {
    await this.getSedeTenantOr404(sedeId, tenantOrgId);
    return prisma.consultorio.create({
      data: consultorioCreateData(sedeId, input),
    });
  }

  async getConsultorio(consultorioId: string, tenantOrgId: string) {
    const consultorio = await prisma.consultorio.findFirst({
      where: {
        id: consultorioId,
        deleted: false,
        sede: {
          organizacion_id: tenantOrgId,
          deleted: false,
        },
      },
    });
    if (!consultorio) throw new HttpError(404, 'NOT_FOUND', 'Consultorio no encontrado.');
    return consultorio;
  }

  async updateConsultorioById(
    consultorioId: string,
    tenantOrgId: string,
    input: UpdateConsultorioInput,
  ) {
    await this.getConsultorio(consultorioId, tenantOrgId);
    return prisma.consultorio.update({
      where: { id: consultorioId },
      data: consultorioUpdateData(input),
    });
  }

  async deleteConsultorioById(consultorioId: string, tenantOrgId: string) {
    await this.getConsultorio(consultorioId, tenantOrgId);
    await prisma.consultorio.update({
      where: { id: consultorioId },
      data: {
        deleted: true,
        deleted_at: new Date(),
        activo: false,
      },
    });
  }
}

export const sedeService = new SedeService();
