import { DateTime } from 'luxon';
import { HttpError } from '../../core/errors.js';

export function parseCitaInstant(value: string, field: string): Date {
  const s = value.trim();
  const dt = DateTime.fromISO(s, { setZone: true });
  if (!dt.isValid) {
    throw new HttpError(400, 'FECHA_INVALIDA', `\`${field}\` no es una fecha/hora ISO válida.`);
  }
  return dt.toUTC().toJSDate();
}

export function resolveCitaFin(
  inicio: Date,
  fechaHoraFinInput: string | null | undefined,
  duracionMinutosTipo: number,
): Date {
  if (fechaHoraFinInput !== undefined && fechaHoraFinInput !== null && String(fechaHoraFinInput).trim() !== '') {
    return parseCitaInstant(String(fechaHoraFinInput), 'fecha_hora_fin');
  }
  return new Date(inicio.getTime() + duracionMinutosTipo * 60 * 1000);
}

export function assertRangoCitaValido(inicio: Date, fin: Date): void {
  if (fin.getTime() <= inicio.getTime()) {
    throw new HttpError(400, 'RANGO_INVALIDO', '`fecha_hora_fin` debe ser posterior a `fecha_hora_inicio`.');
  }
}
