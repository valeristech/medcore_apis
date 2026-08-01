import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    encuentro: { findFirst: vi.fn() },
    evolucion: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../../core/utils/dates.js', () => ({
  serializeDates: (obj: unknown) => obj,
  serializeExtraFecha: (obj: unknown) => obj,
}));

// ── Import bajo test ──────────────────────────────────────────────────────────

import { HceService } from '../encuentro.service.js';
import { HttpError } from '../../../core/errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ENCUENTRO_ID = 'enc-222';
const EVOLUCION_ID = 'evo-333';
const PACIENTE_ID = 'pac-444';
const SEDE_ID = 'sede-555';
const USUARIO_ID = 'usr-777';
const OTRO_USUARIO_ID = 'usr-888'; // p. ej. enfermería, distinto de quien inició el encuentro

const makeEncuentro = (estado = 'abierto') => ({
  id: ENCUENTRO_ID,
  paciente_id: PACIENTE_ID,
  usuario_id: USUARIO_ID,
  sede_id: SEDE_ID,
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

const makeEvolucion = (overrides = {}) => ({
  id: EVOLUCION_ID,
  encuentro_id: ENCUENTRO_ID,
  usuario_id: USUARIO_ID,
  nota: 'Paciente estable, tolera vía oral.',
  tipo: 'medica',
  fecha: new Date(),
  created_at: new Date(),
  deleted: false,
  deleted_at: null,
  ...overrides,
});

let service: HceService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new HceService();
});

// ─────────────────────────────────────────────────────────────────────────────
// crearEvolucion
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.crearEvolucion', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(
      service.crearEvolucion(ENCUENTRO_ID, ORG_ID, USUARIO_ID, { nota: 'Evoluciona bien.' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ENCUENTRO_NOT_FOUND' });
  });

  it('lanza 409 si el encuentro no está abierto', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('cerrado'));

    await expect(
      service.crearEvolucion(ENCUENTRO_ID, ORG_ID, USUARIO_ID, { nota: 'Evoluciona bien.' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_NO_ABIERTO' });
  });

  it('usa tipo "medica" por defecto si no se envía', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.evolucion.create.mockResolvedValue(makeEvolucion());

    await service.crearEvolucion(ENCUENTRO_ID, ORG_ID, USUARIO_ID, { nota: 'Evoluciona bien.' });

    expect(mockPrisma.evolucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'medica' }) }),
    );
  });

  it('respeta el tipo enviado (enfermeria)', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.evolucion.create.mockResolvedValue(makeEvolucion({ tipo: 'enfermeria' }));

    await service.crearEvolucion(ENCUENTRO_ID, ORG_ID, OTRO_USUARIO_ID, {
      nota: 'Signos vitales estables.', tipo: 'enfermeria',
    });

    expect(mockPrisma.evolucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'enfermeria' }) }),
    );
  });

  it('toma usuario_id del llamador (JWT), no del body', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.evolucion.create.mockResolvedValue(makeEvolucion({ usuario_id: OTRO_USUARIO_ID }));

    await service.crearEvolucion(ENCUENTRO_ID, ORG_ID, OTRO_USUARIO_ID, { nota: 'Nota de enfermería.' });

    expect(mockPrisma.evolucion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuario_id: OTRO_USUARIO_ID }) }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listarEvoluciones
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.listarEvoluciones', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(service.listarEvoluciones(ENCUENTRO_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'ENCUENTRO_NOT_FOUND',
    });
  });

  it('retorna lista vacía si no hay evoluciones', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.evolucion.findMany.mockResolvedValue([]);

    const result = await service.listarEvoluciones(ENCUENTRO_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('lista en orden cronológico ascendente por fecha', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.evolucion.findMany.mockResolvedValue([
      makeEvolucion(),
      makeEvolucion({ id: 'evo-444', tipo: 'enfermeria' }),
    ]);

    const result = await service.listarEvoluciones(ENCUENTRO_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(mockPrisma.evolucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encuentro_id: ENCUENTRO_ID, deleted: false }),
        orderBy: { fecha: 'asc' },
      }),
    );
  });
});
