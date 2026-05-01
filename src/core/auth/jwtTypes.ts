/** Claims del access token JWT (Sprint 2). */
export type JwtAccessPayload = {
  sub: string;
  organizacion_id: string;
  rol_id: string;
  permisos: Record<string, unknown>;
};
