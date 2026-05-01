import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';
import { createAuthController } from './auth.controller.js';
import { loginSchema, logoutSchema, meSchema, refreshSchema } from './auth.schemas.js';

export const authRoutesPlugin: FastifyPluginAsync<{ appEnv: AppEnv }> = async (app, opts) => {
  if (!opts.appEnv) {
    throw new Error('authRoutesPlugin: falta opción appEnv');
  }
  const c = createAuthController(opts.appEnv);

  app.post('/login', loginSchema, c.login);
  app.post('/refresh', refreshSchema, c.refresh);
  app.post('/logout', logoutSchema, c.logout);
  app.get(
    '/me',
    {
      ...meSchema,
      preHandler: [requireAuth, requirePermission('auth', 'me')],
    },
    c.me,
  );
};
