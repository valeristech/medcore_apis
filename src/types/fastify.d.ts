import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Correlación de petición (header X-Request-Id o UUID generado). */
    requestId: string;
  }
}
