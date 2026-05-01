import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import type { SearchAuditLogsQuery } from './audit-log.schemas.js';

export class AuditLogService {
  async list(tenantOrgId: string) {
    return prisma.audit_log.findMany({
      where: { organizacion_id: tenantOrgId },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
  }

  async getById(id: string, tenantOrgId: string) {
    const row = await prisma.audit_log.findFirst({
      where: { id, organizacion_id: tenantOrgId },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Evento de auditoría no encontrado.');
    return row;
  }

  async search(tenantOrgId: string, query: SearchAuditLogsQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'fecha';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.audit_logWhereInput = {
      organizacion_id: tenantOrgId,
      ...(query.organizacion_id ? { organizacion_id: query.organizacion_id.trim() } : {}),
      ...(query.usuario_id ? { usuario_id: query.usuario_id.trim() } : {}),
      ...(query.accion ? { accion: { contains: query.accion.trim(), mode: 'insensitive' } } : {}),
      ...(query.recurso ? { recurso: { contains: query.recurso.trim(), mode: 'insensitive' } } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.audit_log.count({ where }),
      prisma.audit_log.findMany({
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
        organizacion_id: query.organizacion_id,
        usuario_id: query.usuario_id,
        accion: query.accion,
        recurso: query.recurso,
      },
    };
  }
}

export const auditLogService = new AuditLogService();
