import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    firma: { create: vi.fn() },
    encuentro: { update: vi.fn() },
    cita: { update: vi.fn() },
  };

  const mockPrisma = {
    encuentro: { findFirst: vi.fn() },
    nota_clinica: { findFirst: vi.fn() },
    prescripcion: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return { mockPrisma, mockTx };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../../core/utils/dates.js', () => ({ serializeDates: (obj: unknown) => obj }));

// ── Import bajo test ──────────────────────────────────────────────────────────

import { HceService } from '../encuentro.service.js';
import { HttpError } from '../../../core/errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ENCUENTRO_ID = 'enc-222';
const MEDICO_ID = 'usr-555';
const OTRO_MEDICO_ID = 'usr-999';
const CITA_ID = 'cita-666';
const NOTA_ID = 'nota-333';

const makeEncuentro = (overrides = {}) => ({
  id: ENCUENTRO_ID,
  paciente_id: 'pac-444',
  usuario_id: MEDICO_ID,
  sede_id: 'sede-777',
  cita_id: null,
  plantilla_id: null,
  tipo: 'primera_vez',
  motivo_consulta: null,
  estado: 'abierto',
  fecha: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  deleted: false,
  deleted_at: null,
  ...overrides,
});

const makeNota = (overrides = {}) => ({
  id: NOTA_ID,
  encuentro_id: ENCUENTRO_ID,
  motivo_consulta: 'Dolor de cabeza',
  enfermedad_actual: null,
  antecedentes: null,
  examen_fisico: null,
  impresion_diagnostica: null,
  plan_tratamiento: 'Reposo',
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

let service: HceService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new HceService();

  mockPrisma.$transaction.mockImplementation(async (fnOrArray: unknown) => {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(mockTx);
    }
    return Promise.all(fnOrArray as Promise<unknown>[]);
  });

  mockPrisma.prescripcion.findMany.mockResolvedValue([]);
  mockTx.firma.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'firma-888', ...data }),
  );
  mockTx.encuentro.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...makeEncuentro(), ...data }),
  );
  mockTx.cita.update.mockResolvedValue({});
});

describe('HceService.firmarEncuentro', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(
      service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ENCUENTRO_NOT_FOUND' });
  });

  it('lanza 403 si el usuario no es el médico dueño del encuentro', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());

    await expect(
      service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, OTRO_MEDICO_ID, '127.0.0.1'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza 409 ENCUENTRO_YA_FIRMADO si ya está firmado', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro({ estado: 'firmado' }));

    await expect(
      service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_YA_FIRMADO' });
  });

  it('lanza 409 ENCUENTRO_NO_ABIERTO si está en otro estado (cerrado)', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro({ estado: 'cerrado' }));

    await expect(
      service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_NO_ABIERTO' });
  });

  it('lanza 409 NOTA_REQUERIDA si el encuentro no tiene nota clínica', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(null);

    await expect(
      service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'NOTA_REQUERIDA' });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('crea la firma con tipo "electronica" y hash SHA-256 (64 hex chars)', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(makeNota());

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');

    expect(mockTx.firma.create).toHaveBeenCalledOnce();
    const data = mockTx.firma.create.mock.calls[0][0].data;
    expect(data.tipo).toBe('electronica');
    expect(data.usuario_id).toBe(MEDICO_ID);
    expect(data.ip_origen).toBe('127.0.0.1');
    expect(data.hash_documento).toMatch(/^[a-f0-9]{64}$/);
  });

  it('actualiza el encuentro a estado "firmado"', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(makeNota());

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');

    expect(mockTx.encuentro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ENCUENTRO_ID },
        data: expect.objectContaining({ estado: 'firmado' }),
      }),
    );
  });

  it('actualiza la cita a "completada" cuando el encuentro tiene cita_id', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro({ cita_id: CITA_ID }));
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(makeNota());

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');

    expect(mockTx.cita.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CITA_ID },
        data: expect.objectContaining({ estado: 'completada' }),
      }),
    );
  });

  it('no toca cita cuando el encuentro no tiene cita_id', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro({ cita_id: null }));
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(makeNota());

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');

    expect(mockTx.cita.update).not.toHaveBeenCalled();
  });

  it('el hash es determinístico para el mismo contenido y cambia si el contenido cambia', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.nota_clinica.findFirst
      .mockResolvedValueOnce(makeNota({ plan_tratamiento: 'Reposo' }))
      .mockResolvedValueOnce(makeNota({ plan_tratamiento: 'Reposo' })) // mismo contenido
      .mockResolvedValueOnce(makeNota({ plan_tratamiento: 'Cirugía' })); // contenido distinto

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');
    const hashA = mockTx.firma.create.mock.calls[0][0].data.hash_documento;

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');
    const hashB = mockTx.firma.create.mock.calls[1][0].data.hash_documento;

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');
    const hashC = mockTx.firma.create.mock.calls[2][0].data.hash_documento;

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it('solo trae diagnósticos y prescripciones no eliminados para el hash', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.nota_clinica.findFirst.mockResolvedValue(makeNota());

    await service.firmarEncuentro(ENCUENTRO_ID, ORG_ID, MEDICO_ID, '127.0.0.1');

    expect(mockPrisma.nota_clinica.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encuentro_id: ENCUENTRO_ID, deleted: false }),
        include: expect.objectContaining({
          diagnostico: expect.objectContaining({ where: { deleted: false } }),
        }),
      }),
    );
    expect(mockPrisma.prescripcion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encuentro_id: ENCUENTRO_ID, deleted: false }),
      }),
    );
  });
});
