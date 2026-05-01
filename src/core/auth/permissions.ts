/**
 * Evalúa permisos del rol (JSON en BD / claims JWT).
 * Convención: `permisos[recurso]` puede ser `true`, `"*"`, o un array de acciones permitidas.
 */
export function hasPermission(
  permisos: Record<string, unknown>,
  recurso: string,
  accion?: string,
): boolean {
  const mod = permisos[recurso];

  if (accion === undefined || accion === '') {
    return mod === true || mod === '*';
  }

  if (mod === '*') return true;

  if (Array.isArray(mod)) {
    return mod.some((v) => v === accion || v === '*');
  }

  return false;
}
