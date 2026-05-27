import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";

// ─── Ubicación (municipio + departamento) ────────────────────────────────────

export const UBICACION_INCLUDE = {
  municipio: {
    include: {
      departamento: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          activo: true,
          deleted: true,
        },
      },
    },
  },
} as const;

export type PacienteUbicacionPayload = Prisma.pacienteGetPayload<{
  include: typeof UBICACION_INCLUDE;
}>;

export function buildUbicacion(m: PacienteUbicacionPayload["municipio"]) {
  if (
    !m ||
    m.deleted ||
    m.activo === false ||
    !m.departamento ||
    m.departamento.deleted ||
    m.departamento.activo === false
  ) {
    return null;
  }
  return {
    municipio: { id: m.id, codigo: m.codigo, nombre: m.nombre },
    departamento: {
      id: m.departamento.id,
      codigo: m.departamento.codigo,
      nombre: m.departamento.nombre,
    },
  };
}

// ─── Número de expediente ────────────────────────────────────────────────────

/**
 * Genera el siguiente número de expediente para el tenant → EXP-2026-0001.
 * Debe llamarse fuera de la transacción de creación para evitar deadlocks.
 */
export async function generateNumeroExpediente(
  tenantOrgId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.paciente_organizacion.count({
    where: { organizacion_id: tenantOrgId },
  });
  const correlativo = String(count + 1).padStart(4, "0");
  return `EXP-${year}-${correlativo}`;
}
