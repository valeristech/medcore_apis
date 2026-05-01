import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { AppEnv } from './core/env.js';
import { registerAuditAccess } from './core/plugins/auditAccess.js';
import { registerErrorHandler } from './core/plugins/errorHandler.js';
import { registerOpenApi, registerScalarDocs } from './core/plugins/openapi.js';
import { registerRequestContext } from './core/plugins/requestContext.js';
import { authRoutesPlugin } from './modules/auth/auth.routes.js';
import { healthRouteSchema } from './modules/health/health.schemas.js';
import { organizacionRoutes } from './modules/organizaciones/organizacion.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { sedeRoutes } from './modules/sedes/sede.routes.js';

export const buildApp = async (env: AppEnv) => {
  const logger =
    env.NODE_ENV === 'production'
      ? { level: 'info' as const }
      : {
          level: 'debug' as const,
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        };

  const app = Fastify({ logger });

  await registerOpenApi(app);

  await registerRequestContext(app);
  await registerAuditAccess(app);
  await registerErrorHandler(app);

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  });

  app.get(
    '/api/health',
    healthRouteSchema,
    async (request) => {
      return {
        success: true as const,
        data: {
          status: 'ok',
          message: 'MediCore API funcionando perfectamente 🚀',
          timestamp: new Date().toISOString(),
        },
        meta: { requestId: request.requestId },
      };
    },
  );

  await app.register(authRoutesPlugin, { prefix: '/api/auth', appEnv: env });
  await app.register(organizacionRoutes, { prefix: '/api/organizaciones' });
  await app.register(roleRoutes, { prefix: '/api' });
  await app.register(sedeRoutes, { prefix: '/api' });

  await registerScalarDocs(app);

  return app;
};
