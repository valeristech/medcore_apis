import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { HttpError } from "../../core/errors.js";
import type {
  ConvenioSortBy,
  CreateConvenioInput,
  SearchConveniosQuery,
  UpdateConvenioInput,
} from "./convenio-aseguradora.schemas.js";
import { CONVENIO_SORT_BY_VALUES } from "./convenio-aseguradora.schemas.js";

// Include estándar: siempre trae datos de la aseguradora
const ASEGURADORA_INCLUDE = {
  aseguradora: {
    select: {
      id: true,
      nombre: true,
      nit: true,
      telefono: true,
      email: true,
      contacto_nombre: true,
      activa: true,
    },
  },
} as const;

export class ConvenioAseguradoraService {
  // ─── Guard privado ──────────────────────────────────────────────────────────

  private async getOr404(id: string, tenantOrgId: string) {
    const convenio = await prisma.convenio_aseguradora.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: ASEGURADORA_INCLUDE,
    });
    if (!convenio) {
      throw new HttpError(
        404,
        "NOT_FOUND",
        "Convenio de aseguradora no encontrado.",
      );
    }
    return convenio;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async list(tenantOrgId: string, query: SearchConveniosQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rawSortBy = (query.sortBy ?? "created_at") as string;
    const sortBy: ConvenioSortBy = (
      CONVENIO_SORT_BY_VALUES as readonly string[]
    ).includes(rawSortBy)
      ? (rawSortBy as ConvenioSortBy)
      : "created_at";
    const sortOrder = query.sortOrder ?? "asc";

    const where: Prisma.convenio_aseguradoraWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.convenio_aseguradora.count({ where }),
      prisma.convenio_aseguradora.findMany({
        where,
        include: ASEGURADORA_INCLUDE,
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
      filters: { activo: query.activo },
    };
  }

  async getById(id: string, tenantOrgId: string) {
    return this.getOr404(id, tenantOrgId);
  }

  async create(tenantOrgId: string, input: CreateConvenioInput) {
    // 1. Verificar que la aseguradora existe y está activa
    const aseguradora = await prisma.aseguradora.findFirst({
      where: { id: input.aseguradora_id, deleted: false, activa: true },
      select: { id: true, nombre: true },
    });
    if (!aseguradora) {
      throw new HttpError(
        404,
        "NOT_FOUND",
        "Aseguradora no encontrada o inactiva.",
      );
    }

    // 2. Verificar que no exista ya un convenio activo entre este tenant y esta aseguradora
    const convenioExistente = await prisma.convenio_aseguradora.findFirst({
      where: {
        organizacion_id: tenantOrgId,
        aseguradora_id: input.aseguradora_id,
        deleted: false,
      },
      select: { id: true },
    });
    if (convenioExistente) {
      throw new HttpError(
        409,
        "CONFLICT",
        `Ya existe un convenio con ${aseguradora.nombre} para esta organización.`,
      );
    }

    return prisma.convenio_aseguradora.create({
      data: {
        organizacion_id: tenantOrgId,
        aseguradora_id: input.aseguradora_id,
        vigencia_inicio: new Date(input.vigencia_inicio),
        vigencia_fin: input.vigencia_fin ? new Date(input.vigencia_fin) : null,
        servicios_precios: (input.servicios_precios ??
          []) as Prisma.InputJsonValue,
        activo: true,
        deleted: false,
      },
      include: ASEGURADORA_INCLUDE,
    });
  }

  async update(id: string, tenantOrgId: string, input: UpdateConvenioInput) {
    await this.getOr404(id, tenantOrgId);

    const data: Prisma.convenio_aseguradoraUncheckedUpdateInput = {};

    if (input.vigencia_inicio !== undefined)
      data.vigencia_inicio = new Date(input.vigencia_inicio);
    if (input.vigencia_fin !== undefined)
      data.vigencia_fin = input.vigencia_fin
        ? new Date(input.vigencia_fin)
        : null;
    if (input.servicios_precios !== undefined)
      data.servicios_precios = input.servicios_precios as Prisma.InputJsonValue;
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.convenio_aseguradora.update({
      where: { id },
      data,
      include: ASEGURADORA_INCLUDE,
    });
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getOr404(id, tenantOrgId);
    await prisma.convenio_aseguradora.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const convenioAseguradoraService = new ConvenioAseguradoraService();
