import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────
// vi.mock() se hoista al tope del archivo por Vitest.
// Para que las variables del factory no estén "antes de su inicialización",
// se deben declarar con vi.hoisted().

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    nota_clinica: {
      create: vi.fn(),
      update: vi.fn(),
    },
    diagnostico: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const mockPrisma = {
    encuentro: { findFirst: vi.fn() },
    nota_clinica: { findFirst: vi.fn() },
    diagnostico: { createMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return { mockPrisma, mockTx };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));

// serializeDates solo convierte Dates a strings — passthrough en tests.
vi.mock('../../../core/utils/dates.js', () => ({
  serializeDates: (obj: unknown) => obj,
}));

// ── Import del módulo bajo test ───────────────────────────────────────────────
import { HceService } from '../encuentro.service.js';
import { HttpError } from '../../../core/errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ENCUENTRO_ID = 'enc-222';
const NOTA_ID = 'nota-333';

const makeEncuentro = (estado = 'abierto') => ({
  id: ENCUENTRO_ID,
  paciente_id: 'pac-444',
  usuario_id: 'usr-555',
  sede_id: 'sede-666',
  cita_id: null,
  plantilla_id: null,
  tipo: 'primera_vez',
  motivo_consulta: null,
  estado,
  fecha: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  deleted: false,
  deleted_at: null,
});

const makeNota = (overrides = {}) => ({
  id: NOTA_ID,
  encuentro_id: ENCUENTRO_ID,
  motivo_consulta: null,
  enfermedad_actual: null,
  antecedentes: null,
  examen_fisico: null,
  impresion_diagnostica: null,
  plan_tratamiento: null,
  estudios_solicitados_texto: null,
  recomendaciones: null,
  datos_adicionales: {},
  created_at: new Date(),
  updated_at: new Date(),
  deleted: false,
  deleted_at: null,
  diagnostico: [],
  ...overrides,
});

// ── Setup ─────────────────────────────────────────────────────────────────────

