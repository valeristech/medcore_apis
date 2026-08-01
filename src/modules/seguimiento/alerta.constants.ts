import { EstadoAlerta } from '../../core/enums/seguimiento.enums.js';

/** Bandeja por defecto cuando `GET /alertas` no filtra por `estado`: solo las activas. */
export const ALERTA_ESTADOS_BANDEJA_DEFAULT = [EstadoAlerta.Activa] as const;

/**
 * Estados asignables vía `PATCH /alertas/:id`. `activa` es el estado inicial
 * (creado por el sistema o manualmente) y no es reasignable por esta acción.
 */
export const ALERTA_ESTADOS_GESTIONABLES = [EstadoAlerta.Gestionada, EstadoAlerta.Cerrada] as const;

export const ALERTA_SORT_BY_VALUES = ['prioridad', 'created_at'] as const;
export type AlertaSortBy = (typeof ALERTA_SORT_BY_VALUES)[number];

/**
 * Rango de urgencia para el orden por defecto ("prioridad y antigüedad"),
 * igual convención que `indicacion-seguimiento.constants.ts`. Sin `$queryRaw`
 * en este repo, se ordena/pagina en memoria para `sortBy=prioridad`.
 */
export const ALERTA_PRIORIDAD_RANK: Record<string, number> = {
  critica: 0,
  alta: 1,
  normal: 2,
  baja: 3,
};

/** Umbral de intentos de contacto sin éxito para generar `paciente_sin_contacto`. */
export const UMBRAL_INTENTOS_SIN_CONTACTO = 3;
