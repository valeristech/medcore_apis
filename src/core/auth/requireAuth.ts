import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendFail } from '../http/response.js';

/**
 * Verifica JWT Bearer y deja el payload en `request.user` (@fastify/jwt).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return sendFail(
      reply,
      request.requestId,
      401,
      'UNAUTHORIZED',
      'Token inválido o ausente.',
    );
  }
}