let service: HceService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new HceService();

  // Por defecto, $transaction llama el callback con mockTx (operaciones de escritura)
  // o hace Promise.all (batch de lecturas).
  mockPrisma.$transaction.mockImplementation(async (fnOrArray: unknown) => {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(mockTx);
    }
    return Promise.all(fnOrArray as Promise<unknown>[]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// crearNota
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.crearNota', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(service.crearNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 404,
      code: 'ENCUENTRO_NOT_FOUND',
    });
  });

  it('lanza 409 ENCUENTRO_NO_ABIERTO si el encuentro está cerrado', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('cerrado'));

    await expect(service.crearNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'ENCUENTRO_NO_ABIERTO',
    });
  });

  it('lanza 409 ENCUENTRO_NO_ABIERTO si el encuentro está firmado', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('firmado'));

    await expect(service.crearNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'ENCUENTRO_NO_ABIERTO',
    });
  });

  it('lanza 409 NOTA_YA_EXISTE si ya hay una nota para el encuentro', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst.mockResolvedValue({ id: NOTA_ID });

    await expect(service.crearNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'NOTA_YA_EXISTE',
    });
  });

  it('crea la nota correctamente sin diagnósticos', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    // primera llamada: check nota existente → null
    // segunda llamada (getNotaConDiagnosticos): devuelve la nota creada
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeNota());

    mockTx.nota_clinica.create.mockResolvedValue({ id: NOTA_ID });

    const result = await service.crearNota(ENCUENTRO_ID, ORG_ID, {
      motivo_consulta: 'Dolor de cabeza',
      plan_tratamiento: 'Reposo',
    });

    expect(mockTx.nota_clinica.create).toHaveBeenCalledOnce();
    expect(mockTx.diagnostico.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: NOTA_ID, encuentro_id: ENCUENTRO_ID });
  });

  it('crea la nota con diagnósticos ICD-10', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        makeNota({
          diagnostico: [
            { id: 'dx-1', codigo_icd10: 'J06.9', descripcion: 'IVRS', tipo: 'principal', notas: null },
          ],
        }),
      );

    mockTx.nota_clinica.create.mockResolvedValue({ id: NOTA_ID });
    mockTx.diagnostico.createMany.mockResolvedValue({ count: 1 });

    const result = await service.crearNota(ENCUENTRO_ID, ORG_ID, {
      impresion_diagnostica: 'Infección respiratoria',
      diagnosticos: [{ codigo_icd10: 'J06.9', descripcion: 'IVRS', tipo: 'principal' }],
    });

    expect(mockTx.diagnostico.createMany).toHaveBeenCalledOnce();
    expect(mockTx.diagnostico.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ codigo_icd10: 'J06.9', tipo: 'principal' }),
        ]),
      }),
    );
    expect((result as { diagnostico: unknown[] }).diagnostico).toHaveLength(1);
  });

  it('limpia strings vacíos (cleanStr) antes de persistir', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeNota());

    mockTx.nota_clinica.create.mockResolvedValue({ id: NOTA_ID });

    await service.crearNota(ENCUENTRO_ID, ORG_ID, {
      motivo_consulta: '   ',   // solo espacios → debe quedar null
      antecedentes: '',
    });

    expect(mockTx.nota_clinica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motivo_consulta: null,
          antecedentes: null,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// actualizarNota
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.actualizarNota', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(service.actualizarNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 404,
      code: 'ENCUENTRO_NOT_FOUND',
    });
  });

  it('lanza 409 ENCUENTRO_NO_ABIERTO si el encuentro no está abierto', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('firmado'));

    await expect(service.actualizarNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'ENCUENTRO_NO_ABIERTO',
    });
  });

  it('lanza 404 NOTA_NOT_FOUND si no existe nota para el encuentro', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst.mockResolvedValueOnce(null);

    await expect(service.actualizarNota(ENCUENTRO_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTA_NOT_FOUND',
    });
  });

  it('actualiza solo los campos enviados (partial update)', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce({ id: NOTA_ID })         // check existe
      .mockResolvedValueOnce(makeNota({ plan_tratamiento: 'Reposo 3 días' }));

    mockTx.nota_clinica.update.mockResolvedValue({});

    await service.actualizarNota(ENCUENTRO_ID, ORG_ID, { plan_tratamiento: 'Reposo 3 días' });

    expect(mockTx.nota_clinica.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan_tratamiento: 'Reposo 3 días' }),
      }),
    );
    // Sin diagnósticos en el input → no tocar la tabla diagnostico
    expect(mockTx.diagnostico.updateMany).not.toHaveBeenCalled();
    expect(mockTx.diagnostico.createMany).not.toHaveBeenCalled();
  });

  it('reemplaza diagnósticos cuando se envía el array', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce({ id: NOTA_ID })
      .mockResolvedValueOnce(
        makeNota({
          diagnostico: [
            { id: 'dx-new', codigo_icd10: 'K21.0', descripcion: 'ERGE', tipo: 'principal', notas: null },
          ],
        }),
      );

    mockTx.nota_clinica.update.mockResolvedValue({});
    mockTx.diagnostico.updateMany.mockResolvedValue({ count: 1 });
    mockTx.diagnostico.createMany.mockResolvedValue({ count: 1 });

    await service.actualizarNota(ENCUENTRO_ID, ORG_ID, {
      diagnosticos: [{ codigo_icd10: 'K21.0', descripcion: 'ERGE', tipo: 'principal' }],
    });

    // Soft-delete de diagnósticos anteriores
    expect(mockTx.diagnostico.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nota_clinica_id: NOTA_ID, deleted: false }),
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    // Crear los nuevos
    expect(mockTx.diagnostico.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ codigo_icd10: 'K21.0', tipo: 'principal' }),
        ]),
      }),
    );
  });

  it('borra todos los diagnósticos si se envía array vacío', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('abierto'));
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce({ id: NOTA_ID })
      .mockResolvedValueOnce(makeNota());

    mockTx.nota_clinica.update.mockResolvedValue({});
    mockTx.diagnostico.updateMany.mockResolvedValue({ count: 2 });

    await service.actualizarNota(ENCUENTRO_ID, ORG_ID, { diagnosticos: [] });

    expect(mockTx.diagnostico.updateMany).toHaveBeenCalled();  // soft delete
    expect(mockTx.diagnostico.createMany).not.toHaveBeenCalled(); // nada que crear
  });
});
