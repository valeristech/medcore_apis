import { DateTime } from 'luxon';
import { HttpError } from '../../core/errors.js';
import type { ExcepcionInput, FranjaInput } from './disponibilidad.schemas.js';

export type IntervalMs = { start: number; end: number };

/** Zona por defecto del motor de calendario (Guatemala). */
export const DEFAULT_IANA_TIMEZONE = 'America/Guatemala';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIanaTimezone(zone: string): boolean {
  const z = zone.trim();
  if (!z) return false;
  return DateTime.now().setZone(z).isValid;
}

export function assertIsoDateRange(desde: string, hasta: string, maxDays: number, zone: string) {
  if (!DATE_RE.test(desde) || !DATE_RE.test(hasta)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Las fechas deben ser YYYY-MM-DD.');
  }
  const d0 = DateTime.fromISO(desde, { zone });
  const d1 = DateTime.fromISO(hasta, { zone });
  if (!d0.isValid || !d1.isValid) {
    throw new HttpError(400, 'BAD_REQUEST', 'Fecha inválida para la zona horaria indicada.');
  }
  const start = d0.startOf('day');
  const end = d1.startOf('day');
  if (start > end) {
    throw new HttpError(400, 'BAD_REQUEST', '`desde` no puede ser posterior a `hasta`.');
  }
  const days = Math.floor(end.diff(start, 'days').days) + 1;
  if (days > maxDays) {
    throw new HttpError(
      400,
      'RANGE_TOO_LARGE',
      `El rango máximo permitido es ${maxDays} días (inclusive).`,
    );
  }
}

/** Días calendario locales consecutivos entre `desde` y `hasta` (inclusive), en la zona IANA. */
export function eachLocalDateInclusive(zone: string, desde: string, hasta: string): string[] {
  const out: string[] = [];
  let cur = DateTime.fromISO(desde, { zone }).startOf('day');
  const end = DateTime.fromISO(hasta, { zone }).startOf('day');
  while (cur <= end) {
    out.push(cur.toISODate()!);
    cur = cur.plus({ days: 1 });
  }
  return out;
}

/** Inicio/fin del día local en instantes UTC (para consultas y recortes). */
export function localDayBoundsUtc(zone: string, localDate: string): { startUtcMs: number; endUtcMs: number } {
  const d = DateTime.fromISO(localDate, { zone }).startOf('day');
  const e = DateTime.fromISO(localDate, { zone }).endOf('day');
  return { startUtcMs: d.toUTC().toMillis(), endUtcMs: e.toUTC().toMillis() };
}

/** Rango UTC que cubre todo el calendario local [desde, hasta] (para filtrar citas). */
export function localRangeToUtcBounds(zone: string, desde: string, hasta: string): { desdeUtc: Date; hastaUtc: Date } {
  const desdeUtc = DateTime.fromISO(desde, { zone }).startOf('day').toUTC().toJSDate();
  const hastaUtc = DateTime.fromISO(hasta, { zone }).endOf('day').toUTC().toJSDate();
  return { desdeUtc, hastaUtc };
}

export function mergeIntervals(intervals: IntervalMs[]): IntervalMs[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IntervalMs[] = [];
  let cur = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.start <= cur.end) {
      cur = { start: cur.start, end: Math.max(cur.end, n.end) };
    } else {
      merged.push(cur);
      cur = n;
    }
  }
  merged.push(cur);
  return merged;
}

export function subtractIntervals(base: IntervalMs[], cuts: IntervalMs[]): IntervalMs[] {
  if (cuts.length === 0) return base;
  let result = [...base];
  for (const c of cuts) {
    const next: IntervalMs[] = [];
    for (const r of result) {
      if (c.end <= r.start || c.start >= r.end) {
        next.push(r);
        continue;
      }
      if (c.start > r.start) next.push({ start: r.start, end: Math.min(c.start, r.end) });
      if (c.end < r.end) next.push({ start: Math.max(c.end, r.start), end: r.end });
    }
    result = next.filter((x) => x.end > x.start);
  }
  return mergeIntervals(result);
}

function parseFranjasJson(value: unknown): FranjaInput[] {
  if (!Array.isArray(value)) return [];
  const out: FranjaInput[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.dia_semana === 'number' &&
      Number.isInteger(o.dia_semana) &&
      o.dia_semana >= 0 &&
      o.dia_semana <= 6 &&
      typeof o.hora_inicio === 'string' &&
      typeof o.hora_fin === 'string'
    ) {
      out.push({
        dia_semana: o.dia_semana,
        hora_inicio: o.hora_inicio,
        hora_fin: o.hora_fin,
      });
    }
  }
  return out;
}

