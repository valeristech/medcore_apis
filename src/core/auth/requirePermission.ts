import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendFail } from '../http/response.js';
import { hasPermission } from './permissions.js';

/**
 * RBAC sobre claims del access token (`permisos` emitidos en login/refresh).
 * Debe usarse después de `requireAuth`.
 */
export function requirePermission(recurso: string, accion?: string) {
  return async function requirePermissionHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const permisos = request.user?.permisos;
    if (!permisos || !hasPermission(permisos, recurso, accion)) {
      return sendFail(
        reply,
        request.requestId,
        403,
        'FORBIDDEN',
        'No tienes permiso para esta operación.',
      );
    }
  };
}
