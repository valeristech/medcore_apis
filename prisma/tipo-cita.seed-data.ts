/**
 * Catálogo inicial de tipos de cita por organización (idempotente vía UUID fijos en seed).
 * Alineado con casos de uso de agenda, HCE, telemedicina y facturación.
 */
export const TIPO_CITA_SEED_IDS = {
  primeraVez: '33333333-3333-4333-8333-333333333301',
  control: '33333333-3333-4333-8333-333333333302',
  general: '33333333-3333-4333-8333-333333333303',
  urgencia: '33333333-3333-4333-8333-333333333304',
  interconsulta: '33333333-3333-4333-8333-333333333305',
  procedimiento: '33333333-3333-4333-8333-333333333306',
  telemedicina: '33333333-3333-4333-8333-333333333307',
  valoracion: '33333333-3333-4333-8333-333333333308',
} as const;

export type TipoCitaSeedRow = {
  id: string;
  nombre: string;
  duracion_minutos: number;
  color: string;
  aplica_telemedicina: boolean;
};

export const TIPOS_CITA_SEED: readonly TipoCitaSeedRow[] = [
  {
    id: TIPO_CITA_SEED_IDS.primeraVez,
    nombre: 'Consulta primera vez',
    duracion_minutos: 45,
    color: '#2563EB',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.control,
    nombre: 'Consulta de control',
    duracion_minutos: 20,
    color: '#16A34A',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.general,
    nombre: 'Consulta general',
    duracion_minutos: 30,
    color: '#38BDF8',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.urgencia,
    nombre: 'Urgencia / walk-in',
    duracion_minutos: 15,
    color: '#DC2626',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.interconsulta,
    nombre: 'Interconsulta',
    duracion_minutos: 45,
    color: '#7C3AED',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.procedimiento,
    nombre: 'Procedimiento ambulatorio',
    duracion_minutos: 60,
    color: '#EA580C',
    aplica_telemedicina: false,
  },
  {
    id: TIPO_CITA_SEED_IDS.telemedicina,
    nombre: 'Telemedicina',
    duracion_minutos: 30,
    color: '#0891B2',
    aplica_telemedicina: true,
  },
  {
    id: TIPO_CITA_SEED_IDS.valoracion,
    nombre: 'Valoración / preoperatorio',
    duracion_minutos: 30,
    color: '#6B7280',
    aplica_telemedicina: false,
  },
] as const;
