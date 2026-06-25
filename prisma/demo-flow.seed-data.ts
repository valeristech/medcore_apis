/**
 * UUIDs fijos del flujo demo (módulos 1–4). Idempotente vía upsert en seed.
 */
export const DEMO_IDS = {
  rolMedico: '11111111-1111-4111-8111-111111111101',
  rolSecretaria: '11111111-1111-4111-8111-111111111102',

  sedePrincipal: '11111111-1111-4111-8111-111111111201',
  consultorio1: '11111111-1111-4111-8111-111111111202',

  usuarioMedico: '11111111-1111-4111-8111-111111111301',
  usuarioSecretaria: '11111111-1111-4111-8111-111111111302',
  usuarioSedeMedico: '11111111-1111-4111-8111-111111111401',
  usuarioSedeSecretaria: '11111111-1111-4111-8111-111111111402',

  pacienteMaria: '11111111-1111-4111-8111-111111112001',
  pacienteJuan: '11111111-1111-4111-8111-111111112002',
  pacienteAna: '11111111-1111-4111-8111-111111112003',
  alergiaMariaPenicilina: '11111111-1111-4111-8111-111111112011',

  plantillaMedicinaGeneral: '11111111-1111-4111-8111-111111113001',

  citaCompletada: '11111111-1111-4111-8111-111111114001',
  citaEnCurso: '11111111-1111-4111-8111-111111114002',
  citaProgramada: '11111111-1111-4111-8111-111111114003',
  citaCancelada: '11111111-1111-4111-8111-111111114004',
  citaNoShow: '11111111-1111-4111-8111-111111114005',

  encuentroFirmado: '11111111-1111-4111-8111-111111115001',
  encuentroAbierto: '11111111-1111-4111-8111-111111115002',

  notaClinicaFirmada: '11111111-1111-4111-8111-111111116001',
  diagnosticoPrincipal: '11111111-1111-4111-8111-111111116002',
  diagnosticoSecundario: '11111111-1111-4111-8111-111111116003',

  prescripcionMetformina: '11111111-1111-4111-8111-111111117001',
  estudioHemograma: '11111111-1111-4111-8111-111111117002',
  evolucionEnfermeria: '11111111-1111-4111-8111-111111117003',
  firmaEncuentro: '11111111-1111-4111-8111-111111117004',

  listaEsperaJuan: '11111111-1111-4111-8111-111111118001',
} as const;

export const DEMO_USERS = {
  medico: {
    email: 'medico@medicore.demo',
    nombre: 'Carlos',
    apellido: 'Méndez',
    especialidad: 'Medicina general',
    numero_colegiado: 'COL-12345',
    telefono: '50255551001',
  },
  secretaria: {
    email: 'secretaria@medicore.demo',
    nombre: 'Laura',
    apellido: 'Ramírez',
    telefono: '50255551002',
  },
} as const;

export const DEMO_PASSWORD = 'Medicore123!';
