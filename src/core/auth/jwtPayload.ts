import type { JwtAccessPayload } from './jwtTypes.js';

export function permisosFromRolJson(permisos: unknown): Record<string, unknown> {
  if (
    permisos !== null &&
    typeof permisos === 'object' &&
    !Array.isArray(permisos)
  ) {
    return permisos as Record<string, unknown>;
  }
  return {};
}

export function buildAccessPayload(input: {
  usuarioId: string;
  organizacion_id: string;
  rol_id: string;
  permisos: unknown;
}): JwtAccessPayload {
  return {
    sub: input.usuarioId,
    organizacion_id: input.organizacion_id,
    rol_id: input.rol_id,
    permisos: permisosFromRolJson(input.permisos),
  };
}
