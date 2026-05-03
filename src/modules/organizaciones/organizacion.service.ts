import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { cleanStr as cleanString } from '../../core/utils/strings.js';
import type {
  CreateOrganizacionInput,
  SearchOrganizacionesQuery,
  UpdateOrganizacionInput,
} from './organizacion.schemas.js';

type OrganizacionSafe = Prisma.organizacionGetPayload<Record<string, never>>;

function toCreateData(input: CreateOrganizacionInput): Prisma.organizacionCreateInput {
  return {
    razon_social: input.razon_social.trim(),
    nit: input.nit.trim(),
    direccion: cleanString(input.direccion),
    logo_url: cleanString(input.logo_url),
    moneda: cleanString(input.moneda),
    zona_horaria: cleanString(input.zona_horaria),
    idioma: cleanString(input.idioma),
    certificador_fel: cleanString(input.certificador_fel),
    certificado_fel: cleanString(input.certificado_fel),
    serie_fel: cleanString(input.serie_fel),
    correlativo_fel: input.correlativo_fel,
    activo: input.activo,
  };
}

function toUpdateData(input: UpdateOrganizacionInput): Prisma.organizacionUpdateInput {
  const data: Prisma.organizacionUpdateInput = {};

  if (input.razon_social !== undefined) data.razon_social = input.razon_social.trim();
  if (input.nit !== undefined) data.nit = input.nit.trim();
  if (input.direccion !== undefined) data.direccion = cleanString(input.direccion) ?? null;
  if (input.logo_url !== undefined) data.logo_url = cleanString(input.logo_url) ?? null;
  if (input.moneda !== undefined) data.moneda = cleanString(input.moneda) ?? null;
  if (input.zona_horaria !== undefined) data.zona_horaria = cleanString(input.zona_horaria) ?? null;
  if (input.idioma !== undefined) data.idioma = cleanString(input.idioma) ?? null;
  if (input.certificador_fel !== undefined) {
    data.certificador_fel = cleanString(input.certificador_fel) ?? null;
  }
  if (input.certificado_fel !== undefined) {
    data.certificado_fel = cleanString(input.certificado_fel) ?? null;
  }
  if (input.serie_fel !== undefined) data.serie_fel = cleanString(input.serie_fel) ?? null;
  if (input.correlativo_fel !== undefined) data.correlativo_fel = input.correlativo_fel;
  if (input.activo !== undefined) data.activo = input.activo;
  data.updated_at = new Date();

  return data;
}

export class OrganizacionService {
  private async assertNitDisponible(nit: string, excludeId?: string) {
    const existing = await prisma.organizacion.findUnique({
      where: { nit },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new HttpError(409, 'NIT_ALREADY_EXISTS', 'Ya existe una organización con ese NIT.');
    }
  }

  async create(input: CreateOrganizacionInput): Promise<OrganizacionSafe> {
    const nit = input.nit.trim();
    await this.assertNitDisponible(nit);
    return prisma.organizacion.create({
      data: toCreateData(input),
    });
  }

  async listForTenant(tenantOrganizacionId: string): Promise<OrganizacionSafe[]> {
    const org = await prisma.organizacion.findFirst({
      where: {
        id: tenantOrganizacionId,
        deleted: false,
      },
    });
    return org ? [org] : [];
  }

  async searchForTenant(tenantOrganizacionId: string, query: SearchOrganizacionesQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.organizacionWhereInput = {
      id: tenantOrganizacionId,
      deleted: false,
      ...(query.razon_social
        ? { razon_social: { contains: query.razon_social.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.nit ? { nit: { contains: query.nit.trim(), mode: 'insensitive' } } : {}),
      ...(query.direccion
        ? { direccion: { contains: query.direccion.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.organizacion.count({ where }),
      prisma.organizacion.findMany({
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
        razon_social: query.razon_social,
        nit: query.nit,
        direccion: query.direccion,
      },
    };
  }

  async getByIdForTenant(id: string, tenantOrganizacionId: string): Promise<OrganizacionSafe> {
    if (id !== tenantOrganizacionId) {
      throw new HttpError(404, 'NOT_FOUND', 'Organización no encontrada.');
    }
    const org = await prisma.organizacion.findFirst({
      where: { id, deleted: false },
    });
    if (!org) {
      throw new HttpError(404, 'NOT_FOUND', 'Organización no encontrada.');
    }
    return org;
  }

  async updateForTenant(
    id: string,
    tenantOrganizacionId: string,
    input: UpdateOrganizacionInput,
  ): Promise<OrganizacionSafe> {
    await this.getByIdForTenant(id, tenantOrganizacionId);

    const trimmedNit = input.nit?.trim();
    if (trimmedNit) {
      await this.assertNitDisponible(trimmedNit, id);
    }

    return prisma.organizacion.update({
      where: { id },
      data: toUpdateData(input),
    });
  }

  async softDeleteForTenant(id: string, tenantOrganizacionId: string): Promise<void> {
    await this.getByIdForTenant(id, tenantOrganizacionId);
    await prisma.organizacion.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
        activo: false,
        updated_at: new Date(),
      },
    });
  }
}

export const organizacionService = new OrganizacionService();
