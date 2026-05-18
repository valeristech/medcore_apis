import type { Prisma } from '@prisma/client';

export type SugerenciasListaEsperaParams = {
  usuario_id?: string;
  tipo_cita_id?: string;
  /** YYYY-MM-DD — el slot debe caer dentro de [fecha_desde, fecha_hasta] si están definidas. */
  fecha?: string;
};

/** Filtro de candidatos activos para ofrecer un hueco liberado (UC-AGE-004 / UC-AGE-007). */
export function buildListaEsperaSugerenciasWhere(
  params: SugerenciasListaEsperaParams,
): Prisma.lista_esperaWhereInput {
  const slotDate = params.fecha?.trim();

  const fechaRango: Prisma.lista_esperaWhereInput =
    slotDate !== undefined && slotDate !== ''
      ? {
          AND: [
            { OR: [{ fecha_desde: null }, { fecha_desde: { lte: new Date(`${slotDate}T23:59:59.999Z`) } }] },
            { OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date(`${slotDate}T00:00:00.000Z`) } }] },
          ],
        }
      : {};

  return {
    deleted: false,
    estado: 'activa',
    ...(params.usuario_id
      ? { OR: [{ usuario_id: params.usuario_id }, { usuario_id: null }] }
      : {}),
    ...(params.tipo_cita_id
      ? {
          AND: [{ OR: [{ tipo_cita_id: params.tipo_cita_id }, { tipo_cita_id: null }] }],
        }
      : {}),
    ...fechaRango,
  };
}
