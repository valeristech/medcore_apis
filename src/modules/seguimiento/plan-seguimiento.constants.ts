import { EstadoActividadSeguimiento, EstadoPlanSeguimiento } from '../../core/enums/seguimiento.enums.js';

/** Transiciones válidas de `plan_seguimiento.estado`. Vacío = estado terminal. */
export const TRANSICIONES_PLAN_VALIDAS: Record<string, readonly EstadoPlanSeguimiento[]> = {
  [EstadoPlanSeguimiento.Borrador]: [EstadoPlanSeguimiento.Activo, EstadoPlanSeguimiento.Cancelado],
  [EstadoPlanSeguimiento.Activo]: [EstadoPlanSeguimiento.Completado, EstadoPlanSeguimiento.Cancelado],
  [EstadoPlanSeguimiento.Completado]: [],
  [EstadoPlanSeguimiento.Cancelado]: [],
};

export const ESTADOS_PLAN_TERMINALES = [
  EstadoPlanSeguimiento.Completado,
  EstadoPlanSeguimiento.Cancelado,
] as const;

/**
 * Estados de `plan_seguimiento_actividad` asignables manualmente vía
 * `PATCH /actividades/:id`. `indicacion_creada` y `vencida` son manejados
 * exclusivamente por el job diario (UC-SEG-003).
 */
export const ESTADOS_ACTIVIDAD_GESTIONABLES = [
  EstadoActividadSeguimiento.Pendiente,
  EstadoActividadSeguimiento.Completada,
  EstadoActividadSeguimiento.Cancelada,
] as const;

export const PLAN_SORT_BY_VALUES = ['created_at', 'fecha_inicio'] as const;
export type PlanSortBy = (typeof PLAN_SORT_BY_VALUES)[number];

/**
 * Días de antelación para generar automáticamente la `indicacion_seguimiento`
 * de una actividad (cuando `fecha_programada` se acerca). Sin columna de
 * configuración por organización todavía — valor fijo documentado; podría
 * moverse a `organizacion` o a un parámetro del plan en una iteración futura.
 */
export const DIAS_ANTELACION_GENERAR_INDICACION = 7;
