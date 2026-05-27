import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { HttpError } from "../../core/errors.js";
import { cleanStr } from "../../core/utils/strings.js";
import type {
  CreateAseguradoraInput,
  SearchAseguradorasQuery,
  UpdateAseguradoraInput,
} from "./aseguradora.schemas.js";
import {
  ASEGURADORA_SORT_BY_VALUES,
  type AseguradoraSortBy,
} from "./aseguradora.schemas.js";

export class AseguradoraService {
  // ─── Guard privado ──────────────────────────────────────────────────────────

  async getOr404(id: string) {
    const aseguradora = await prisma.aseguradora.findFirst({
      where: { id, deleted: false },
    });
    if (!aseguradora) {
      throw new HttpError(404, "NOT_FOUND", "Aseguradora no encontrada.");
    }
    return aseguradora;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async list(query: SearchAseguradorasQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rawSortBy = (query.sortBy ?? "nombre") as string;
    const sortBy: AseguradoraSortBy = (
      ASEGURADORA_SORT_BY_VALUES as readonly string[]
    ).includes(rawSortBy)
      ? (rawSortBy as AseguradoraSortBy)
      : "nombre";
    const sortOrder = query.sortOrder ?? "asc";
    const q = query.q?.trim();

    const searchFilter: Prisma.aseguradoraWhereInput = q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { nit: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const where: Prisma.aseguradoraWhereInput = {
      deleted: false,
      ...(query.activa !== undefined ? { activa: query.activa } : {}),
      ...searchFilter,
    };

    const [total, items] = await prisma.$transaction([
      prisma.aseguradora.count({ where }),
      prisma.aseguradora.findMany({
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
      filters: { q, activa: query.activa },
    };
  }

  async getById(id: string) {
    return this.getOr404(id);
  }

  async create(input: CreateAseguradoraInput) {
    return prisma.aseguradora.create({
      data: {
        nombre: input.nombre.trim(),
        nit: cleanStr(input.nit) ?? null,
        direccion: cleanStr(input.direccion) ?? null,
        telefono: cleanStr(input.telefono) ?? null,
        email: cleanStr(input.email)?.toLowerCase() ?? null,
        contacto_nombre: cleanStr(input.contacto_nombre) ?? null,
        activa: true,
        deleted: false,
      },
    });
  }

  async update(id: string, input: UpdateAseguradoraInput) {
    await this.getOr404(id);

    const data: Prisma.aseguradoraUncheckedUpdateInput = {};

    if (input.nombre !== undefined) data.nombre = input.nombre.trim();
    if (input.nit !== undefined) data.nit = cleanStr(input.nit) ?? null;
    if (input.direccion !== undefined)
      data.direccion = cleanStr(input.direccion) ?? null;
    if (input.telefono !== undefined)
      data.telefono = cleanStr(input.telefono) ?? null;
    if (input.email !== undefined)
      data.email = cleanStr(input.email)?.toLowerCase() ?? null;
    if (input.contacto_nombre !== undefined)
      data.contacto_nombre = cleanStr(input.contacto_nombre) ?? null;
    if (input.activa !== undefined) data.activa = input.activa;

    return prisma.aseguradora.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getOr404(id);
    await prisma.aseguradora.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const aseguradoraService = new AseguradoraService();
