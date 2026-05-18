import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../env.js';

/** Cabeceras que el FE suele enviar (incluye trazabilidad del proyecto). */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
  'x-request-id',
  'X-Request-Id',
] as const;

const CORS_BASE = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as string[],
  allowedHeaders: [...ALLOWED_HEADERS] as string[],
  exposedHeaders: ['x-request-id', 'X-Request-Id'] as string[],
  credentials: true,
  maxAge: 86_400,
};

/**
 * CORS global (antes de rutas y auth).
 *
 * - Sin `CORS_ORIGINS`: acepta **cualquier** origen (`origin: true`, refleja el Origin de cada petición).
 *   Con `credentials: true` no se puede usar `*` literal; reflejar el origen es el equivalente correcto.
 * - Con `CORS_ORIGINS` (coma-separada): solo esas URLs del frontend.
 */
export async function registerCors(app: FastifyInstance, env: AppEnv) {
  const allowlist = [...env.CORS_ORIGINS];

  if (allowlist.length === 0) {
    await app.register(fastifyCors, {
      ...CORS_BASE,
      origin: true,
    });
    app.log.info('CORS: cualquier origen permitido (define CORS_ORIGINS para restringir).');
    return;
  }

  await app.register(fastifyCors, {
    ...CORS_BASE,
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowlist.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error(`CORS: origen no permitido (${origin})`), false);
    },
  });

  app.log.info({ allowlist }, 'CORS: orígenes restringidos por CORS_ORIGINS');
}
