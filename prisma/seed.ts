import './load-env.js';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import {
  GUATEMALA_DEPARTAMENTOS,
  GUATEMALA_MUNICIPIOS,
} from './guatemala-ine.seed-data.js';

/**
 * Opcional en `.env` (UUIDs reales de tu BD) para sembrar `regla_disponibilidad` demo:
 *   SEED_CONSULTORIO_ID=<uuid consultorio>
 *   SEED_MEDICO_USUARIO_ID=<uuid usuario médico>
 * Si alguna falta, se omite ese bloque sin error.
 */
const SEED_CONSULTORIO_ID = process.env.SEED_CONSULTORIO_ID?.trim() ?? '';
const SEED_MEDICO_USUARIO_ID = process.env.SEED_MEDICO_USUARIO_ID?.trim() ?? '';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** IDs fijos para upsert idempotente de reglas demo (no confunden con datos reales). */
const REGLA_DEMO_IDS = {
  semanaManana: '22222222-2222-4222-8222-222222222201',
  semanaTarde: '22222222-2222-4222-8222-222222222202',
} as const;

function franjasSemanaLaboral(
  horaInicio: string,
  horaFin: string,
): Prisma.InputJsonValue {
  const dias = [1, 2, 3, 4, 5] as const;
  return dias.map((dia_semana) => ({
    dia_semana,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
  }));
}

async function seedReglasDisponibilidadDemo(consultorioId: string, medicoUsuarioId: string) {
  if (!isUuid(consultorioId) || !isUuid(medicoUsuarioId)) {
    console.warn(
      'Seed disponibilidad: SEED_CONSULTORIO_ID o SEED_MEDICO_USUARIO_ID no son UUID válidos; se omite.',
    );
    return;
  }

  const consultorio = await prisma.consultorio.findFirst({
    where: { id: consultorioId, deleted: false },
    include: { sede: { select: { organizacion_id: true, deleted: true } } },
  });
  if (!consultorio || consultorio.sede.deleted === true) {
    console.warn(`Seed disponibilidad: consultorio ${consultorioId} no encontrado o sede inactiva.`);
    return;
  }

  const medico = await prisma.usuario.findFirst({
    where: { id: medicoUsuarioId, deleted: false },
    select: { id: true, organizacion_id: true },
  });
  if (!medico) {
    console.warn(`Seed disponibilidad: usuario médico ${medicoUsuarioId} no encontrado.`);
    return;
  }

  if (medico.organizacion_id !== consultorio.sede.organizacion_id) {
    console.warn(
      'Seed disponibilidad: el médico y el consultorio no pertenecen a la misma organización; se omite.',
    );
    return;
  }

  const y = new Date().getUTCFullYear();
  const vigenciaInicio = new Date(`${y}-01-01T12:00:00.000Z`);
  const vigenciaFin = new Date(`${y + 1}-12-31T12:00:00.000Z`);

  const excepcionesFestivo: Prisma.InputJsonValue = [
    { fecha: `${y}-12-25`, cerrado: true },
    { fecha: `${y}-01-01`, cerrado: true },
  ];

  await prisma.regla_disponibilidad.upsert({
    where: { id: REGLA_DEMO_IDS.semanaManana },
    create: {
      id: REGLA_DEMO_IDS.semanaManana,
      usuario_id: medicoUsuarioId,
      consultorio_id: consultorioId,
      franjas: franjasSemanaLaboral('08:00', '12:30'),
      excepciones: excepcionesFestivo,
      vigencia_inicio: vigenciaInicio,
      vigencia_fin: vigenciaFin,
    },
    update: {
      usuario_id: medicoUsuarioId,
      consultorio_id: consultorioId,
      franjas: franjasSemanaLaboral('08:00', '12:30'),
      excepciones: excepcionesFestivo,
      vigencia_inicio: vigenciaInicio,
      vigencia_fin: vigenciaFin,
      deleted: false,
      deleted_at: null,
    },
  });

  await prisma.regla_disponibilidad.upsert({
    where: { id: REGLA_DEMO_IDS.semanaTarde },
    create: {
      id: REGLA_DEMO_IDS.semanaTarde,
      usuario_id: medicoUsuarioId,
      consultorio_id: consultorioId,
      franjas: franjasSemanaLaboral('14:00', '18:00'),
      excepciones: [],
      vigencia_inicio: vigenciaInicio,
      vigencia_fin: vigenciaFin,
    },
    update: {
      usuario_id: medicoUsuarioId,
      consultorio_id: consultorioId,
      franjas: franjasSemanaLaboral('14:00', '18:00'),
      excepciones: [],
      vigencia_inicio: vigenciaInicio,
      vigencia_fin: vigenciaFin,
      deleted: false,
      deleted_at: null,
    },
  });

  console.log('Seed disponibilidad OK (2 reglas estándar)');
  console.log(`  consultorio_id: ${consultorioId}`);
  console.log(`  medico usuario_id: ${medicoUsuarioId}`);
  console.log(`  reglas: ${REGLA_DEMO_IDS.semanaManana}, ${REGLA_DEMO_IDS.semanaTarde}`);
}

/**
 * INE Guatemala (22 departamentos, 340 municipios) para la organización demo.
 * Idempotente: actualiza nombres y reactiva filas si ya existían.
 */
