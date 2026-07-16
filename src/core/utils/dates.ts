/**
 * Serializa fechas de un row de BD a strings ISO.
 * - fecha_nacimiento → YYYY-MM-DD
 * - created_at, updated_at → ISO 8601 completo
 *
 * Reutilizable por cualquier módulo que devuelva filas con estos campos.
 */
export function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row } as T & Record<string, unknown>;
  const o = out as Record<string, unknown>;

  const fn = o.fecha_nacimiento;
  if (fn instanceof Date) o.fecha_nacimiento = fn.toISOString().slice(0, 10);

  const ca = o.created_at;
  if (ca instanceof Date) o.created_at = ca.toISOString();

  const ua = o.updated_at;
  if (ua instanceof Date) o.updated_at = ua.toISOString();

  return out as T;
}

/**
 * Serializa una columna de fecha con nombre distinto a fecha_nacimiento/created_at/updated_at
 * (ej. `fecha`, `fecha_resultado`, `fecha_firma`). Pensado para encadenar con serializeDates():
 *
 *   serializeExtraFecha(serializeDates(row), 'fecha_resultado')
 */
export function serializeExtraFecha<T extends Record<string, unknown>>(row: T, campo: string): T {
  const out = { ...row } as T & Record<string, unknown>;
  const o = out as Record<string, unknown>;

  const v = o[campo];
  if (v instanceof Date) o[campo] = v.toISOString();

  return out as T;
}
