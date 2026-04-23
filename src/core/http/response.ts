import type { FastifyReply } from 'fastify';

export type ApiMeta = { requestId: string };

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
};

export function sendOk<T>(reply: FastifyReply, requestId: string, data: T, statusCode = 200) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: { requestId },
  };
  return reply.code(statusCode).send(body);
}

export function sendFail(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiFailure = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
    meta: { requestId },
  };
  return reply.code(statusCode).send(body);
}
