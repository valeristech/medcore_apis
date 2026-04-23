import type { FastifyInstance } from 'fastify';

/**
 * Registro estructurado de acceso (auditoría ligera). Más adelante se puede enriquecer
 * con usuario, IP persistida en audit_log, etc.
 */
export async function registerAuditAccess(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    const responseTimeMs = reply.elapsedTime;

    request.log.info({
      audit: 'http_access',
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs,
    });
  });
}
