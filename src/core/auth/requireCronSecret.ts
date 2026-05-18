import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnv } from '../env.js';
import { sendFail } from '../http/response.js';

export function requireCronSecret(env: AppEnv) {
  return async function requireCronSecretHandler(request: FastifyRequest, reply: FastifyReply) {
    const secret = env.CRON_SECRET?.trim();
    if (!secret) {
      return sendFail(
        reply,
        request.requestId,
        503,
        'CRON_NOT_CONFIGURED',
        'CRON_SECRET no está configurado en el servidor.',
      );
    }

    const headerSecret = request.headers['x-cron-secret'];
    const bearer = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7).trim()
      : '';

    const provided =
      (typeof headerSecret === 'string' ? headerSecret.trim() : '') || bearer;

    if (provided !== secret) {
      return sendFail(reply, request.requestId, 401, 'UNAUTHORIZED', 'Secreto de cron inválido.');
    }
  };
}
