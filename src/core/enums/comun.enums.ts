/**
 * Prioridad genérica: reusada por `alerta_preventiva`, `cita` (no-show → alerta)
 * e `indicacion_seguimiento`. No crear una versión local por módulo.
 */
export enum Prioridad {
  Baja = 'baja',
  Normal = 'normal',
  Alta = 'alta',
  Critica = 'critica',
}
export const PRIORIDAD_VALUES = Object.values(Prioridad) as [string, ...string[]];
