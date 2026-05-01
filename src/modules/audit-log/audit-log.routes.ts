import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { auditLogController } from './audit-log.controller.js';
import {
  getAuditLogSchema,
  listAuditLogsSchema,
  searchAuditLogsSchema,
} from './audit-log.schemas.js';

const pAuditoria = requirePermission('auditoria', '*');

export const auditLogRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/audit-logs',
    {
      ...listAuditLogsSchema,
      preHandler: [requireAuth, pAuditoria],
    },
    auditLogController.list,
  );

  app.get(
    '/audit-logs/search',
    {
      ...searchAuditLogsSchema,
      preHandler: [requireAuth, pAuditoria],
    },
    auditLogController.search,
  );

  app.get(
    '/audit-logs/:id',
    {
      ...getAuditLogSchema,
      preHandler: [requireAuth, pAuditoria],
    },
    auditLogController.getById,
  );
};
