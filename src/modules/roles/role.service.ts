import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import type { CreateRoleInput, SearchRolesQuery, UpdateRoleInput } from './role.schemas.js';
import { getRoleTemplateOrNull, ROLE_TEMPLATES } from './role.templates.js';

function cleanString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isValidPermisosJson(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const value of Object.values(v as Record<string, unknown>)) {
    const ok =
      value === true ||
      value === false ||
      value === '*' ||
      isStringArray(value);
    if (!ok) return false;
  }
  return true;
}

function resolvePermisos(input: { permisos?: unknown; plantilla?: string }) {
  const hasPermisos = input.permisos !== undefined;
  const hasPlantilla = input.plantilla !== undefined;

  if (hasPermisos && hasPlantilla) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      'Envía `permisos` o `plantilla`, pero no ambos a la vez.',
    );
  }

  if (hasPlantilla) {
    const template = getRoleTemplateOrNull(input.plantilla);
    if (!template) {
      throw new HttpError(400, 'INVALID_TEMPLATE', 'Plantilla inválida.');
    }
    return template.permisos as Prisma.InputJsonValue;
  }

  if (!hasPermisos) return undefined;

  if (!isValidPermisosJson(input.permisos)) {
    throw new HttpError(
      400,
      'INVALID_PERMISOS_JSON',
      'El JSON de `permisos` es inválido. Usa: true, false, "*", o arrays de acciones por módulo.',
    );
  }

  return input.permisos as Prisma.InputJsonValue;
}

export class RoleService {
  private async assertNameDisponible(nombre: string, tenantOrgId: string, excludeId?: string) {
    const existing = await prisma.rol.findFirst({
      where: {
        organizacion_id: tenantOrgId,
        nombre,
        deleted: false,
      },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new HttpError(409, 'ROLE_NAME_EXISTS', 'Ya existe un rol con ese nombre.');
    }
  }

  private async getRoleTenantOr404(id: string, tenantOrgId: string) {
    const rol = await prisma.rol.findFirst({
      where: {
        id,
        organizacion_id: tenantOrgId,
        deleted: false,
      },
    });
    if (!rol) throw new HttpError(404, 'NOT_FOUND', 'Rol no encontrado.');
    return rol;
  }

  async list(tenantOrgId: string) {
    return prisma.rol.findMany({
      where: { organizacion_id: tenantOrgId, deleted: false },
      orderBy: { created_at: 'asc' },
    });
  }

  async search(tenantOrgId: string, query: SearchRolesQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.rolWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...(query.nombre ? { nombre: { contains: query.nombre.trim(), mode: 'insensitive' } } : {}),
      ...(query.descripcion
        ? { descripcion: { contains: query.descripcion.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.rol.count({ where }),
      prisma.rol.findMany({
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
        nombre: query.nombre,
        descripcion: query.descripcion,
      },
    };
  }

  async getById(id: string, tenantOrgId: string) {
    return this.getRoleTenantOr404(id, tenantOrgId);
  }

  async create(tenantOrgId: string, input: CreateRoleInput) {
    const nombre = input.nombre.trim();
    await this.assertNameDisponible(nombre, tenantOrgId);
    const permisos = resolvePermisos({ permisos: input.permisos, plantilla: input.plantilla }) ?? {};

    return prisma.rol.create({
      data: {
        organizacion_id: tenantOrgId,
        nombre,
        descripcion: cleanString(input.descripcion),
        permisos,
      },
    });
  }

  async update(id: string, tenantOrgId: string, input: UpdateRoleInput) {
    await this.getRoleTenantOr404(id, tenantOrgId);

    const data: Prisma.rolUncheckedUpdateInput = {};
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      await this.assertNameDisponible(nombre, tenantOrgId, id);
      data.nombre = nombre;
    }
    if (input.descripcion !== undefined) {
      data.descripcion = cleanString(input.descripcion) ?? null;
    }

    const permisos = resolvePermisos({ permisos: input.permisos, plantilla: input.plantilla });
    if (permisos !== undefined) {
      data.permisos = permisos;
    }

    return prisma.rol.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getRoleTenantOr404(id, tenantOrgId);

    const usersUsingRole = await prisma.usuario.count({
      where: {
        rol_id: id,
        deleted: false,
      },
    });
    if (usersUsingRole > 0) {
      throw new HttpError(
        409,
        'ROLE_IN_USE',
        'No se puede eliminar el rol porque tiene usuarios activos asignados.',
      );
    }

    await prisma.rol.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });
  }

  listTemplates() {
    return Object.values(ROLE_TEMPLATES);
  }

  getTemplateByKey(key: string) {
    const template = getRoleTemplateOrNull(key);
    if (!template) throw new HttpError(404, 'NOT_FOUND', 'Plantilla no encontrada.');
    return template;
  }
}

export const roleService = new RoleService();
