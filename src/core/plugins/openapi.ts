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
        { name: 'Autenticación', description: 'Login y JWT' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Token JWT devuelto por POST /api/auth/login. Enviar en Authorization: Bearer.',
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
