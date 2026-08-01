// UC-SEG-001 — Médico indica seguimiento
export enum TipoIndicacionSeguimiento {
  CitaControl = 'cita_control',
  Estudio = 'estudio',
  Vacuna = 'vacuna',
  Procedimiento = 'procedimiento',
  Otro = 'otro',
}
export const TIPO_INDICACION_SEGUIMIENTO_VALUES = Object.values(
  TipoIndicacionSeguimiento,
) as [string, ...string[]];

/**
 * `pendiente`/`en_gestion`/`no_contactado` están confirmados por
 * `idx_indicacion_pendientes` en `schema.prisma`. `agendada` (estado terminal,
 * UC-SEG-002) queda confirmado por el enunciado del ticket. No agregar más
 * valores sin confirmar el CHECK constraint real de la tabla.
 */
export enum EstadoIndicacionSeguimiento {
  Pendiente = 'pendiente',
  EnGestion = 'en_gestion',
  NoContactado = 'no_contactado',
  Agendada = 'agendada',
}
export const ESTADO_INDICACION_SEGUIMIENTO_VALUES = Object.values(
  EstadoIndicacionSeguimiento,
) as [string, ...string[]];

// UC-SEG-003 — Plan de seguimiento paciente crónico

/**
 * `borrador` (default) y `activo` están confirmados (`idx_plan_activos` filtra
 * por `estado='activo'`). `completado`/`cancelado` se infieren de las columnas
 * `completado_por`/`fecha_completado`/`motivo_cierre` — no confirmados por un
 * CHECK constraint real; ajustar si la migración real usa otros valores.
 */
export enum EstadoPlanSeguimiento {
  Borrador = 'borrador',
  Activo = 'activo',
  Completado = 'completado',
  Cancelado = 'cancelado',
}
export const ESTADO_PLAN_SEGUIMIENTO_VALUES = Object.values(
  EstadoPlanSeguimiento,
) as [string, ...string[]];

/**
 * `pendiente` (default) e `indicacion_creada` están confirmados por
 * `idx_plan_act_pendientes` en `schema.prisma`. `vencida` queda confirmado por
 * el enunciado de UC-SEG-003 ("marcar actividades vencidas"). `completada`/
 * `cancelada` se infieren de `resultado_resumen`/`gestionada_por`/
 * `fecha_gestion` — no confirmados por un CHECK constraint real.
 */
export enum EstadoActividadSeguimiento {
  Pendiente = 'pendiente',
  IndicacionCreada = 'indicacion_creada',
  Vencida = 'vencida',
  Completada = 'completada',
  Cancelada = 'cancelada',
}
export const ESTADO_ACTIVIDAD_SEGUIMIENTO_VALUES = Object.values(
  EstadoActividadSeguimiento,
) as [string, ...string[]];

// UC-SEG-004 — Alertas preventivas

/**
 * Todos los valores están tomados textualmente del enunciado de UC-SEG-004
 * ("control vencido, actividad pendiente, paciente sin contacto, plan
 * abandonado, preventivo anual, personalizada"). `Personalizada` coincide con
 * `ALERTA_TIPO_PERSONALIZADA` ya usado por `cita.service.ts` (no-show).
 */
export enum TipoAlerta {
  ControlVencido = 'control_vencido',
  ActividadPendiente = 'actividad_pendiente',
  PacienteSinContacto = 'paciente_sin_contacto',
  PlanAbandonado = 'plan_abandonado',
  PreventivoAnual = 'preventivo_anual',
  Personalizada = 'personalizada',
}
export const TIPO_ALERTA_VALUES = Object.values(TipoAlerta) as [string, ...string[]];

/**
 * `activa` (default) está confirmado por `idx_alerta_activas`/`idx_alerta_visible`
 * en `schema.prisma` y por el ejemplo del ticket (`GET /alertas?estado=activa`).
 * `gestionada` y `cerrada` están confirmados por el enunciado ("marcar como
 * gestionada" y el PATCH "(gestionar/cerrar)").
 */
export enum EstadoAlerta {
  Activa = 'activa',
  Gestionada = 'gestionada',
  Cerrada = 'cerrada',
}
export const ESTADO_ALERTA_VALUES = Object.values(EstadoAlerta) as [string, ...string[]];

/**
 * `ambos` (default) está confirmado en `schema.prisma` y ya usado por
 * `cita.service.ts`. `medico`/`secretaria` se infieren de la separación de
 * roles usada en todo el módulo de seguimiento; no confirmados por un CHECK
 * constraint real — ajustar si la migración real usa otros valores.
 */
export enum VisibleParaAlerta {
  Medico = 'medico',
  Secretaria = 'secretaria',
  Ambos = 'ambos',
}
export const VISIBLE_PARA_ALERTA_VALUES = Object.values(VisibleParaAlerta) as [string, ...string[]];
