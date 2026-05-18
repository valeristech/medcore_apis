export const PLANTILLA_RECORDATORIO_SEED_IDS = {
  email24h: '44444444-4444-4444-8444-444444444401',
  sms2h: '44444444-4444-4444-8444-444444444402',
} as const;

export type PlantillaRecordatorioSeedRow = {
  id: string;
  canal: 'email' | 'sms' | 'whatsapp';
  horas_antes: number;
  asunto: string | null;
  texto: string;
};

export const PLANTILLAS_RECORDATORIO_SEED: readonly PlantillaRecordatorioSeedRow[] = [
  {
    id: PLANTILLA_RECORDATORIO_SEED_IDS.email24h,
    canal: 'email',
    horas_antes: 24,
    asunto: 'Recordatorio de cita — {sede}',
    texto:
      'Hola {paciente_nombre}, le recordamos su cita el {fecha} a las {hora} con {medico} en {sede} ({tipo_cita}).',
  },
  {
    id: PLANTILLA_RECORDATORIO_SEED_IDS.sms2h,
    canal: 'sms',
    horas_antes: 2,
    asunto: null,
    texto: 'Recordatorio: cita {fecha} {hora} con Dr(a). {medico} en {sede}.',
  },
] as const;
