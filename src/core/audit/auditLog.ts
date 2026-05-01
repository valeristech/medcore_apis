import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';

type AuditInput = {
  request: FastifyRequest;
  organizacionId: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  descripcion: string;
  datosAntes?: unknown;
  datosDespues?: unknown;
};

function toJsonSafe(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { note: 'unserializable_payload' } as Prisma.InputJsonValue;
  }
}

export async function writeAuditLog(input: AuditInput) {
  const { request } = input;
  await prisma.audit_log.create({
    data: {
      organizacion_id: input.organizacionId,
      usuario_id: request.user?.sub,
      accion: input.accion,
      recurso: input.recurso,
      recurso_id: input.recursoId,
      descripcion: input.descripcion,
      datos_antes: toJsonSafe(input.datosAntes),
      datos_despues: toJsonSafe(input.datosDespues),
      ip: request.ip,
      user_agent: request.headers['user-agent'],
      fecha: new Date(),
    },
  });
}
