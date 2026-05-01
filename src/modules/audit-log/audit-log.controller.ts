import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendOk } from '../../core/http/response.js';
import type { SearchAuditLogsQuery } from './audit-log.schemas.js';
import { auditLogService } from './audit-log.service.js';

export const auditLogController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const items = await auditLogService.list(request.user.organizacion_id);
    return sendOk(reply, request.requestId, { items });
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const auditLog = await auditLogService.getById(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { auditLog });
  },

  async search(request: FastifyRequest, reply: FastifyReply) {
    const result = await auditLogService.search(
      request.user.organizacion_id,
      request.query as SearchAuditLogsQuery,
    );
    return sendOk(reply, request.requestId, result);
  },
};
