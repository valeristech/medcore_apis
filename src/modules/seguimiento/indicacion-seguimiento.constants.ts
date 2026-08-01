import { EstadoIndicacionSeguimiento } from '../../core/enums/seguimiento.enums.js';

/**
 * Estados asignables vía `PUT /indicaciones-seguimiento/:id` (gestión de secretaría).
 * `agendada` es terminal y solo se alcanza a través de la acción dedicada
 * `POST /indicaciones-seguimiento/:id/agendar-cita`.
 */
export const ESTADOS_GESTIONABLES = [
  EstadoIndicacionSeguimiento.Pendiente,
  EstadoIndicacionSeguimiento.EnGestion,
  EstadoIndicacionSeguimiento.NoContactado,
] as const;

/**
 * Bandeja por defecto cuando `GET /indicaciones-seguimiento` no filtra por `estado`.
 * Coincide exactamente con `idx_indicacion_pendientes` en `schema.prisma`.
 */
export const ESTADOS_BANDEJA_DEFAULT = [
  EstadoIndicacionSeguimiento.Pendiente,
  EstadoIndicacionSeguimiento.EnGestion,
  EstadoIndicacionSeguimiento.NoContactado,
] as const;

export const INDICACION_SORT_BY_VALUES = ['prioridad', 'created_at'] as const;
export type IndicacionSortBy = (typeof INDICACION_SORT_BY_VALUES)[number];

/**
 * Rango de urgencia para el orden por defecto ("prioridad y antigüedad").
 * No existe una columna numérica ni convención de `$queryRaw` en este repo,
 * así que para `sortBy=prioridad` se pagina en memoria tras ordenar por rango.
 * Si la bandeja crece mucho, esto puede migrarse a una expresión SQL (CASE).
 */
export const PRIORIDAD_RANK: Record<string, number> = {
  critica: 0,
  alta: 1,
  normal: 2,
  baja: 3,
};
