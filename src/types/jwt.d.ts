import type { JwtAccessPayload } from '../core/auth/jwtTypes.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtAccessPayload;
    user: JwtAccessPayload;
  }
}