async function seedCatalogoGeoGuatemala(organizacionId: string) {
  const deptByCodigo = new Map<string, string>();

  for (const d of GUATEMALA_DEPARTAMENTOS) {
    const row = await prisma.departamento.upsert({
      where: {
        organizacion_id_codigo: {
          organizacion_id: organizacionId,
          codigo:          d.codigo,
        },
      },
      create: {
        organizacion_id: organizacionId,
        codigo:          d.codigo,
        nombre:          d.nombre,
        activo:          true,
        deleted:         false,
      },
      update: {
        nombre:      d.nombre,
        activo:      true,
        deleted:     false,
        deleted_at:  null,
        updated_at:  new Date(),
      },
    });
    deptByCodigo.set(d.codigo, row.id);
  }

  const chunkSize = 40;
  for (let i = 0; i < GUATEMALA_MUNICIPIOS.length; i += chunkSize) {
    const chunk = GUATEMALA_MUNICIPIOS.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (m) => {
        const departamento_id = deptByCodigo.get(m.deptoCodigo);
        if (!departamento_id) {
          throw new Error(`Departamento código ${m.deptoCodigo} no resuelto para municipio ${m.codigo}`);
        }
        await prisma.municipio.upsert({
          where: {
            departamento_id_codigo: {
              departamento_id,
              codigo: m.codigo,
            },
          },
          create: {
            organizacion_id: organizacionId,
            departamento_id,
            codigo:          m.codigo,
            nombre:          m.nombre,
            activo:          true,
            deleted:         false,
          },
          update: {
            nombre:          m.nombre,
            activo:          true,
            deleted:         false,
            deleted_at:      null,
            organizacion_id: organizacionId,
            updated_at:      new Date(),
          },
        });
      }),
    );
  }

  console.log(
    `Seed catálogo geo Guatemala OK — ${GUATEMALA_DEPARTAMENTOS.length} departamentos, ${GUATEMALA_MUNICIPIOS.length} municipios (organización ${organizacionId}).`,
  );
}

/** Datos demo para probar POST /api/auth/login (ajusta si ya existen en tu BD). */
const SEED = {
  organizacion: {
    nit: '90000001-1',
    razon_social: 'Organización Demo MediCore',
    direccion: 'Guatemala',
  },
  rol: {
    nombre: 'Administrador',
    descripcion: 'Rol sembrado para desarrollo / pruebas de auth',
    permisos: {
      auth: ['login', 'refresh', 'logout', 'me'],
      core: ['organizaciones'],
      usuarios: ['*'],
      sedes: ['*'],
      consultorios: ['*'],
      roles: ['*'],
      auditoria: ['*'],
      agenda: ['*'],
      pacientes: ['*'],
      catalogos_geo: ['*'],
    },
  },
  usuario: {
    email: 'admin@medicore.demo',
    passwordPlain: 'Medicore123!',
    nombre: 'Admin',
    apellido: 'Demo',
  },
} as const;

async function main() {
  const password_hash = await bcrypt.hash(SEED.usuario.passwordPlain, 10);

  const org = await prisma.organizacion.upsert({
    where: { nit: SEED.organizacion.nit },
    create: {
      razon_social: SEED.organizacion.razon_social,
      nit: SEED.organizacion.nit,
      direccion: SEED.organizacion.direccion,
    },
    update: {
      razon_social: SEED.organizacion.razon_social,
    },
  });

  let rol = await prisma.rol.findFirst({
    where: {
      organizacion_id: org.id,
      nombre: SEED.rol.nombre,
      deleted: false,
    },
  });

  if (!rol) {
    rol = await prisma.rol.create({
      data: {
        organizacion_id: org.id,
        nombre: SEED.rol.nombre,
        descripcion: SEED.rol.descripcion,
        permisos: SEED.rol.permisos,
      },
    });
  } else {
    await prisma.rol.update({
      where: { id: rol.id },
      data: {
        descripcion: SEED.rol.descripcion,
        permisos: SEED.rol.permisos,
      },
    });
  }

  await prisma.usuario.upsert({
    where: { email: SEED.usuario.email },
    create: {
      organizacion_id: org.id,
      rol_id: rol.id,
      email: SEED.usuario.email,
      password_hash,
      nombre: SEED.usuario.nombre,
      apellido: SEED.usuario.apellido,
      estado: 'activo',
      deleted: false,
    },
    update: {
      organizacion_id: org.id,
      rol_id: rol.id,
      password_hash,
      nombre: SEED.usuario.nombre,
      apellido: SEED.usuario.apellido,
      estado: 'activo',
      deleted: false,
    },
  });

  console.log('Seed auth OK');
  console.log(`  Organización: ${org.razon_social} (nit ${org.nit})`);
  console.log(`  Rol: ${SEED.rol.nombre}`);
  console.log(`  Usuario: ${SEED.usuario.email}`);
  console.log(`  Contraseña: ${SEED.usuario.passwordPlain}`);

  await seedCatalogoGeoGuatemala(org.id);

  if (SEED_CONSULTORIO_ID && SEED_MEDICO_USUARIO_ID) {
    await seedReglasDisponibilidadDemo(SEED_CONSULTORIO_ID, SEED_MEDICO_USUARIO_ID);
  } else {
    console.log(
      'Seed disponibilidad: omitido (define SEED_CONSULTORIO_ID y SEED_MEDICO_USUARIO_ID en .env para sembrar reglas).',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
