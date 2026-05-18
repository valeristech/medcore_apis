export const RECORDATORIO_CANALES = ['whatsapp', 'sms', 'email'] as const;
export type RecordatorioCanal = (typeof RECORDATORIO_CANALES)[number];

export const RECORDATORIO_HORAS_MIN = 1;
export const RECORDATORIO_HORAS_MAX = 168;

/** Citas elegibles para recordatorio automático. */
export const CITA_ESTADOS_RECORDATORIO = ['programada', 'confirmada'] as const;

export const RECORDATORIO_ESTADO_ENVIADO = 'enviado';
export const RECORDATORIO_ESTADO_FALLIDO = 'fallido';
