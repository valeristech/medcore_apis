import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import type {
  CreateDepartamentoInput,
  CreateMunicipioInput,
  ListDepartamentosQuery,
  ListMunicipiosQuery,
  UpdateDepartamentoInput,
  UpdateMunicipioInput,
} from './geo-catalog.schemas.js';

export class GeoCatalogService {
  private async getDepartamentoTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.departamento.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Departamento no encontrado.');
    return row;
  }

  private async assertCodigoDeptoUnico(
    codigo: string,
    tenantOrgId: string,
    excludeId?: string,
  ) {
    const exists = await prisma.departamento.findFirst({
      where: {
        organizacion_id: tenantOrgId,
        codigo: codigo.trim(),
        deleted: false,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) {
      throw new HttpError(409, 'CODIGO_DUPLICADO', 'Ya existe un departamento con ese código en la organización.');
    }
  }

  private async assertCodigoMunicipioUnico(
    departamentoId: string,
    codigo: string,
    tenantOrgId: string,
    excludeId?: string,
  ) {
    const exists = await prisma.municipio.findFirst({
      where: {
        departamento_id: departamentoId,
        codigo: codigo.trim(),
        deleted: false,
        organizacion_id: tenantOrgId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) {
      throw new HttpError(409, 'CODIGO_DUPLICADO', 'Ya existe un municipio con ese código en el departamento.');
    }
  }

  async listDepartamentos(tenantOrgId: string, query: ListDepartamentosQuery) {
    const q = query.q?.trim();
    const activoFilter =
      query.incluir_inactivos === true ? {} : { activo: true as const };

    const where: Prisma.departamentoWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...activoFilter,
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.departamento.findMany({
      where,
      orderBy: [{ codigo: 'asc' }],
    });
    return { items };
  }

  async createDepartamento(tenantOrgId: string, input: CreateDepartamentoInput) {
    const codigo = input.codigo.trim();
    const nombre = input.nombre.trim();
    await this.assertCodigoDeptoUnico(codigo, tenantOrgId);

    return prisma.departamento.create({
      data: {
        organizacion_id: tenantOrgId,
        codigo,
        nombre,
        activo: input.activo ?? true,
        deleted: false,
      },
    });
  }

  async getDepartamento(id: string, tenantOrgId: string) {
    return this.getDepartamentoTenantOr404(id, tenantOrgId);
  }

  async updateDepartamento(id: string, tenantOrgId: string, input: UpdateDepartamentoInput) {
    await this.getDepartamentoTenantOr404(id, tenantOrgId);

    const data: Prisma.departamentoUncheckedUpdateInput = { updated_at: new Date() };
    if (input.codigo !== undefined) {
      const c = input.codigo.trim();
      await this.assertCodigoDeptoUnico(c, tenantOrgId, id);
      data.codigo = c;
    }
    if (input.nombre !== undefined) data.nombre = input.nombre.trim();
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.departamento.update({ where: { id }, data });
  }

  async removeDepartamento(id: string, tenantOrgId: string) {
    await this.getDepartamentoTenantOr404(id, tenantOrgId);

    const hijos = await prisma.municipio.count({
      where: { departamento_id: id, deleted: false },
    });
    if (hijos > 0) {
      throw new HttpError(
        409,
        'DEPARTAMENTO_EN_USO',
        'No se puede eliminar: existen municipios activos bajo este departamento.',
      );
    }

    const pacientes = await prisma.paciente.count({
      where: {
        municipio: { departamento_id: id },
        deleted: false,
      },
    });
    if (pacientes > 0) {
      throw new HttpError(
        409,
        'DEPARTAMENTO_EN_USO',
        'No se puede eliminar: hay pacientes asociados a municipios de este departamento.',
      );
    }

    await prisma.departamento.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date(), updated_at: new Date() },
    });
  }

  async listMunicipiosByDepartamento(
    departamentoId: string,
    tenantOrgId: string,
    query: ListMunicipiosQuery,
  ) {
    await this.getDepartamentoTenantOr404(departamentoId, tenantOrgId);

    const q = query.q?.trim();
    const activoFilter =
      query.incluir_inactivos === true ? {} : { activo: true as const };

    const where: Prisma.municipioWhereInput = {
      departamento_id: departamentoId,
      organizacion_id: tenantOrgId,
      deleted: false,
      ...activoFilter,
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.municipio.findMany({
      where,
      orderBy: [{ codigo: 'asc' }],
    });
    return { items };
  }

  private async getMunicipioTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.municipio.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Municipio no encontrado.');
    return row;
  }

  async createMunicipio(tenantOrgId: string, input: CreateMunicipioInput) {
    const depto = await this.getDepartamentoTenantOr404(input.departamento_id, tenantOrgId);
    if (!depto.activo) {
      throw new HttpError(400, 'DEPARTAMENTO_INACTIVO', 'El departamento está inactivo.');
    }

    const codigo = input.codigo.trim();
    const nombre = input.nombre.trim();
    await this.assertCodigoMunicipioUnico(input.departamento_id, codigo, tenantOrgId);

    return prisma.municipio.create({
      data: {
        organizacion_id: tenantOrgId,
        departamento_id: input.departamento_id,
        codigo,
        nombre,
        activo: input.activo ?? true,
        deleted: false,
      },
    });
  }

  async getMunicipio(id: string, tenantOrgId: string) {
    return this.getMunicipioTenantOr404(id, tenantOrgId);
  }

  async updateMunicipio(id: string, tenantOrgId: string, input: UpdateMunicipioInput) {
    const current = await this.getMunicipioTenantOr404(id, tenantOrgId);

    let departamentoId = current.departamento_id;
    if (input.departamento_id !== undefined) {
      await this.getDepartamentoTenantOr404(input.departamento_id, tenantOrgId);
      departamentoId = input.departamento_id;
    }

    const data: Prisma.municipioUncheckedUpdateInput = { updated_at: new Date() };
    if (input.departamento_id !== undefined) data.departamento_id = departamentoId;
    if (input.nombre !== undefined) data.nombre = input.nombre.trim();

    if (input.codigo !== undefined) {
      const c = input.codigo.trim();
      await this.assertCodigoMunicipioUnico(departamentoId, c, tenantOrgId, id);
      data.codigo = c;
    }
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.municipio.update({ where: { id }, data });
  }

  async removeMunicipio(id: string, tenantOrgId: string) {
    await this.getMunicipioTenantOr404(id, tenantOrgId);

    const pacientes = await prisma.paciente.count({
      where: { municipio_id: id, deleted: false },
    });
    if (pacientes > 0) {
      throw new HttpError(
        409,
        'MUNICIPIO_EN_USO',
        'No se puede eliminar: hay pacientes que referencian este municipio.',
      );
    }

    await prisma.municipio.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date(), updated_at: new Date() },
    });
  }
}

export const geoCatalogService = new GeoCatalogService();
