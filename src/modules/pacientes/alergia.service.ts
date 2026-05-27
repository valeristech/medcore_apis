import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { HttpError } from "../../core/errors.js";
import { cleanStr } from "../../core/utils/strings.js";
import type {
  CreateAlergiaInput,
  UpdateAlergiaInput,
} from "./paciente.schemas.js";

export class AlergiaService {
  private async assertAlergiaOr404(alergiaId: string, pacienteId: string) {
    const alergia = await prisma.alergia.findFirst({
      where: { id: alergiaId, paciente_id: pacienteId, deleted: false },
    });
    if (!alergia)
      throw new HttpError(404, "NOT_FOUND", "Alergia no encontrada.");
    return alergia;
  }

  async list(pacienteId: string) {
    return prisma.alergia.findMany({
      where: { paciente_id: pacienteId, deleted: false },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(pacienteId: string, alergiaId: string) {
    return this.assertAlergiaOr404(alergiaId, pacienteId);
  }

  async create(pacienteId: string, input: CreateAlergiaInput) {
    return prisma.alergia.create({
      data: {
        paciente_id: pacienteId,
        sustancia: input.sustancia.trim(),
        tipo_reaccion: cleanStr(input.tipo_reaccion) ?? null,
        severidad: input.severidad,
        notas: cleanStr(input.notas) ?? null,
        activo: true,
        deleted: false,
      },
    });
  }

  async update(
    pacienteId: string,
    alergiaId: string,
    input: UpdateAlergiaInput,
  ) {
    await this.assertAlergiaOr404(alergiaId, pacienteId);

    const data: Prisma.alergiaUncheckedUpdateInput = {};
    if (input.sustancia !== undefined) data.sustancia = input.sustancia.trim();
    if (input.tipo_reaccion !== undefined)
      data.tipo_reaccion = cleanStr(input.tipo_reaccion) ?? null;
    if (input.severidad !== undefined) data.severidad = input.severidad;
    if (input.notas !== undefined) data.notas = cleanStr(input.notas) ?? null;
    if (input.activo !== undefined) data.activo = input.activo;

    return prisma.alergia.update({ where: { id: alergiaId }, data });
  }

  async remove(pacienteId: string, alergiaId: string) {
    await this.assertAlergiaOr404(alergiaId, pacienteId);
    await prisma.alergia.update({
      where: { id: alergiaId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }
}

export const alergiaService = new AlergiaService();
