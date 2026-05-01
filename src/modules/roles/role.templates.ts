export type RoleTemplateKey = 'admin' | 'medico' | 'secretaria' | 'enfermeria';

export type RoleTemplate = {
  key: RoleTemplateKey;
  nombre: string;
  descripcion: string;
  permisos: Record<string, unknown>;
};

export const ROLE_TEMPLATES: Record<RoleTemplateKey, RoleTemplate> = {
  admin: {
    key: 'admin',
    nombre: 'Administrador',
    descripcion: 'Acceso amplio a módulos operativos y administrativos.',
    permisos: {
      auth: ['*'],
      core: ['organizaciones'],
      sedes: ['*'],
      consultorios: ['*'],
      roles: ['*'],
    },
  },
  medico: {
    key: 'medico',
    nombre: 'Médico',
    descripcion: 'Gestión clínica y agenda operativa.',
    permisos: {
      auth: ['me'],
      agenda: ['leer', 'crear', 'editar'],
      hce: ['leer', 'crear', 'editar'],
      seguimiento: ['leer', 'crear', 'editar'],
      telemedicina: ['leer', 'crear'],
    },
  },
  secretaria: {
    key: 'secretaria',
    nombre: 'Secretaria',
    descripcion: 'Operación administrativa de pacientes, agenda y caja.',
    permisos: {
      auth: ['me'],
      pacientes: ['leer', 'crear', 'editar'],
      agenda: ['leer', 'crear', 'editar', 'cancelar'],
      facturacion: ['leer', 'crear'],
      seguimiento: ['leer', 'editar'],
    },
  },
  enfermeria: {
    key: 'enfermeria',
    nombre: 'Enfermería',
    descripcion: 'Soporte clínico y seguimiento operativo.',
    permisos: {
      auth: ['me'],
      pacientes: ['leer'],
      hce: ['leer', 'editar'],
      seguimiento: ['leer', 'editar'],
      inventario: ['leer'],
    },
  },
};

export function getRoleTemplateOrNull(value: string | undefined) {
  if (!value) return null;
  const key = value as RoleTemplateKey;
  return ROLE_TEMPLATES[key] ?? null;
}
