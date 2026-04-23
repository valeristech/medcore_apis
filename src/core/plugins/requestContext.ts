import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const HEADER = 'x-request-id';

function readIncomingId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Asigna requestId (header entrante o UUID), lo propaga en la respuesta y deja trazas mínimas.
 */
export async function registerRequestContext(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const incoming =
      readIncomingId(request.headers[HEADER]) ??
      readIncomingId(request.headers['X-Request-Id']);
    const requestId = incoming ?? randomUUID();
    request.requestId = requestId;
    reply.header(HEADER, requestId);
  });
}
