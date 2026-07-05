import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoEncuentro } from '../../core/enums/hce.enums.js';
import type { IniciarEncuentroInput, CrearNotaInput, ActualizarNotaInput } from './encuentro.schemas.js';

/** Estados de cita desde los que se puede iniciar una consulta. */
const CITA_ESTADOS_INICIABLES = ['programada', 'confirmada'] as const;

export class HceService {
  // ─── Guards privados ────────────────────────────────────────────────────────

  private async assertPacienteTenant(pacienteId: string, tenantOrgId: string) {
    const rel = await prisma.paciente_organizacion.findFirst({
      where: {
        paciente_id: pacienteId,
        organizacion_id: tenantOrgId,
        paciente: { deleted: false },
      },
      select: { paciente_id: true },
    });
    if (!rel) {
      throw new HttpError(404, 'PACIENTE_NOT_FOUND', 'Paciente no encontrado en la organización.');
    }
  }

  private async assertSedeTenant(sedeId: string, tenantOrgId: string) {
    const sede = await prisma.sede.findFirst({
      where: { id: sedeId, organizacion_id: tenantOrgId, deleted: false, activo: true },
      select: { id: true },
    });
    if (!sede) {
      throw new HttpError(404, 'SEDE_NOT_FOUND', 'Sede no encontrada o inactiva.');
    }
  }

  private async assertPlantillaTenant(plantillaId: string, tenantOrgId: string) {
    const plantilla = await prisma.plantilla_especialidad.findFirst({
      where: { id: plantillaId, organizacion_id: tenantOrgId, deleted: false, activo: true },
      select: { id: true },
    });
    if (!plantilla) {
      throw new HttpError(404, 'PLANTILLA_NOT_FOUND', 'Plantilla de especialidad no encontrada.');
    }
  }

  private async getCitaParaEncuentro(
    citaId: string,
    medicoId: string,
    pacienteId: string,
    tenantOrgId: string,
  ) {
    const cita = await prisma.cita.findFirst({
      where: {
        id: citaId,
        deleted: false,
        sede: { organizacion_id: tenantOrgId, deleted: false },
      },
      select: { id: true, paciente_id: true, usuario_id: true, estado: true },
    });

    if (!cita) {
      throw new HttpError(404, 'CITA_NOT_FOUND', 'Cita no encontrada.');
    }
    if (cita.usuario_id !== medicoId) {
      throw new HttpError(403, 'FORBIDDEN', 'La cita no pertenece al médico autenticado.');
    }
    if (cita.paciente_id !== pacienteId) {
      throw new HttpError(409, 'CITA_PACIENTE_INVALIDO', 'El paciente no corresponde a la cita indicada.');
    }
    if (!(CITA_ESTADOS_INICIABLES as readonly string[]).includes(cita.estado)) {
      throw new HttpError(
        409,
        'ESTADO_CITA_INVALIDO',
        `La cita está en estado "${cita.estado}". Solo se puede iniciar desde: ${CITA_ESTADOS_INICIABLES.join(', ')}.`,
      );
    }

    return cita;
  }

  // ─── UC-HCE-001 ─────────────────────────────────────────────────────────────

