/** Estados que no bloquean agenda ni generan conflicto de solapamiento. */
export const CITA_ESTADOS_CANCELADOS = ['cancelada', 'cancelado'] as const;

export const CITA_ESTADO_DEFAULT = 'programada';

export const CITA_ESTADO_CANCELADA = 'cancelada';

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
