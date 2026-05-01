import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isHttpError } from '../errors.js';
import { sendFail } from '../http/response.js';

function hasValidation(err: unknown): err is FastifyError & { validation: unknown } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'validation' in err &&
    (err as FastifyError).validation !== undefined &&
    (err as FastifyError).validation !== null
  );
}

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId;

    if (reply.sent) {
      request.log.error({ err: error, requestId }, error.message);
      return;
    }

    if (isHttpError(error)) {
      return sendFail(reply, requestId, error.statusCode, error.code, error.message);
    }

    if (hasValidation(error)) {
      return sendFail(reply, requestId, 400, 'VALIDATION_ERROR', 'Datos de entrada inválidos.', {
        validation: error.validation,
      });
    }

    if (error.statusCode === 429) {
      return sendFail(
        reply,
        requestId,
        429,
        'RATE_LIMIT_EXCEEDED',
        error.message || 'Demasiadas peticiones. Intenta de nuevo más tarde.',
      );
    }

    if (
      error.statusCode === 401 &&
      typeof error.code === 'string' &&
      error.code.startsWith('FST_JWT')
    ) {
      return sendFail(
        reply,
        requestId,
        401,
        'UNAUTHORIZED',
        'Token inválido o expirado.',
      );
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId }, error.message);
      const isProd = process.env.NODE_ENV === 'production';
      const message = isProd ? 'Error interno del servidor.' : error.message;
      return sendFail(reply, requestId, 500, 'INTERNAL_ERROR', message);
    }

    request.log.warn({ err: error, requestId }, error.message);
    const code = typeof error.code === 'string' ? error.code : 'REQUEST_ERROR';
    return sendFail(reply, requestId, statusCode, code, error.message);
  });
}
