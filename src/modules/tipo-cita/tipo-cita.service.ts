import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import type {
  CreateTipoCitaInput,
  ListTiposCitaQuery,
  UpdateTipoCitaInput,
} from './tipo-cita.schemas.js';
import { assertDuracionMinutos, normalizeTipoCitaColor } from './tipo-cita.validation.js';

export class TipoCitaService {
  private async getTenantOr404(tenantOrgId: string) {
    const org = await prisma.organizacion.findFirst({
      where: { id: tenantOrgId, deleted: false },
      select: { id: true },
    });
    if (!org) throw new HttpError(404, 'NOT_FOUND', 'Organización no encontrada.');
  }

  private async getTipoCitaTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.tipo_cita.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Tipo de cita no encontrado.');
    return row;
  }

  private async assertNombreUnico(nombre: string, tenantOrgId: string, excludeId?: string) {
    const exists = await prisma.tipo_cita.findFirst({
      where: {
        organizacion_id: tenantOrgId,
        deleted: false,
        nombre: { equals: nombre.trim(), mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) {
      throw new HttpError(
        409,
        'NOMBRE_DUPLICADO',
        'Ya existe un tipo de cita con ese nombre en la organización.',
      );
    }
  }

  async list(tenantOrgId: string, query: ListTiposCitaQuery) {
    const q = query.q?.trim();
    const activoFilter =
      query.incluir_inactivos === true ? {} : { activo: true as const };

    const where: Prisma.tipo_citaWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...activoFilter,
      ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}),
    };

    const items = await prisma.tipo_cita.findMany({
      where,
      orderBy: [{ nombre: 'asc' }],
    });
    return { items };
  }

  async create(tenantOrgId: string, input: CreateTipoCitaInput) {
    await this.getTenantOr404(tenantOrgId);

    const nombre = input.nombre.trim();
    if (nombre.length < 2) {
      throw new HttpError(400, 'NOMBRE_INVALIDO', 'El nombre debe tener al menos 2 caracteres.');
    }

    assertDuracionMinutos(input.duracion_minutos);
    await this.assertNombreUnico(nombre, tenantOrgId);

    return prisma.tipo_cita.create({
      data: {
        organizacion_id: tenantOrgId,
        nombre,
        duracion_minutos: input.duracion_minutos,
        color: normalizeTipoCitaColor(input.color),
        aplica_telemedicina: input.aplica_telemedicina ?? false,
        activo: input.activo ?? true,
        deleted: false,
      },
    });
  }

  async getById(id: string, tenantOrgId: string) {
    return this.getTipoCitaTenantOr404(id, tenantOrgId);
  }

  async update(id: string, tenantOrgId: string, input: UpdateTipoCitaInput) {
    await this.getTipoCitaTenantOr404(id, tenantOrgId);

    const data: Prisma.tipo_citaUncheckedUpdateInput = {};

    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (nombre.length < 2) {
        throw new HttpError(400, 'NOMBRE_INVALIDO', 'El nombre debe tener al menos 2 caracteres.');
      }
      await this.assertNombreUnico(nombre, tenantOrgId, id);
      data.nombre = nombre;
    }
    if (input.duracion_minutos !== undefined) {
      assertDuracionMinutos(input.duracion_minutos);
      data.duracion_minutos = input.duracion_minutos;
    }
    if (input.color !== undefined) data.color = normalizeTipoCitaColor(input.color);
    if (input.aplica_telemedicina !== undefined) data.aplica_telemedicina = input.aplica_telemedicina;
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.tipo_cita.update({ where: { id }, data });
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getTipoCitaTenantOr404(id, tenantOrgId);

    const [citas, listaEspera] = await Promise.all([
      prisma.cita.count({ where: { tipo_cita_id: id, deleted: false } }),
      prisma.lista_espera.count({ where: { tipo_cita_id: id, deleted: false } }),
    ]);

    if (citas > 0 || listaEspera > 0) {
      throw new HttpError(
        409,
        'TIPO_CITA_EN_USO',
        'No se puede eliminar: hay citas o registros en lista de espera que usan este tipo.',
      );
    }

    await prisma.tipo_cita.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const tipoCitaService = new TipoCitaService();
