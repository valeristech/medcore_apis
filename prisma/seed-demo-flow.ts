import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import prisma from '../src/config/prisma.js';
import { ROLE_TEMPLATES } from '../src/modules/roles/role.templates.js';
import { TIPO_CITA_SEED_IDS } from './tipo-cita.seed-data.js';
import { DEMO_IDS, DEMO_USERS } from './demo-flow.seed-data.js';

const TZ = 'America/Guatemala';

function gtDate(daysOffset: number, hour: number, minute: number): Date {
  return DateTime.now()
    .setZone(TZ)
    .plus({ days: daysOffset })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}

function addMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

async function resolveMunicipioGuatemalaCiudad(organizacionId: string) {
  const row = await prisma.municipio.findFirst({
    where: {
      organizacion_id: organizacionId,
      codigo: '0101',
      deleted: false,
      departamento: { codigo: '01', deleted: false },
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function seedRolesDemo(organizacionId: string) {
  for (const [id, templateKey] of [
    [DEMO_IDS.rolMedico, 'medico'],
    [DEMO_IDS.rolSecretaria, 'secretaria'],
  ] as const) {
    const t = ROLE_TEMPLATES[templateKey];
    await prisma.rol.upsert({
      where: { id },
      create: {
        id,
        organizacion_id: organizacionId,
        nombre: t.nombre,
        descripcion: t.descripcion,
        permisos: t.permisos as object,
        deleted: false,
      },
      update: {
        nombre: t.nombre,
        descripcion: t.descripcion,
        permisos: t.permisos as object,
        deleted: false,
        deleted_at: null,
      },
    });
  }
}

async function seedUsuariosDemo(organizacionId: string, passwordHash: string) {
  await prisma.usuario.upsert({
    where: { email: DEMO_USERS.medico.email },
    create: {
      id: DEMO_IDS.usuarioMedico,
      organizacion_id: organizacionId,
      rol_id: DEMO_IDS.rolMedico,
      email: DEMO_USERS.medico.email,
      password_hash: passwordHash,
      nombre: DEMO_USERS.medico.nombre,
      apellido: DEMO_USERS.medico.apellido,
      especialidad: DEMO_USERS.medico.especialidad,
      numero_colegiado: DEMO_USERS.medico.numero_colegiado,
      telefono: DEMO_USERS.medico.telefono,
      estado: 'activo',
      deleted: false,
    },
    update: {
      organizacion_id: organizacionId,
      rol_id: DEMO_IDS.rolMedico,
      password_hash: passwordHash,
      nombre: DEMO_USERS.medico.nombre,
      apellido: DEMO_USERS.medico.apellido,
      especialidad: DEMO_USERS.medico.especialidad,
      numero_colegiado: DEMO_USERS.medico.numero_colegiado,
      telefono: DEMO_USERS.medico.telefono,
      estado: 'activo',
      deleted: false,
    },
  });

  await prisma.usuario.upsert({
    where: { email: DEMO_USERS.secretaria.email },
    create: {
      id: DEMO_IDS.usuarioSecretaria,
      organizacion_id: organizacionId,
      rol_id: DEMO_IDS.rolSecretaria,
      email: DEMO_USERS.secretaria.email,
      password_hash: passwordHash,
      nombre: DEMO_USERS.secretaria.nombre,
      apellido: DEMO_USERS.secretaria.apellido,
      telefono: DEMO_USERS.secretaria.telefono,
      estado: 'activo',
      deleted: false,
    },
    update: {
      organizacion_id: organizacionId,
      rol_id: DEMO_IDS.rolSecretaria,
      password_hash: passwordHash,
      nombre: DEMO_USERS.secretaria.nombre,
      apellido: DEMO_USERS.secretaria.apellido,
      telefono: DEMO_USERS.secretaria.telefono,
      estado: 'activo',
      deleted: false,
    },
  });
}

async function seedSedeYConsultorio(organizacionId: string) {
  await prisma.sede.upsert({
    where: { id: DEMO_IDS.sedePrincipal },
    create: {
      id: DEMO_IDS.sedePrincipal,
      organizacion_id: organizacionId,
      nombre: 'Sede Central Demo',
      direccion: 'Zona 10, Ciudad de Guatemala',
      telefono: '5022345678',
      activo: true,
      deleted: false,
    },
    update: {
      organizacion_id: organizacionId,
      nombre: 'Sede Central Demo',
      direccion: 'Zona 10, Ciudad de Guatemala',
      telefono: '5022345678',
      activo: true,
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.consultorio.upsert({
    where: { id: DEMO_IDS.consultorio1 },
    create: {
      id: DEMO_IDS.consultorio1,
      sede_id: DEMO_IDS.sedePrincipal,
      nombre: 'Consultorio 101',
      tipo: 'consulta',
      activo: true,
      deleted: false,
    },
    update: {
      sede_id: DEMO_IDS.sedePrincipal,
      nombre: 'Consultorio 101',
      tipo: 'consulta',
      activo: true,
      deleted: false,
      deleted_at: null,
    },
  });
}

async function seedUsuarioSede() {
  await prisma.usuario_sede.upsert({
    where: {
      usuario_id_sede_id_consultorio_id: {
        usuario_id: DEMO_IDS.usuarioMedico,
        sede_id: DEMO_IDS.sedePrincipal,
        consultorio_id: DEMO_IDS.consultorio1,
      },
    },
    create: {
      id: DEMO_IDS.usuarioSedeMedico,
      usuario_id: DEMO_IDS.usuarioMedico,
      sede_id: DEMO_IDS.sedePrincipal,
      consultorio_id: DEMO_IDS.consultorio1,
    },
    update: {
      usuario_id: DEMO_IDS.usuarioMedico,
      sede_id: DEMO_IDS.sedePrincipal,
      consultorio_id: DEMO_IDS.consultorio1,
    },
  });

  await prisma.usuario_sede.upsert({
    where: {
      usuario_id_sede_id_consultorio_id: {
        usuario_id: DEMO_IDS.usuarioSecretaria,
        sede_id: DEMO_IDS.sedePrincipal,
        consultorio_id: DEMO_IDS.consultorio1,
      },
    },
    create: {
      id: DEMO_IDS.usuarioSedeSecretaria,
      usuario_id: DEMO_IDS.usuarioSecretaria,
      sede_id: DEMO_IDS.sedePrincipal,
      consultorio_id: DEMO_IDS.consultorio1,
    },
    update: {
      usuario_id: DEMO_IDS.usuarioSecretaria,
      sede_id: DEMO_IDS.sedePrincipal,
      consultorio_id: DEMO_IDS.consultorio1,
    },
  });
}

async function seedPacientesDemo(organizacionId: string, municipioId: string | null) {
  const pacientes = [
    {
      id: DEMO_IDS.pacienteMaria,
      dpi: '2345678901234',
      nombre: 'María',
      apellido: 'López García',
      fecha_nacimiento: new Date('1985-03-15T12:00:00.000Z'),
      genero: 'femenino',
      telefono: '50255552001',
      email: 'maria.lopez@demo.local',
      expediente: 'EXP-DEMO-0001',
      notas: 'Paciente con consulta completada y HCE firmada (flujo módulo 4).',
    },
    {
      id: DEMO_IDS.pacienteJuan,
      dpi: '3456789012345',
      nombre: 'Juan',
      apellido: 'Pérez Morales',
      fecha_nacimiento: new Date('1978-11-02T12:00:00.000Z'),
      genero: 'masculino',
      telefono: '50255552002',
      email: 'juan.perez@demo.local',
      expediente: 'EXP-DEMO-0002',
      notas: 'En lista de espera; sin cita disponible.',
    },
    {
      id: DEMO_IDS.pacienteAna,
      dpi: '4567890123456',
      nombre: 'Ana',
      apellido: 'García Santos',
      fecha_nacimiento: new Date('1992-07-20T12:00:00.000Z'),
      genero: 'femenino',
      telefono: '50255552003',
      email: 'ana.garcia@demo.local',
      expediente: 'EXP-DEMO-0003',
      notas: 'Cita cancelada y no-show de ejemplo.',
    },
  ] as const;

  for (const p of pacientes) {
    await prisma.paciente.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        dpi: p.dpi,
        nombre: p.nombre,
        apellido: p.apellido,
        fecha_nacimiento: p.fecha_nacimiento,
        genero: p.genero,
        telefono: p.telefono,
        email: p.email,
        municipio_id: municipioId,
        direccion: 'Ciudad de Guatemala',
        grupo_sanguineo: 'O+',
        notas_globales: p.notas,
        activo: true,
        deleted: false,
      },
      update: {
        dpi: p.dpi,
        nombre: p.nombre,
        apellido: p.apellido,
        fecha_nacimiento: p.fecha_nacimiento,
        genero: p.genero,
        telefono: p.telefono,
        email: p.email,
        municipio_id: municipioId,
        direccion: 'Ciudad de Guatemala',
        notas_globales: p.notas,
        activo: true,
        deleted: false,
        deleted_at: null,
      },
    });

    await prisma.paciente_organizacion.upsert({
      where: {
        paciente_id_organizacion_id: {
          paciente_id: p.id,
          organizacion_id: organizacionId,
        },
      },
      create: {
        paciente_id: p.id,
        organizacion_id: organizacionId,
        numero_expediente: p.expediente,
        activo: true,
      },
      update: {
        numero_expediente: p.expediente,
        activo: true,
      },
    });
  }

  await prisma.alergia.upsert({
    where: { id: DEMO_IDS.alergiaMariaPenicilina },
    create: {
      id: DEMO_IDS.alergiaMariaPenicilina,
      paciente_id: DEMO_IDS.pacienteMaria,
      sustancia: 'Penicilina',
      tipo_reaccion: 'Urticaria',
      severidad: 'grave',
      notas: 'Documentada en consulta previa.',
      activo: true,
      deleted: false,
    },
    update: {
      sustancia: 'Penicilina',
      tipo_reaccion: 'Urticaria',
      severidad: 'grave',
      activo: true,
      deleted: false,
      deleted_at: null,
    },
  });
}

async function seedPlantillaHce(organizacionId: string) {
  await prisma.plantilla_especialidad.upsert({
    where: { id: DEMO_IDS.plantillaMedicinaGeneral },
    create: {
      id: DEMO_IDS.plantillaMedicinaGeneral,
      organizacion_id: organizacionId,
      especialidad: 'Medicina general',
      nombre: 'Consulta general estándar',
      secciones: [
        { clave: 'motivo_consulta', titulo: 'Motivo de consulta', orden: 1 },
        { clave: 'enfermedad_actual', titulo: 'Enfermedad actual', orden: 2 },
        { clave: 'examen_fisico', titulo: 'Examen físico', orden: 3 },
        { clave: 'plan_tratamiento', titulo: 'Plan', orden: 4 },
      ],
      activo: true,
      deleted: false,
    },
    update: {
      especialidad: 'Medicina general',
      nombre: 'Consulta general estándar',
      activo: true,
      deleted: false,
      deleted_at: null,
    },
  });
}

async function seedCitasDemo() {
  const medicoId = DEMO_IDS.usuarioMedico;
  const sedeId = DEMO_IDS.sedePrincipal;
  const consultorioId = DEMO_IDS.consultorio1;

  const inicioCompletada = gtDate(-7, 9, 0);
  const inicioEnCurso = gtDate(0, 10, 0);
  const inicioProgramada = gtDate(3, 11, 0);
  const inicioCancelada = gtDate(-2, 15, 0);
  const inicioNoShow = gtDate(-1, 8, 30);

  const citas = [
    {
      id: DEMO_IDS.citaCompletada,
      paciente_id: DEMO_IDS.pacienteMaria,
      tipo_cita_id: TIPO_CITA_SEED_IDS.control,
      inicio: inicioCompletada,
      duracion: 20,
      estado: 'completada',
      notas: 'Control diabetes — completada con HCE firmada.',
    },
    {
      id: DEMO_IDS.citaEnCurso,
      paciente_id: DEMO_IDS.pacienteMaria,
      tipo_cita_id: TIPO_CITA_SEED_IDS.general,
      inicio: inicioEnCurso,
      duracion: 30,
      estado: 'en_curso',
      notas: 'Consulta en curso — encuentro abierto para pruebas HCE-001.',
    },
    {
      id: DEMO_IDS.citaProgramada,
      paciente_id: DEMO_IDS.pacienteAna,
      tipo_cita_id: TIPO_CITA_SEED_IDS.primeraVez,
      inicio: inicioProgramada,
      duracion: 45,
      estado: 'confirmada',
      notas: 'Primera consulta programada.',
    },
    {
      id: DEMO_IDS.citaCancelada,
      paciente_id: DEMO_IDS.pacienteAna,
      tipo_cita_id: TIPO_CITA_SEED_IDS.general,
      inicio: inicioCancelada,
      duracion: 30,
      estado: 'cancelada',
      motivo_cancelacion: 'Paciente solicitó reprogramar por viaje.',
      notas: 'Cancelada — útil para probar lista de espera al liberar slot.',
    },
    {
      id: DEMO_IDS.citaNoShow,
      paciente_id: DEMO_IDS.pacienteAna,
      tipo_cita_id: TIPO_CITA_SEED_IDS.control,
      inicio: inicioNoShow,
      duracion: 20,
      estado: 'no_asistio',
      notas: 'No asistió — ejemplo UC-AGE-006.',
    },
  ] as const;

  for (const c of citas) {
    const fin = addMinutes(c.inicio, c.duracion);
    await prisma.cita.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        paciente_id: c.paciente_id,
        usuario_id: medicoId,
        consultorio_id: consultorioId,
        sede_id: sedeId,
        tipo_cita_id: c.tipo_cita_id,
        fecha_hora_inicio: c.inicio,
        fecha_hora_fin: fin,
        estado: c.estado,
        motivo_cancelacion: 'motivo_cancelacion' in c ? c.motivo_cancelacion : null,
        notas: c.notas,
        origen: 'manual',
        recordatorio_enviado: false,
        deleted: false,
      },
      update: {
        paciente_id: c.paciente_id,
        usuario_id: medicoId,
        consultorio_id: consultorioId,
        sede_id: sedeId,
        tipo_cita_id: c.tipo_cita_id,
        fecha_hora_inicio: c.inicio,
        fecha_hora_fin: fin,
        estado: c.estado,
        motivo_cancelacion: 'motivo_cancelacion' in c ? c.motivo_cancelacion : null,
        notas: c.notas,
        deleted: false,
        deleted_at: null,
      },
    });
  }

  await prisma.lista_espera.upsert({
    where: { id: DEMO_IDS.listaEsperaJuan },
    create: {
      id: DEMO_IDS.listaEsperaJuan,
      paciente_id: DEMO_IDS.pacienteJuan,
      usuario_id: medicoId,
      tipo_cita_id: TIPO_CITA_SEED_IDS.control,
      fecha_desde: gtDate(0, 0, 0),
      fecha_hasta: gtDate(14, 0, 0),
      notas: 'Prefiere horario matutino.',
      estado: 'activa',
      deleted: false,
    },
    update: {
      paciente_id: DEMO_IDS.pacienteJuan,
      usuario_id: medicoId,
      tipo_cita_id: TIPO_CITA_SEED_IDS.control,
      notas: 'Prefiere horario matutino.',
      estado: 'activa',
      deleted: false,
      deleted_at: null,
    },
  });
}

async function seedHceDemo() {
  const medicoId = DEMO_IDS.usuarioMedico;
  const sedeId = DEMO_IDS.sedePrincipal;

  const fechaEncuentroFirmado = gtDate(-7, 9, 5);
  const fechaEncuentroAbierto = gtDate(0, 10, 5);

  await prisma.encuentro.upsert({
    where: { id: DEMO_IDS.encuentroFirmado },
    create: {
      id: DEMO_IDS.encuentroFirmado,
      cita_id: DEMO_IDS.citaCompletada,
      paciente_id: DEMO_IDS.pacienteMaria,
      usuario_id: medicoId,
      sede_id: sedeId,
      plantilla_id: DEMO_IDS.plantillaMedicinaGeneral,
      tipo: 'consulta',
      motivo_consulta: 'Control de diabetes mellitus tipo 2',
      fecha: fechaEncuentroFirmado,
      estado: 'firmado',
      deleted: false,
    },
    update: {
      cita_id: DEMO_IDS.citaCompletada,
      paciente_id: DEMO_IDS.pacienteMaria,
      usuario_id: medicoId,
      sede_id: sedeId,
      plantilla_id: DEMO_IDS.plantillaMedicinaGeneral,
      estado: 'firmado',
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.encuentro.upsert({
    where: { id: DEMO_IDS.encuentroAbierto },
    create: {
      id: DEMO_IDS.encuentroAbierto,
      cita_id: DEMO_IDS.citaEnCurso,
      paciente_id: DEMO_IDS.pacienteMaria,
      usuario_id: medicoId,
      sede_id: sedeId,
      plantilla_id: DEMO_IDS.plantillaMedicinaGeneral,
      tipo: 'consulta',
      motivo_consulta: 'Dolor de garganta y fiebre leve',
      fecha: fechaEncuentroAbierto,
      estado: 'abierto',
      deleted: false,
    },
    update: {
      cita_id: DEMO_IDS.citaEnCurso,
      paciente_id: DEMO_IDS.pacienteMaria,
      usuario_id: medicoId,
      sede_id: sedeId,
      plantilla_id: DEMO_IDS.plantillaMedicinaGeneral,
      estado: 'abierto',
      deleted: false,
      deleted_at: null,
    },
  });

  const notaPayload = {
    motivo_consulta: 'Control de diabetes mellitus tipo 2',
    enfermedad_actual: 'Paciente refiere adherencia parcial a dieta. Sin polidipsia ni poliuria.',
    antecedentes: 'HTA controlada. Alergia a penicilina.',
    examen_fisico: 'PA 128/82, FC 76, peso estable. Resto sin hallazgos relevantes.',
    impresion_diagnostica: 'DM2 en control subóptimo.',
    plan_tratamiento: 'Ajuste de metformina. Control en 3 meses con HbA1c.',
    estudios_solicitados_texto: 'Hemograma completo y HbA1c.',
    recomendaciones: 'Dieta baja en carbohidratos simples. Caminata 30 min/día.',
    datos_adicionales: { glucosa_ayunas_mg_dl: 142 },
  };

  await prisma.nota_clinica.upsert({
    where: { id: DEMO_IDS.notaClinicaFirmada },
    create: {
      id: DEMO_IDS.notaClinicaFirmada,
      encuentro_id: DEMO_IDS.encuentroFirmado,
      ...notaPayload,
      deleted: false,
    },
    update: {
      encuentro_id: DEMO_IDS.encuentroFirmado,
      ...notaPayload,
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.diagnostico.upsert({
    where: { id: DEMO_IDS.diagnosticoPrincipal },
    create: {
      id: DEMO_IDS.diagnosticoPrincipal,
      nota_clinica_id: DEMO_IDS.notaClinicaFirmada,
      codigo_icd10: 'E11.9',
      descripcion: 'Diabetes mellitus tipo 2 sin complicaciones',
      tipo: 'principal',
      deleted: false,
    },
    update: {
      codigo_icd10: 'E11.9',
      descripcion: 'Diabetes mellitus tipo 2 sin complicaciones',
      tipo: 'principal',
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.diagnostico.upsert({
    where: { id: DEMO_IDS.diagnosticoSecundario },
    create: {
      id: DEMO_IDS.diagnosticoSecundario,
      nota_clinica_id: DEMO_IDS.notaClinicaFirmada,
      codigo_icd10: 'I10',
      descripcion: 'Hipertensión esencial (primaria)',
      tipo: 'secundario',
      deleted: false,
    },
    update: {
      codigo_icd10: 'I10',
      descripcion: 'Hipertensión esencial (primaria)',
      tipo: 'secundario',
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.prescripcion.upsert({
    where: { id: DEMO_IDS.prescripcionMetformina },
    create: {
      id: DEMO_IDS.prescripcionMetformina,
      encuentro_id: DEMO_IDS.encuentroFirmado,
      medicamento: 'Metformina 850 mg',
      principio_activo: 'Metformina',
      dosis: '850 mg',
      via: 'oral',
      frecuencia: 'Cada 12 horas',
      duracion: '90 días',
      cantidad: 180,
      indicaciones: 'Tomar con alimentos.',
      estado: 'activa',
      deleted: false,
    },
    update: {
      medicamento: 'Metformina 850 mg',
      principio_activo: 'Metformina',
      dosis: '850 mg',
      via: 'oral',
      frecuencia: 'Cada 12 horas',
      duracion: '90 días',
      estado: 'activa',
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.estudio_solicitado.upsert({
    where: { id: DEMO_IDS.estudioHemograma },
    create: {
      id: DEMO_IDS.estudioHemograma,
      encuentro_id: DEMO_IDS.encuentroFirmado,
      tipo: 'laboratorio',
      nombre: 'Hemograma completo',
      descripcion: 'Control rutinario',
      urgente: false,
      estado: 'solicitado',
      deleted: false,
    },
    update: {
      tipo: 'laboratorio',
      nombre: 'Hemograma completo',
      estado: 'solicitado',
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.evolucion.upsert({
    where: { id: DEMO_IDS.evolucionEnfermeria },
    create: {
      id: DEMO_IDS.evolucionEnfermeria,
      encuentro_id: DEMO_IDS.encuentroFirmado,
      usuario_id: DEMO_IDS.usuarioSecretaria,
      nota: 'Signos vitales tomados al ingreso. Paciente orientada y colaboradora.',
      tipo: 'enfermeria',
      deleted: false,
    },
    update: {
      nota: 'Signos vitales tomados al ingreso. Paciente orientada y colaboradora.',
      tipo: 'enfermeria',
      deleted: false,
      deleted_at: null,
    },
  });

  const hash_documento = createHash('sha256')
    .update(JSON.stringify({ nota_id: DEMO_IDS.notaClinicaFirmada, encuentro_id: DEMO_IDS.encuentroFirmado }))
    .digest('hex');

  await prisma.firma.upsert({
    where: { id: DEMO_IDS.firmaEncuentro },
    create: {
      id: DEMO_IDS.firmaEncuentro,
      encuentro_id: DEMO_IDS.encuentroFirmado,
      usuario_id: medicoId,
      tipo: 'electronica',
      hash_documento,
      fecha_firma: addMinutes(fechaEncuentroFirmado, 25),
      ip_origen: '127.0.0.1',
      deleted: false,
    },
    update: {
      hash_documento,
      ip_origen: '127.0.0.1',
      deleted: false,
      deleted_at: null,
    },
  });
}

function logDemoFlowSummary() {
  console.log('');
  console.log('── Flujo demo (módulos 1–4) ─────────────────────────────────────');
  console.log('M1 Core: sede, consultorio, roles médico/secretaría, usuarios asignados');
  console.log('M2 Pacientes: María (HCE), Juan (lista espera), Ana (cancelada/no-show)');
  console.log('M3 Agenda: 5 citas + lista_espera + reglas disponibilidad');
  console.log('M4 HCE: encuentro firmado (nota, dx, rx, estudio, evolución, firma) + encuentro abierto');
  console.log('');
  console.log('Usuarios demo (contraseña: Medicore123!):');
  console.log('  admin@medicore.demo');
  console.log(`  ${DEMO_USERS.medico.email}`);
  console.log(`  ${DEMO_USERS.secretaria.email}`);
  console.log('');
  console.log('IDs útiles (.env opcional):');
  console.log(`  SEED_CONSULTORIO_ID=${DEMO_IDS.consultorio1}`);
  console.log(`  SEED_MEDICO_USUARIO_ID=${DEMO_IDS.usuarioMedico}`);
  console.log('────────────────────────────────────────────────────────────────');
}

/**
 * Flujo completo de datos dummy: Core → Pacientes → Agenda → HCE.
 */
export async function seedDemoFlow(organizacionId: string, passwordHash: string) {
  const municipioId = await resolveMunicipioGuatemalaCiudad(organizacionId);

  await seedRolesDemo(organizacionId);
  await seedUsuariosDemo(organizacionId, passwordHash);
  await seedSedeYConsultorio(organizacionId);
  await seedUsuarioSede();
  await seedPacientesDemo(organizacionId, municipioId);
  await seedPlantillaHce(organizacionId);
  await seedCitasDemo();
  await seedHceDemo();

  logDemoFlowSummary();

  return {
    consultorioId: DEMO_IDS.consultorio1,
    medicoUsuarioId: DEMO_IDS.usuarioMedico,
  };
}