  async iniciarEncuentro(
    tenantOrgId: string,
    medicoId: string,
    input: IniciarEncuentroInput,
  ) {
    // Validaciones paralelas de entidades base
    await Promise.all([
      this.assertPacienteTenant(input.paciente_id, tenantOrgId),
      this.assertSedeTenant(input.sede_id, tenantOrgId),
      input.plantilla_id
        ? this.assertPlantillaTenant(input.plantilla_id, tenantOrgId)
        : Promise.resolve(),
    ]);

    // Si se indica cita, validar antes de la transacción
    if (input.cita_id) {
      await this.getCitaParaEncuentro(input.cita_id, medicoId, input.paciente_id, tenantOrgId);
    }

    // Transacción: cambiar cita a en_curso + crear encuentro
    const encuentro = await prisma.$transaction(async (tx) => {
      if (input.cita_id) {
        await tx.cita.update({
          where: { id: input.cita_id },
          data: { estado: 'en_curso', updated_at: new Date() },
        });
      }

      return tx.encuentro.create({
        data: {
          paciente_id: input.paciente_id,
          usuario_id: medicoId,
          sede_id: input.sede_id,
          cita_id: input.cita_id ?? null,
          plantilla_id: input.plantilla_id ?? null,
          tipo: input.tipo,
          motivo_consulta: cleanStr(input.motivo_consulta) ?? null,
          estado: EstadoEncuentro.Abierto,
          deleted: false,
        },
      });
    });

    // Cargar contexto del paciente en batch (una sola ronda de queries)
    const [alergias, medicacionActiva, ultimosEncuentros, estudiosPendientes] =
      await prisma.$transaction([
        prisma.alergia.findMany({
          where: { paciente_id: input.paciente_id, deleted: false, activo: true },
          orderBy: { created_at: 'desc' },
        }),
        prisma.prescripcion.findMany({
          where: {
            encuentro: { paciente_id: input.paciente_id, deleted: false },
            estado: 'activa',
            deleted: false,
          },
          select: {
            id: true,
            medicamento: true,
            principio_activo: true,
            dosis: true,
            via: true,
            frecuencia: true,
            duracion: true,
            indicaciones: true,
            estado: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.encuentro.findMany({
          where: {
            paciente_id: input.paciente_id,
            deleted: false,
            NOT: { id: encuentro.id },
          },
          select: {
            id: true,
            fecha: true,
            tipo: true,
            estado: true,
            motivo_consulta: true,
            usuario: {
              select: { id: true, nombre: true, apellido: true, especialidad: true },
            },
            sede: { select: { id: true, nombre: true } },
          },
          orderBy: { fecha: 'desc' },
          take: 5,
        }),
        prisma.estudio_solicitado.findMany({
          where: {
            encuentro: { paciente_id: input.paciente_id, deleted: false },
            estado: 'solicitado',
            deleted: false,
          },
          select: {
            id: true,
            tipo: true,
            nombre: true,
            descripcion: true,
            urgente: true,
            estado: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
        }),
      ]);

    return {
      encuentro: serializeDates(encuentro),
      contexto: {
        alergias,
        medicacion_activa: medicacionActiva,
        ultimos_encuentros: ultimosEncuentros,
        estudios_pendientes: estudiosPendientes,
      },
    };
  }

  // ─── UC-HCE-002 — Nota clínica ──────────────────────────────────────────────

  /** Carga la nota con sus diagnósticos activos. */
  private async getNotaConDiagnosticos(notaId: string) {
    return prisma.nota_clinica.findFirst({
      where: { id: notaId, deleted: false },
      include: {
        diagnostico: {
          where: { deleted: false },
          orderBy: { created_at: 'asc' },
        },
      },
    });
  }

  async crearNota(encuentroId: string, tenantOrgId: string, input: CrearNotaInput) {
    const encuentro = await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    if (encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede escribir la nota: el encuentro está en estado "${encuentro.estado}".`,
      );
    }

    // Solo se permite una nota por encuentro
    const notaExistente = await prisma.nota_clinica.findFirst({
      where: { encuentro_id: encuentroId, deleted: false },
      select: { id: true },
    });
    if (notaExistente) {
      throw new HttpError(
        409,
        'NOTA_YA_EXISTE',
        'Ya existe una nota clínica para este encuentro. Use PATCH para actualizarla.',
      );
    }

    const nota = await prisma.$transaction(async (tx) => {
      const nuevaNota = await tx.nota_clinica.create({
        data: {
          encuentro_id: encuentroId,
          motivo_consulta: cleanStr(input.motivo_consulta) ?? null,
          enfermedad_actual: cleanStr(input.enfermedad_actual) ?? null,
          antecedentes: cleanStr(input.antecedentes) ?? null,
          examen_fisico: cleanStr(input.examen_fisico) ?? null,
          impresion_diagnostica: cleanStr(input.impresion_diagnostica) ?? null,
          plan_tratamiento: cleanStr(input.plan_tratamiento) ?? null,
          estudios_solicitados_texto: cleanStr(input.estudios_solicitados_texto) ?? null,
          recomendaciones: cleanStr(input.recomendaciones) ?? null,
          datos_adicionales: (input.datos_adicionales ?? {}) as unknown as never,
          deleted: false,
        },
      });

      if (input.diagnosticos?.length) {
        await tx.diagnostico.createMany({
          data: input.diagnosticos.map((d) => ({
            nota_clinica_id: nuevaNota.id,
            codigo_icd10: d.codigo_icd10,
            descripcion: d.descripcion,
            tipo: d.tipo,
            notas: cleanStr(d.notas) ?? null,
            deleted: false,
          })),
        });
      }

      return nuevaNota;
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return serializeDates((await this.getNotaConDiagnosticos(nota.id))!);
  }

  async actualizarNota(encuentroId: string, tenantOrgId: string, input: ActualizarNotaInput) {
    const encuentro = await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    if (encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede editar la nota: el encuentro está en estado "${encuentro.estado}".`,
      );
    }

    const notaExistente = await prisma.nota_clinica.findFirst({
      where: { encuentro_id: encuentroId, deleted: false },
      select: { id: true },
    });
    if (!notaExistente) {
      throw new HttpError(
        404,
        'NOTA_NOT_FOUND',
        'No existe nota clínica para este encuentro. Use POST para crearla.',
      );
    }

    const notaId = notaExistente.id;

    // Construir objeto de actualización solo con campos presentes en el input
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (input.motivo_consulta !== undefined)
      updateData['motivo_consulta'] = cleanStr(input.motivo_consulta) ?? null;
    if (input.enfermedad_actual !== undefined)
      updateData['enfermedad_actual'] = cleanStr(input.enfermedad_actual) ?? null;
    if (input.antecedentes !== undefined)
      updateData['antecedentes'] = cleanStr(input.antecedentes) ?? null;
    if (input.examen_fisico !== undefined)
      updateData['examen_fisico'] = cleanStr(input.examen_fisico) ?? null;
    if (input.impresion_diagnostica !== undefined)
      updateData['impresion_diagnostica'] = cleanStr(input.impresion_diagnostica) ?? null;
    if (input.plan_tratamiento !== undefined)
      updateData['plan_tratamiento'] = cleanStr(input.plan_tratamiento) ?? null;
    if (input.estudios_solicitados_texto !== undefined)
      updateData['estudios_solicitados_texto'] = cleanStr(input.estudios_solicitados_texto) ?? null;
    if (input.recomendaciones !== undefined)
      updateData['recomendaciones'] = cleanStr(input.recomendaciones) ?? null;
    if (input.datos_adicionales !== undefined)
      updateData['datos_adicionales'] = input.datos_adicionales;

    await prisma.$transaction(async (tx) => {
      await tx.nota_clinica.update({
        where: { id: notaId },
        data: updateData,
      });

      // Si se envían diagnósticos: reemplazar todos (soft delete + recrear)
      if (input.diagnosticos !== undefined) {
        await tx.diagnostico.updateMany({
          where: { nota_clinica_id: notaId, deleted: false },
          data: { deleted: true, deleted_at: new Date() },
        });

        if (input.diagnosticos.length > 0) {
          await tx.diagnostico.createMany({
            data: input.diagnosticos.map((d) => ({
              nota_clinica_id: notaId,
              codigo_icd10: d.codigo_icd10,
              descripcion: d.descripcion,
              tipo: d.tipo,
              notas: cleanStr(d.notas) ?? null,
              deleted: false,
            })),
          });
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return serializeDates((await this.getNotaConDiagnosticos(notaId))!);
  }

  // ─── Helper para audit (leer estado actual antes de mutaciones) ─────────────

  async getEncuentroOrFail(encuentroId: string, tenantOrgId: string) {
    const row = await prisma.encuentro.findFirst({
      where: {
        id: encuentroId,
        deleted: false,
        sede: { organizacion_id: tenantOrgId, deleted: false },
      },
    });
    if (!row) {
      throw new HttpError(404, 'ENCUENTRO_NOT_FOUND', 'Encuentro no encontrado.');
    }
    return row;
  }
}

export const hceService = new HceService();
