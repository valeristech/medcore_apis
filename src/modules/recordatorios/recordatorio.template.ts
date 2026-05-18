import { DateTime } from 'luxon';
import { DEFAULT_IANA_TIMEZONE } from '../disponibilidad/disponibilidad.calendario.js';

export type RecordatorioTemplateVars = {
  paciente_nombre: string;
  fecha: string;
  hora: string;
  medico: string;
  sede: string;
  tipo_cita: string;
};

export type CitaRecordatorioContext = {
  paciente: { nombre: string; apellido: string };
  usuario: { nombre: string; apellido: string };
  sede: { nombre: string };
  tipo_cita: { nombre: string };
  fecha_hora_inicio: Date;
  zona_horaria?: string | null;
};

export function buildRecordatorioVars(cita: CitaRecordatorioContext): RecordatorioTemplateVars {
  const tz = cita.zona_horaria?.trim() || DEFAULT_IANA_TIMEZONE;
  const local = DateTime.fromJSDate(cita.fecha_hora_inicio, { zone: 'utc' }).setZone(tz);

  return {
    paciente_nombre: `${cita.paciente.nombre} ${cita.paciente.apellido}`.trim(),
    fecha: local.setLocale('es').toFormat('dd/LL/yyyy'),
    hora: local.toFormat('HH:mm'),
    medico: `${cita.usuario.nombre} ${cita.usuario.apellido}`.trim(),
    sede: cita.sede.nombre,
    tipo_cita: cita.tipo_cita.nombre,
  };
}

export function renderRecordatorioTexto(plantilla: string, vars: RecordatorioTemplateVars): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key as keyof RecordatorioTemplateVars];
    return v ?? `{${key}}`;
  });
}
