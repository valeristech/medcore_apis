import type { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { loginSchema } from './auth.schemas.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', loginSchema, authController.login);
}
