import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates, serializeExtraFecha } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoAlerta } from '../../core/enums/seguimiento.enums.js';
import { Prioridad } from '../../core/enums/comun.enums.js';
import {
  ALERTA_ESTADOS_BANDEJA_DEFAULT,
  ALERTA_ESTADOS_GESTIONABLES,
  ALERTA_PRIORIDAD_RANK,
  type AlertaSortBy,
} from './alerta.constants.js';
import type { GestionarAlertaInput, ListAlertasQuery } from './alerta.schemas.js';

const ALERTA_INCLUDE = {
  paciente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  usuario: { select: { id: true, nombre: true, apellido: true } },
} as const;

type AlertaPayload = Prisma.alerta_preventivaGetPayload<{ include: typeof ALERTA_INCLUDE }>;

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapAlerta(row: AlertaPayload) {
  const serialized = serializeExtraFecha(serializeDates(row), 'fecha_gestion');

  return {
    ...serialized,
    fecha_vencimiento: toDateOnly(row.fecha_vencimiento),
  };
}

function rankPrioridad(prioridad: string | null): number {
  return ALERTA_PRIORIDAD_RANK[prioridad ?? ''] ?? ALERTA_PRIORIDAD_RANK[Prioridad.Normal];
}

export class AlertaService {
  private async getAlertaTenantOr404(id: string, tenantOrgId: string): Promise<AlertaPayload> {
    const row = await prisma.alerta_preventiva.findFirst({
      where: { id, organizacion_id: tenantOrgId, deleted: false },
      include: ALERTA_INCLUDE,
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Alerta no encontrada.');
    return row;
  }

  async listar(tenantOrgId: string, query: ListAlertasQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy: AlertaSortBy = query.sortBy ?? 'prioridad';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

    const where: Prisma.alerta_preventivaWhereInput = {
      organizacion_id: tenantOrgId,
      deleted: false,
      estado: query.estado ? query.estado : { in: [...ALERTA_ESTADOS_BANDEJA_DEFAULT] },
      ...(query.visible_para ? { visible_para: query.visible_para } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.paciente_id ? { paciente_id: query.paciente_id } : {}),
    };

    if (sortBy === 'created_at') {
      const [total, rows] = await prisma.$transaction([
        prisma.alerta_preventiva.count({ where }),
        prisma.alerta_preventiva.findMany({
          where,
          include: ALERTA_INCLUDE,
          orderBy: { created_at: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(mapAlerta),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        sort: { sortBy, sortOrder },
      };
    }

    // sortBy === 'prioridad' (default): urgencia + antigüedad, en memoria (ver constants.ts).
    const all = await prisma.alerta_preventiva.findMany({
      where,
      include: ALERTA_INCLUDE,
      orderBy: { created_at: 'asc' },
    });

    const ranked = all
      .slice()
      .sort(
        (a, b) =>
          rankPrioridad(a.prioridad) - rankPrioridad(b.prioridad) ||
          (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0),
      );

    const total = ranked.length;
    const start = (page - 1) * pageSize;
    const pageItems = ranked.slice(start, start + pageSize);

    return {
      items: pageItems.map(mapAlerta),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      sort: { sortBy, sortOrder: 'asc' as const },
    };
  }

  async gestionar(id: string, tenantOrgId: string, actorId: string, input: GestionarAlertaInput) {
    const current = await this.getAlertaTenantOr404(id, tenantOrgId);

    if (current.estado === EstadoAlerta.Cerrada) {
      throw new HttpError(409, 'ALERTA_CERRADA', 'La alerta ya está cerrada; no se puede modificar.');
    }

    if (!(ALERTA_ESTADOS_GESTIONABLES as readonly string[]).includes(input.estado)) {
      throw new HttpError(
        400,
        'ESTADO_NO_PERMITIDO',
        `estado debe ser uno de: ${ALERTA_ESTADOS_GESTIONABLES.join(', ')}.`,
      );
    }

    const updated = await prisma.alerta_preventiva.update({
      where: { id },
      data: {
        estado: input.estado,
        gestionada_por: actorId,
        fecha_gestion: new Date(),
        notas_gestion: cleanStr(input.notas) ?? current.notas_gestion,
      },
      include: ALERTA_INCLUDE,
    });

    return mapAlerta(updated);
  }
}

export const alertaService = new AlertaService();
