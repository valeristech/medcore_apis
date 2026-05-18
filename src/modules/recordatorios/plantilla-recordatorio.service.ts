import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { cleanStr } from '../../core/utils/strings.js';
import {
  RECORDATORIO_CANALES,
  RECORDATORIO_HORAS_MAX,
  RECORDATORIO_HORAS_MIN,
  type RecordatorioCanal,
} from './recordatorio.constants.js';
import type {
  CreatePlantillaRecordatorioInput,
  ListPlantillasRecordatorioQuery,
  UpdatePlantillaRecordatorioInput,
} from './plantilla-recordatorio.schemas.js';

function assertCanal(canal: string): RecordatorioCanal {
  if (!(RECORDATORIO_CANALES as readonly string[]).includes(canal)) {
    throw new HttpError(
      400,
      'CANAL_INVALIDO',
      `Canal debe ser uno de: ${RECORDATORIO_CANALES.join(', ')}.`,
    );
  }
  return canal as RecordatorioCanal;
}

function assertHorasAntes(horas: number): void {
  if (horas < RECORDATORIO_HORAS_MIN || horas > RECORDATORIO_HORAS_MAX) {
    throw new HttpError(
      400,
      'HORAS_ANTES_INVALIDO',
      `horas_antes debe estar entre ${RECORDATORIO_HORAS_MIN} y ${RECORDATORIO_HORAS_MAX}.`,
    );
  }
}

export class PlantillaRecordatorioService {
  private async getPlantillaTenantOr404(id: string, tenantOrgId: string) {
    const row = await prisma.plantilla_recordatorio.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Plantilla de recordatorio no encontrada.');
    return row;
  }

  async list(tenantOrgId: string, query: ListPlantillasRecordatorioQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const activoFilter = query.incluir_inactivos === true ? {} : { activo: true as const };

    const where: Prisma.plantilla_recordatorioWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      ...activoFilter,
      ...(query.canal ? { canal: query.canal } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.plantilla_recordatorio.count({ where }),
      prisma.plantilla_recordatorio.findMany({
        where,
        orderBy: [{ horas_antes: 'desc' }, { canal: 'asc' }],
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
    };
  }

  async create(tenantOrgId: string, input: CreatePlantillaRecordatorioInput) {
    const canal = assertCanal(input.canal);
    assertHorasAntes(input.horas_antes);
    const texto = input.texto.trim();
    if (texto.length < 5) {
      throw new HttpError(400, 'TEXTO_INVALIDO', 'El texto de la plantilla debe tener al menos 5 caracteres.');
    }

    return prisma.plantilla_recordatorio.create({
      data: {
        organizacion_id: tenantOrgId,
        canal,
        horas_antes: input.horas_antes,
        asunto: cleanStr(input.asunto) ?? null,
        texto,
        activo: input.activo ?? true,
        deleted: false,
      },
    });
  }

  async getById(id: string, tenantOrgId: string) {
    return this.getPlantillaTenantOr404(id, tenantOrgId);
  }

  async update(id: string, tenantOrgId: string, input: UpdatePlantillaRecordatorioInput) {
    await this.getPlantillaTenantOr404(id, tenantOrgId);

    const data: Prisma.plantilla_recordatorioUncheckedUpdateInput = {};
    if (input.canal !== undefined) data.canal = assertCanal(input.canal);
    if (input.horas_antes !== undefined) {
      assertHorasAntes(input.horas_antes);
      data.horas_antes = input.horas_antes;
    }
    if (input.asunto !== undefined) data.asunto = cleanStr(input.asunto) ?? null;
    if (input.texto !== undefined) {
      const texto = input.texto.trim();
      if (texto.length < 5) {
        throw new HttpError(400, 'TEXTO_INVALIDO', 'El texto de la plantilla debe tener al menos 5 caracteres.');
      }
      data.texto = texto;
    }
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.plantilla_recordatorio.update({ where: { id }, data });
  }

  async remove(id: string, tenantOrgId: string) {
    await this.getPlantillaTenantOr404(id, tenantOrgId);
    await prisma.plantilla_recordatorio.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date(), activo: false },
    });
  }
}

export const plantillaRecordatorioService = new PlantillaRecordatorioService();
