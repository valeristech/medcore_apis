import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { HttpError } from "../../core/errors.js";
import { cleanStr } from "../../core/utils/strings.js";
import type {
  CreateSeguroInput,
  UpdateSeguroInput,
} from "./paciente.schemas.js";

const ASEGURADORA_SELECT = {
  aseguradora: { select: { id: true, nombre: true, nit: true } },
} as const;

export class SeguroService {
  private async assertSeguroOr404(seguroId: string, pacienteId: string) {
    const seguro = await prisma.paciente_seguro.findFirst({
      where: { id: seguroId, paciente_id: pacienteId, deleted: false },
    });
    if (!seguro) throw new HttpError(404, "NOT_FOUND", "Seguro no encontrado.");
    return seguro;
  }

  async list(pacienteId: string) {
    return prisma.paciente_seguro.findMany({
      where: { paciente_id: pacienteId, deleted: false },
      include: ASEGURADORA_SELECT,
      orderBy: { created_at: "desc" },
    });
  }

  async getById(pacienteId: string, seguroId: string) {
    await this.assertSeguroOr404(seguroId, pacienteId);
    return prisma.paciente_seguro.findFirst({
      where: { id: seguroId, paciente_id: pacienteId, deleted: false },
      include: ASEGURADORA_SELECT,
    });
  }

  async create(pacienteId: string, input: CreateSeguroInput) {
    const aseguradora = await prisma.aseguradora.findFirst({
      where: { id: input.aseguradora_id, deleted: false },
      select: { id: true },
    });
    if (!aseguradora)
      throw new HttpError(404, "NOT_FOUND", "Aseguradora no encontrada.");

    return prisma.paciente_seguro.create({
      data: {
        paciente_id: pacienteId,
        aseguradora_id: input.aseguradora_id,
        numero_poliza: input.numero_poliza.trim(),
        tipo_plan: cleanStr(input.tipo_plan) ?? null,
        vigencia_inicio: input.vigencia_inicio
          ? new Date(input.vigencia_inicio)
          : null,
        vigencia_fin: input.vigencia_fin ? new Date(input.vigencia_fin) : null,
        activo: true,
        deleted: false,
      },
      include: ASEGURADORA_SELECT,
    });
  }

  async update(pacienteId: string, seguroId: string, input: UpdateSeguroInput) {
    await this.assertSeguroOr404(seguroId, pacienteId);

    const data: Prisma.paciente_seguroUncheckedUpdateInput = {};
    if (input.numero_poliza !== undefined)
      data.numero_poliza = input.numero_poliza.trim();
    if (input.tipo_plan !== undefined)
      data.tipo_plan = cleanStr(input.tipo_plan) ?? null;
    if (input.vigencia_inicio !== undefined)
      data.vigencia_inicio = input.vigencia_inicio
        ? new Date(input.vigencia_inicio)
        : null;
    if (input.vigencia_fin !== undefined)
      data.vigencia_fin = input.vigencia_fin
        ? new Date(input.vigencia_fin)
        : null;
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.paciente_seguro.update({
      where: { id: seguroId },
      data,
      include: ASEGURADORA_SELECT,
    });
  }

  async remove(pacienteId: string, seguroId: string) {
    await this.assertSeguroOr404(seguroId, pacienteId);
    await prisma.paciente_seguro.update({
      where: { id: seguroId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const seguroService = new SeguroService();
