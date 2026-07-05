import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoEncuentro } from '../../core/enums/hce.enums.js';
import type { IniciarEncuentroInput } from './encuentro.schemas.js';

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
