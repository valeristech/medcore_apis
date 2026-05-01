import './load-env.js';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

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
      sedes: ['*'],
      consultorios: ['*'],
      roles: ['*'],
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
