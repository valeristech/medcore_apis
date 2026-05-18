import { HttpError } from '../../core/errors.js';
import {
  TIPO_CITA_COLOR_RE,
  TIPO_CITA_DURACION_MAX,
  TIPO_CITA_DURACION_MIN,
} from './tipo-cita.constants.js';
import { cleanStr } from '../../core/utils/strings.js';

export function assertDuracionMinutos(duracion: number): void {
  if (duracion < TIPO_CITA_DURACION_MIN || duracion > TIPO_CITA_DURACION_MAX) {
    throw new HttpError(
      400,
      'DURACION_INVALIDA',
      `La duración debe estar entre ${TIPO_CITA_DURACION_MIN} y ${TIPO_CITA_DURACION_MAX} minutos.`,
    );
  }
}

export function normalizeTipoCitaColor(value: string | null | undefined): string | null {
  const c = cleanStr(value);
  if (!c) return null;
  if (!TIPO_CITA_COLOR_RE.test(c)) {
    throw new HttpError(400, 'COLOR_INVALIDO', 'El color debe ser hexadecimal (#RGB o #RRGGBB).');
  }
  return c.toUpperCase();
}
