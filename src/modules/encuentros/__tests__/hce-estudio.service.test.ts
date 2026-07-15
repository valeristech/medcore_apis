import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    encuentro: { findFirst: vi.fn() },
    estudio_solicitado: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../../core/utils/dates.js', () => ({ serializeDates: (obj: unknown) => obj }));

// ── Import bajo test ──────────────────────────────────────────────────────────

import { HceService } from '../encuentro.service.js';
import { HttpError } from '../../../core/errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ENCUENTRO_ID = 'enc-222';
const ESTUDIO_ID = 'est-333';
const PACIENTE_ID = 'pac-444';
const SEDE_ID = 'sede-555';

const makeEncuentro = (estado = 'abierto') => ({
  id: ENCUENTRO_ID,
  paciente_id: PACIENTE_ID,
  usuario_id: 'usr-777',
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

const makeEstudio = (overrides = {}) => ({
  id: ESTUDIO_ID,
  encuentro_id: ENCUENTRO_ID,
  tipo: 'laboratorio',
  nombre: 'Hemograma completo',
  descripcion: null,
  urgente: false,
  estado: 'solicitado',
  resultado_texto: null,
  fecha_resultado: null,
  created_at: new Date(),
  updated_at: new Date(),
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
// crearEstudio
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.crearEstudio', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(
      service.crearEstudio(ENCUENTRO_ID, ORG_ID, { tipo: 'laboratorio', nombre: 'Hemograma' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ENCUENTRO_NOT_FOUND' });
  });

  it('lanza 409 si el encuentro no está abierto', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('firmado'));

    await expect(
      service.crearEstudio(ENCUENTRO_ID, ORG_ID, { tipo: 'laboratorio', nombre: 'Hemograma' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_NO_ABIERTO' });
  });

  it('crea el estudio en estado "solicitado"', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.estudio_solicitado.create.mockResolvedValue(makeEstudio());

    await service.crearEstudio(ENCUENTRO_ID, ORG_ID, { tipo: 'laboratorio', nombre: 'Hemograma completo' });

    expect(mockPrisma.estudio_solicitado.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encuentro_id: ENCUENTRO_ID,
          tipo: 'laboratorio',
          nombre: 'Hemograma completo',
          estado: 'solicitado',
        }),
      }),
    );
  });

  it('urgente por defecto es false si no se envía', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.estudio_solicitado.create.mockResolvedValue(makeEstudio());

    await service.crearEstudio(ENCUENTRO_ID, ORG_ID, { tipo: 'imagen', nombre: 'Rayos X tórax' });

    expect(mockPrisma.estudio_solicitado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ urgente: false }) }),
    );
  });

  it('respeta urgente: true cuando se envía', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.estudio_solicitado.create.mockResolvedValue(makeEstudio({ urgente: true }));

    await service.crearEstudio(ENCUENTRO_ID, ORG_ID, {
      tipo: 'patologia', nombre: 'Biopsia', urgente: true,
    });

    expect(mockPrisma.estudio_solicitado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ urgente: true }) }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listarEstudios
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.listarEstudios', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(service.listarEstudios(ENCUENTRO_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'ENCUENTRO_NOT_FOUND',
    });
  });

  it('retorna lista vacía si no hay estudios', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.estudio_solicitado.findMany.mockResolvedValue([]);

    const result = await service.listarEstudios(ENCUENTRO_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('retorna los estudios del encuentro', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.estudio_solicitado.findMany.mockResolvedValue([
      makeEstudio(),
      makeEstudio({ id: 'est-444', tipo: 'imagen', nombre: 'Rayos X tórax' }),
    ]);

    const result = await service.listarEstudios(ENCUENTRO_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(mockPrisma.estudio_solicitado.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encuentro_id: ENCUENTRO_ID, deleted: false }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// actualizarEstudio
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.actualizarEstudio', () => {
  it('lanza 404 si el estudio no existe', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(null);

    await expect(
      service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { resultado_texto: 'Normal' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ESTUDIO_NOT_FOUND' });
  });

  it('permite actualizar aunque el encuentro esté cerrado o firmado (a diferencia de nota/prescripción)', async () => {
    // getEstudioOrFail no depende del estado del encuentro, así que basta con que exista.
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio());
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ resultado_texto: 'Normal' }));

    await expect(
      service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { resultado_texto: 'Normal' }),
    ).resolves.toBeDefined();

    expect(mockPrisma.estudio_solicitado.update).toHaveBeenCalledOnce();
  });

  it('al enviar resultado_texto, fija fecha_resultado automáticamente', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio());
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ resultado_texto: 'Leucocitos 7.2' }));

    await service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { resultado_texto: 'Leucocitos 7.2' });

    const callData = mockPrisma.estudio_solicitado.update.mock.calls[0][0].data;
    expect(callData.resultado_texto).toBe('Leucocitos 7.2');
    expect(callData.fecha_resultado).toBeInstanceOf(Date);
  });

  it('no toca fecha_resultado si no se envía resultado_texto', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio());
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ urgente: true }));

    await service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { urgente: true });

    const callData = mockPrisma.estudio_solicitado.update.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('fecha_resultado');
    expect(callData).not.toHaveProperty('resultado_texto');
  });

  it('permite mover el estado a resultado_cargado', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio());
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ estado: 'resultado_cargado' }));

    await service.actualizarEstudio(ESTUDIO_ID, ORG_ID, {
      resultado_texto: 'Normal', estado: 'resultado_cargado',
    });

    expect(mockPrisma.estudio_solicitado.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ESTUDIO_ID },
        data: expect.objectContaining({ estado: 'resultado_cargado' }),
      }),
    );
  });

  it('permite mover el estado a informado', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio({ estado: 'resultado_cargado' }));
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ estado: 'informado' }));

    await service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { estado: 'informado' });

    expect(mockPrisma.estudio_solicitado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'informado' }) }),
    );
  });

  it('actualiza solo los campos enviados', async () => {
    mockPrisma.estudio_solicitado.findFirst.mockResolvedValue(makeEstudio());
    mockPrisma.estudio_solicitado.update.mockResolvedValue(makeEstudio({ nombre: 'Hemograma urgente' }));

    await service.actualizarEstudio(ESTUDIO_ID, ORG_ID, { nombre: 'Hemograma urgente' });

    const callData = mockPrisma.estudio_solicitado.update.mock.calls[0][0].data;
    expect(callData.nombre).toBe('Hemograma urgente');
    expect(callData).not.toHaveProperty('tipo');
    expect(callData).not.toHaveProperty('descripcion');
  });
});