function parseExcepcionesJson(value: unknown): ExcepcionInput[] {
  if (!Array.isArray(value)) return [];
  const out: ExcepcionInput[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.fecha === 'string' && DATE_RE.test(o.fecha)) {
      out.push({
        fecha: o.fecha,
        cerrado: o.cerrado === true,
        franjas: o.franjas !== undefined ? parseFranjasJson(o.franjas) : undefined,
      });
    }
  }
  return out;
}

function toUtcDateOnly(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function ruleAppliesOnDate(
  vigenciaInicio: Date | null,
  vigenciaFin: Date | null,
  fecha: string,
): boolean {
  const fi = vigenciaInicio ? toUtcDateOnly(vigenciaInicio) : null;
  const ff = vigenciaFin ? toUtcDateOnly(vigenciaFin) : null;
  if (fi && fecha < fi) return false;
  if (ff && fecha > ff) return false;
  return true;
}

/** Domingo=0 … sábado=6 (misma convención que `Date.getUTCDay`, aplicada al calendario local). */
export function localWeekdayJs(zone: string, localDateIso: string): number {
  const dt = DateTime.fromISO(localDateIso, { zone });
  const w = dt.weekday;
  return w === 7 ? 0 : w;
}

function franjaToIntervalInZone(fecha: string, f: FranjaInput, zone: string): IntervalMs | null {
  const start = DateTime.fromISO(`${fecha}T${f.hora_inicio}`, { zone });
  const end = DateTime.fromISO(`${fecha}T${f.hora_fin}`, { zone });
  if (!start.isValid || !end.isValid) return null;
  const s = start.toUTC().toMillis();
  const e = end.toUTC().toMillis();
  if (!(e > s)) return null;
  return { start: s, end: e };
}

type ReglaLite = {
  id: string;
  franjas: unknown;
  excepciones: unknown;
  vigencia_inicio: Date | null;
  vigencia_fin: Date | null;
};

/** Ventanas libres por reglas (instantes UTC) para un día calendario local `fecha`. */
export function ventanasDesdeReglasParaDia(reglas: ReglaLite[], fecha: string, zone: string): IntervalMs[] {
  const dow = localWeekdayJs(zone, fecha);
  const intervals: IntervalMs[] = [];

  for (const regla of reglas) {
    if (!ruleAppliesOnDate(regla.vigencia_inicio, regla.vigencia_fin, fecha)) continue;

    const excepciones = parseExcepcionesJson(regla.excepciones);
    const exc = excepciones.find((e) => e.fecha === fecha);
    if (exc?.cerrado) {
      continue;
    }
    if (exc?.franjas && exc.franjas.length > 0) {
      for (const fr of exc.franjas) {
        const iv = franjaToIntervalInZone(fecha, fr, zone);
        if (iv) intervals.push(iv);
      }
      continue;
    }

    const franjas = parseFranjasJson(regla.franjas);
    for (const fr of franjas) {
      if (fr.dia_semana !== dow) continue;
      const iv = franjaToIntervalInZone(fecha, fr, zone);
      if (iv) intervals.push(iv);
    }
  }

  return mergeIntervals(intervals);
}

export function ocupacionesCitaEnDia(
  fecha: string,
  citas: { fecha_hora_inicio: Date; fecha_hora_fin: Date }[],
  zone: string,
): IntervalMs[] {
  const { startUtcMs: dayStart, endUtcMs: dayEnd } = localDayBoundsUtc(zone, fecha);
  const out: IntervalMs[] = [];
  for (const c of citas) {
    const s = c.fecha_hora_inicio.getTime();
    const e = c.fecha_hora_fin.getTime();
    if (e <= dayStart || s >= dayEnd) continue;
    out.push({ start: Math.max(s, dayStart), end: Math.min(e, dayEnd) });
  }
  return mergeIntervals(out);
}

export function huecosEnSlots(
  libre: IntervalMs[],
  ocupadas: IntervalMs[],
  slotMinutos: number,
): IntervalMs[] {
  const slotMs = slotMinutos * 60 * 1000;
  const sinOcupar = subtractIntervals(libre, ocupadas);
  const slots: IntervalMs[] = [];
  for (const w of sinOcupar) {
    let t = w.start;
    while (t + slotMs <= w.end) {
      slots.push({ start: t, end: t + slotMs });
      t += slotMs;
    }
  }
  return slots;
}

export function intervalToIso(iv: IntervalMs) {
  return {
    inicio: new Date(iv.start).toISOString(),
    fin: new Date(iv.end).toISOString(),
  };
}
