import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import type {
  CreateUsuarioInput,
  SearchUsuariosQuery,
  UpdateUsuarioInput,
  UsuarioSedeInput,
} from './user.schemas.js';

function cleanString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function dedupeUsuarioSedes(values: UsuarioSedeInput[] | undefined): UsuarioSedeInput[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  const result: UsuarioSedeInput[] = [];
  for (const item of values) {
    const key = `${item.sede_id}::${item.consultorio_id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export class UserService {
  private async getUsuarioTenantOr404(id: string, tenantOrgId: string) {
    const usuario = await prisma.usuario.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: { rol: true, usuario_sede: true },
    });
    if (!usuario) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado.');
    return usuario;
  }

  private async assertEmailDisponible(email: string, excludeId?: string) {
    const existing = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Ya existe un usuario con ese email.');
    }
  }

  private async assertRolTenant(rolId: string, tenantOrgId: string) {
    const rol = await prisma.rol.findFirst({
      where: { id: rolId, organizacion_id: tenantOrgId, deleted: false },
      select: { id: true },
    });
    if (!rol) throw new HttpError(400, 'INVALID_ROLE', 'El rol no pertenece a la organización.');
  }

  private async assertUsuarioSedesTenant(values: UsuarioSedeInput[], tenantOrgId: string) {
    for (const item of values) {
      const sede = await prisma.sede.findFirst({
        where: { id: item.sede_id, organizacion_id: tenantOrgId, deleted: false },
        select: { id: true },
      });
      if (!sede) {
        throw new HttpError(400, 'INVALID_USUARIO_SEDE', 'La sede asignada no es válida para el tenant.');
      }
      if (item.consultorio_id) {
        const consultorio = await prisma.consultorio.findFirst({
          where: {
            id: item.consultorio_id,
            sede_id: item.sede_id,
            deleted: false,
          },
          select: { id: true },
        });
        if (!consultorio) {
          throw new HttpError(
            400,
            'INVALID_USUARIO_SEDE',
            'El consultorio asignado no pertenece a la sede indicada.',
          );
        }
      }
    }
  }

  private async replaceUsuarioSedes(tx: Prisma.TransactionClient, usuarioId: string, values: UsuarioSedeInput[]) {
    await tx.usuario_sede.deleteMany({ where: { usuario_id: usuarioId } });
    if (values.length === 0) return;
    await tx.usuario_sede.createMany({
      data: values.map((v) => ({
        usuario_id: usuarioId,
        sede_id: v.sede_id,
        consultorio_id: v.consultorio_id,
      })),
      skipDuplicates: true,
    });
  }

  private async invalidateRefreshTokens(tx: Prisma.TransactionClient, usuarioId: string) {
    await tx.refresh_token.updateMany({
      where: { usuario_id: usuarioId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  private sanitizeUser<T extends { password_hash?: string }>(usuario: T): Omit<T, 'password_hash'> {
    const { password_hash: _p, ...safe } = usuario;
    return safe;
  }

  async list(tenantOrgId: string) {
    const items = await prisma.usuario.findMany({
      where: { organizacion_id: tenantOrgId, deleted: false },
      include: { rol: true, usuario_sede: true },
      orderBy: { created_at: 'asc' },
    });
    return items.map((u) => this.sanitizeUser(u));
  }

  async search(tenantOrgId: string, query: SearchUsuariosQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.usuarioWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...(query.email ? { email: { contains: query.email.trim(), mode: 'insensitive' } } : {}),
      ...(query.nombre ? { nombre: { contains: query.nombre.trim(), mode: 'insensitive' } } : {}),
      ...(query.apellido
        ? { apellido: { contains: query.apellido.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.especialidad
        ? { especialidad: { contains: query.especialidad.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        include: { rol: true, usuario_sede: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((u) => this.sanitizeUser(u)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      sort: { sortBy, sortOrder },
      filters: {
        email: query.email,
        nombre: query.nombre,
        apellido: query.apellido,
        especialidad: query.especialidad,
      },
    };
  }

  async getById(id: string, tenantOrgId: string) {
    const usuario = await this.getUsuarioTenantOr404(id, tenantOrgId);
    return this.sanitizeUser(usuario);
  }

  async create(tenantOrgId: string, input: CreateUsuarioInput) {
    const email = input.email.trim().toLowerCase();
    await this.assertEmailDisponible(email);
    await this.assertRolTenant(input.rol_id, tenantOrgId);
    const sedes = dedupeUsuarioSedes(input.sedes);
    await this.assertUsuarioSedesTenant(sedes, tenantOrgId);
    const password_hash = await bcrypt.hash(input.password, 10);

    const usuario = await prisma.$transaction(async (tx) => {
      const created = await tx.usuario.create({
        data: {
          organizacion_id: tenantOrgId,
          rol_id: input.rol_id,
          email,
          password_hash,
          nombre: input.nombre.trim(),
          apellido: input.apellido.trim(),
          especialidad: cleanString(input.especialidad),
          numero_colegiado: cleanString(input.numero_colegiado),
          telefono: cleanString(input.telefono),
          estado: input.estado ?? 'activo',
          deleted: false,
        },
      });
      await this.replaceUsuarioSedes(tx, created.id, sedes);
      return tx.usuario.findUniqueOrThrow({
        where: { id: created.id },
        include: { rol: true, usuario_sede: true },
      });
    });

    return this.sanitizeUser(usuario);
  }

  async update(id: string, tenantOrgId: string, input: UpdateUsuarioInput) {
    await this.getUsuarioTenantOr404(id, tenantOrgId);

    if (input.email !== undefined) {
      await this.assertEmailDisponible(input.email.trim().toLowerCase(), id);
    }
    if (input.rol_id !== undefined) {
      await this.assertRolTenant(input.rol_id, tenantOrgId);
    }
    const sedes = input.sedes !== undefined ? dedupeUsuarioSedes(input.sedes) : undefined;
    if (sedes) await this.assertUsuarioSedesTenant(sedes, tenantOrgId);

    const usuario = await prisma.$transaction(async (tx) => {
      const data: Prisma.usuarioUncheckedUpdateInput = {
        updated_at: new Date(),
      };
      if (input.rol_id !== undefined) data.rol_id = input.rol_id;
      if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
      if (input.password !== undefined) data.password_hash = await bcrypt.hash(input.password, 10);
      if (input.nombre !== undefined) data.nombre = input.nombre.trim();
      if (input.apellido !== undefined) data.apellido = input.apellido.trim();
      if (input.especialidad !== undefined) data.especialidad = cleanString(input.especialidad) ?? null;
      if (input.numero_colegiado !== undefined) {
        data.numero_colegiado = cleanString(input.numero_colegiado) ?? null;
      }
      if (input.telefono !== undefined) data.telefono = cleanString(input.telefono) ?? null;
      if (input.estado !== undefined) data.estado = input.estado;

      await tx.usuario.update({ where: { id }, data });

      if (sedes !== undefined) {
        await this.replaceUsuarioSedes(tx, id, sedes);
      }

      if (input.estado !== undefined && input.estado !== 'activo') {
        await this.invalidateRefreshTokens(tx, id);
      }

      return tx.usuario.findUniqueOrThrow({
        where: { id },
        include: { rol: true, usuario_sede: true },
      });
    });

    return this.sanitizeUser(usuario);
  }

  async desactivar(id: string, tenantOrgId: string) {
    await this.getUsuarioTenantOr404(id, tenantOrgId);
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          estado: 'inactivo',
          updated_at: new Date(),
        },
      });
      await this.invalidateRefreshTokens(tx, id);
    });
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getUsuarioTenantOr404(id, tenantOrgId);
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          deleted: true,
          deleted_at: new Date(),
          estado: 'inactivo',
          updated_at: new Date(),
        },
      });
      await this.invalidateRefreshTokens(tx, id);
    });
  }
}

export const userService = new UserService();
