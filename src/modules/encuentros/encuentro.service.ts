import prisma from '../../config/prisma.js';
import { HttpError } from '../../core/errors.js';
import { serializeDates } from '../../core/utils/dates.js';
import { cleanStr } from '../../core/utils/strings.js';
import { EstadoEncuentro, EstadoPrescripcion, EstadoEstudio } from '../../core/enums/hce.enums.js';
import type { IniciarEncuentroInput, CrearNotaInput, ActualizarNotaInput } from './encuentro.schemas.js';
import type { CrearPrescripcionInput, ActualizarPrescripcionInput } from './prescripcion.schemas.js';
import type { CrearEstudioInput, ActualizarEstudioInput } from './estudio.schemas.js';

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

  // ─── UC-HCE-003 — Prescripciones ────────────────────────────────────────────

  async crearPrescripcion(
    encuentroId: string,
    tenantOrgId: string,
    input: CrearPrescripcionInput,
  ) {
    const encuentro = await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    if (encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede prescribir: el encuentro está en estado "${encuentro.estado}".`,
      );
    }

    // Validar producto si viene en el input
    let stockInfo: { cantidad: number; bodega: string | null } | null = null;
    if (input.producto_id) {
      const producto = await prisma.producto.findFirst({
        where: {
          id: input.producto_id,
          organizacion_id: tenantOrgId,
          deleted: false,
          activo: true,
        },
        select: { id: true },
      });
      if (!producto) {
        throw new HttpError(404, 'PRODUCTO_NOT_FOUND', 'Producto no encontrado o inactivo.');
      }

      // Consultar stock disponible en la sede del encuentro
      const stock = await prisma.stock.findFirst({
        where: {
          producto_id: input.producto_id,
          deleted: false,
          bodegas: { sede_id: encuentro.sede_id, deleted: false },
        },
        select: {
          cantidad: true,
          bodegas: { select: { nombre: true } },
        },
        orderBy: { cantidad: 'desc' },
      });

      stockInfo = stock
        ? { cantidad: Number(stock.cantidad), bodega: stock.bodegas?.nombre ?? null }
        : { cantidad: 0, bodega: null };
    }

    // Cruzar principio_activo contra alergias del paciente
    const alertasAlergia: {
      alergia_id: string;
      sustancia: string;
      severidad: string;
      tipo_reaccion: string | null;
    }[] = [];

    if (input.principio_activo) {
      const principioLower = input.principio_activo.toLowerCase();
      const alergias = await prisma.alergia.findMany({
        where: { paciente_id: encuentro.paciente_id, deleted: false, activo: true },
        select: { id: true, sustancia: true, severidad: true, tipo_reaccion: true },
      });

      for (const alergia of alergias) {
        const sustanciaLower = alergia.sustancia.toLowerCase();
        if (principioLower.includes(sustanciaLower) || sustanciaLower.includes(principioLower)) {
          alertasAlergia.push({
            alergia_id: alergia.id,
            sustancia: alergia.sustancia,
            severidad: alergia.severidad,
            tipo_reaccion: alergia.tipo_reaccion,
          });
        }
      }
    }

    // Crear prescripción
    const prescripcion = await prisma.prescripcion.create({
      data: {
        encuentro_id: encuentroId,
        producto_id: input.producto_id ?? null,
        medicamento: input.medicamento,
        principio_activo: cleanStr(input.principio_activo) ?? null,
        dosis: input.dosis,
        via: cleanStr(input.via) ?? null,
        frecuencia: input.frecuencia,
        duracion: cleanStr(input.duracion) ?? null,
        cantidad: input.cantidad ?? null,
        indicaciones: cleanStr(input.indicaciones) ?? null,
        estado: EstadoPrescripcion.Activa,
        deleted: false,
      },
    });

    return {
      prescripcion: serializeDates(prescripcion),
      alertas_alergia: alertasAlergia,
      stock: stockInfo,
    };
  }

  /** Carga la prescripción verificando que pertenece al tenant vía el encuentro. */
  private async getPrescripcionOrFail(prescripcionId: string, tenantOrgId: string) {
    const rx = await prisma.prescripcion.findFirst({
      where: {
        id: prescripcionId,
        deleted: false,
        encuentro: {
          deleted: false,
          sede: { organizacion_id: tenantOrgId, deleted: false },
        },
      },
      include: { encuentro: { select: { estado: true } } },
    });
    if (!rx) {
      throw new HttpError(404, 'PRESCRIPCION_NOT_FOUND', 'Prescripción no encontrada.');
    }
    return rx;
  }

  /** Versión pública del guard para uso en controllers (audit datosAntes). */
  async getPrescripcionPublic(prescripcionId: string, tenantOrgId: string) {
    return this.getPrescripcionOrFail(prescripcionId, tenantOrgId);
  }

  async actualizarPrescripcion(
    prescripcionId: string,
    tenantOrgId: string,
    input: ActualizarPrescripcionInput,
  ) {
    const rx = await this.getPrescripcionOrFail(prescripcionId, tenantOrgId);

    if (rx.encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede editar la prescripción: el encuentro está en estado "${rx.encuentro.estado}".`,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (input.medicamento !== undefined) updateData['medicamento'] = input.medicamento;
    if (input.principio_activo !== undefined)
      updateData['principio_activo'] = cleanStr(input.principio_activo) ?? null;
    if (input.dosis !== undefined) updateData['dosis'] = input.dosis;
    if (input.via !== undefined) updateData['via'] = cleanStr(input.via) ?? null;
    if (input.frecuencia !== undefined) updateData['frecuencia'] = input.frecuencia;
    if (input.duracion !== undefined) updateData['duracion'] = cleanStr(input.duracion) ?? null;
    if (input.cantidad !== undefined) updateData['cantidad'] = input.cantidad;
    if (input.indicaciones !== undefined)
      updateData['indicaciones'] = cleanStr(input.indicaciones) ?? null;
    if (input.estado !== undefined) updateData['estado'] = input.estado;

    const updated = await prisma.prescripcion.update({
      where: { id: prescripcionId },
      data: updateData,
    });

    return serializeDates(updated);
  }

  async eliminarPrescripcion(prescripcionId: string, tenantOrgId: string) {
    const rx = await this.getPrescripcionOrFail(prescripcionId, tenantOrgId);

    if (rx.encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede eliminar la prescripción: el encuentro está en estado "${rx.encuentro.estado}".`,
      );
    }

    await prisma.prescripcion.update({
      where: { id: prescripcionId },
      data: { deleted: true, deleted_at: new Date() },
    });
  }

  async listarPrescripciones(encuentroId: string, tenantOrgId: string) {
    await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    const items = await prisma.prescripcion.findMany({
      where: { encuentro_id: encuentroId, deleted: false },
      orderBy: { created_at: 'desc' },
    });

    return items.map((p) => serializeDates(p));
  }

  // ─── UC-HCE-004 — Estudios ──────────────────────────────────────────────────

  /** serializeDates no cubre fecha_resultado (propio de estudio_solicitado). */
  private serializeEstudio<T extends Record<string, unknown>>(row: T): T {
    const out = serializeDates(row) as T & Record<string, unknown>;
    const o = out as Record<string, unknown>;
    const fr = o['fecha_resultado'];
    if (fr instanceof Date) o['fecha_resultado'] = fr.toISOString();
    return out;
  }

  async crearEstudio(encuentroId: string, tenantOrgId: string, input: CrearEstudioInput) {
    const encuentro = await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    if (encuentro.estado !== EstadoEncuentro.Abierto) {
      throw new HttpError(
        409,
        'ENCUENTRO_NO_ABIERTO',
        `No se puede solicitar el estudio: el encuentro está en estado "${encuentro.estado}".`,
      );
    }

    const estudio = await prisma.estudio_solicitado.create({
      data: {
        encuentro_id: encuentroId,
        tipo: input.tipo,
        nombre: input.nombre,
        descripcion: cleanStr(input.descripcion) ?? null,
        urgente: input.urgente ?? false,
        estado: EstadoEstudio.Solicitado,
        deleted: false,
      },
    });

    return this.serializeEstudio(estudio);
  }

  async listarEstudios(encuentroId: string, tenantOrgId: string) {
    await this.getEncuentroOrFail(encuentroId, tenantOrgId);

    const items = await prisma.estudio_solicitado.findMany({
      where: { encuentro_id: encuentroId, deleted: false },
      orderBy: { created_at: 'desc' },
    });

    return items.map((e) => this.serializeEstudio(e));
  }

  /** Carga el estudio verificando que pertenece al tenant vía el encuentro. */
  private async getEstudioOrFail(estudioId: string, tenantOrgId: string) {
    const row = await prisma.estudio_solicitado.findFirst({
      where: {
        id: estudioId,
        deleted: false,
        encuentro: { deleted: false, sede: { organizacion_id: tenantOrgId, deleted: false } },
      },
    });
    if (!row) {
      throw new HttpError(404, 'ESTUDIO_NOT_FOUND', 'Estudio no encontrado.');
    }
    return row;
  }

  /** Versión pública del guard para uso en controllers (audit datosAntes). */
  async getEstudioPublic(estudioId: string, tenantOrgId: string) {
    return this.getEstudioOrFail(estudioId, tenantOrgId);
  }

  /**
   * A diferencia de nota clínica y prescripciones, actualizar un estudio NO exige
   * que el encuentro esté "abierto": el resultado de laboratorio/imagen suele llegar
   * días después, cuando el encuentro ya está cerrado o firmado. Bloquearlo aquí
   * dejaría el estudio permanentemente atascado en "solicitado".
   */
  async actualizarEstudio(estudioId: string, tenantOrgId: string, input: ActualizarEstudioInput) {
    await this.getEstudioOrFail(estudioId, tenantOrgId);

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (input.tipo !== undefined) updateData['tipo'] = input.tipo;
    if (input.nombre !== undefined) updateData['nombre'] = input.nombre;
    if (input.descripcion !== undefined) updateData['descripcion'] = cleanStr(input.descripcion) ?? null;
    if (input.urgente !== undefined) updateData['urgente'] = input.urgente;
    if (input.resultado_texto !== undefined) {
      updateData['resultado_texto'] = cleanStr(input.resultado_texto) ?? null;
      updateData['fecha_resultado'] = new Date();
    }
    if (input.estado !== undefined) updateData['estado'] = input.estado;

    const updated = await prisma.estudio_solicitado.update({
      where: { id: estudioId },
      data: updateData,
    });

    return this.serializeEstudio(updated);
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
