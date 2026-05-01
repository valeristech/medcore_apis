import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';

export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'MediCore API',
        description: 'API REST del backend MediCore.',
        version: '1.0.0',
      },
      tags: [
        { name: 'Sistema', description: 'Salud del servicio' },
        {
          name: 'Autenticación',
          description:
            'Login, refresh, logout y JWT. El access token incluye permisos del rol para RBAC.',
        },
        {
          name: 'Core / Organizaciones',
          description: 'Gestión de organizaciones (tenant), filtros y mantenimiento.',
        },
        {
          name: 'Core / Sedes',
          description: 'Gestión de sedes por organización.',
        },
        {
          name: 'Core / Consultorios',
          description: 'Gestión de consultorios por sede.',
        },
        {
          name: 'Core / Roles y Permisos',
          description: 'CRUD de roles, validación de permisos JSON y plantillas clínicas.',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Access JWT (POST /api/auth/login o /api/auth/refresh). Cabecera: Authorization: Bearer <token>.',
          },
        },
      },
    },
  });
}

/**
 * Scalar lee el OpenAPI generado por `@fastify/swagger`.
 * UI: `/docs` · JSON: `/docs/openapi.json` · YAML: `/docs/openapi.yaml`
 */
export async function registerScalarDocs(app: FastifyInstance) {
  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      theme: 'default',
    },
    logLevel: 'silent',
  });
}
