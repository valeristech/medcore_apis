import type { AppEnv } from '../core/env.js';
import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /** Variables de entorno validadas al arranque. */
    appEnv: AppEnv;
  }

  interface FastifyRequest {
    /** Correlación de petición (header X-Request-Id o UUID generado). */
    requestId: string;
  }
}
