/** Estados que no bloquean agenda ni generan conflicto de solapamiento. */
export const CITA_ESTADOS_CANCELADOS = ['cancelada', 'cancelado', 'no_asistio', 'no_asistió'] as const;

export const CITA_ESTADO_DEFAULT = 'programada';

export const CITA_ESTADO_CANCELADA = 'cancelada';

/** Estado persistido al marcar no-show (UC-AGE-006). */
export const CITA_ESTADO_NO_ASISTIO = 'no_asistio';

/** Estados en los que la secretaría puede marcar no-show. */
export const CITA_ESTADOS_MARCABLES_NO_SHOW = ['programada', 'confirmada'] as const;

/** Tipos de alerta_preventiva usados desde agenda. */
export const ALERTA_TIPO_PERSONALIZADA = 'personalizada';

/** Estados en los que se permite mover fecha/hora o recursos (reagendar). */
export const CITA_ESTADOS_REAGENDABLES = ['programada', 'confirmada'] as const;

/** Estados en los que no se permite reagendar ni cancelar. */
export const CITA_ESTADOS_NO_MODIFICABLES = [
  'cancelada',
  'cancelado',
  'completada',
  'en_curso',
  'no_asistio',
  'no_asistió',
] as const;
