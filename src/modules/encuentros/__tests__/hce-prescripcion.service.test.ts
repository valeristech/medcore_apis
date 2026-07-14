import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    encuentro: { findFirst: vi.fn() },
    nota_clinica: { findFirst: vi.fn() },
    prescripcion: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    producto: { findFirst: vi.fn() },
    stock: { findFirst: vi.fn() },
    alergia: { findMany: vi.fn() },
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
const PRESCRIPCION_ID = 'rx-333';
const PACIENTE_ID = 'pac-444';
const SEDE_ID = 'sede-555';
const PRODUCTO_ID = 'prod-666';

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

const makePrescripcion = (overrides = {}) => ({
  id: PRESCRIPCION_ID,
  encuentro_id: ENCUENTRO_ID,
  producto_id: null,
  medicamento: 'Amoxicilina 500mg',
  principio_activo: 'amoxicilina',
  dosis: '500mg',
  via: 'oral',
  frecuencia: 'cada 8 horas',
  duracion: '7 días',
  cantidad: 21,
  indicaciones: null,
  estado: 'activa',
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
// crearPrescripcion
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.crearPrescripcion', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(
      service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
        medicamento: 'Paracetamol', dosis: '500mg', frecuencia: 'cada 8h',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ENCUENTRO_NOT_FOUND' });
  });

  it('lanza 409 si el encuentro no está abierto', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro('firmado'));

    await expect(
      service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
        medicamento: 'Paracetamol', dosis: '500mg', frecuencia: 'cada 8h',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_NO_ABIERTO' });
  });

  it('lanza 404 si producto_id no existe o no pertenece al tenant', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.producto.findFirst.mockResolvedValue(null);

    await expect(
      service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
        medicamento: 'Amoxicilina', dosis: '500mg', frecuencia: 'cada 8h',
        producto_id: PRODUCTO_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PRODUCTO_NOT_FOUND' });
  });

  it('crea la prescripción sin alertas cuando no hay alergias', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion());

    const result = await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Amoxicilina 500mg',
      principio_activo: 'amoxicilina',
      dosis: '500mg',
      frecuencia: 'cada 8 horas',
    });

    expect(mockPrisma.prescripcion.create).toHaveBeenCalledOnce();
    expect(result.alertas_alergia).toHaveLength(0);
    expect(result.stock).toBeNull();
  });

  it('retorna alerta cuando principio_activo coincide con una alergia', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.alergia.findMany.mockResolvedValue([
      { id: 'alg-1', sustancia: 'amoxicilina', severidad: 'grave', tipo_reaccion: 'anafilaxia' },
    ]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion());

    const result = await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Amoxicilina 500mg',
      principio_activo: 'amoxicilina',
      dosis: '500mg',
      frecuencia: 'cada 8h',
    });

    // La prescripción SE crea igual (solo advierte)
    expect(mockPrisma.prescripcion.create).toHaveBeenCalledOnce();
    expect(result.alertas_alergia).toHaveLength(1);
    expect(result.alertas_alergia[0]).toMatchObject({
      sustancia: 'amoxicilina',
      severidad: 'grave',
    });
  });

  it('detecta alergia por coincidencia parcial (sustancia dentro de principio_activo)', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.alergia.findMany.mockResolvedValue([
      { id: 'alg-2', sustancia: 'penicilina', severidad: 'moderada', tipo_reaccion: null },
    ]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion());

    // "amoxicilina-penicilina" contiene "penicilina"
    const result = await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Amoxicilina-Clavulanato',
      principio_activo: 'amoxicilina-penicilina',
      dosis: '875mg',
      frecuencia: 'cada 12h',
    });

    expect(result.alertas_alergia).toHaveLength(1);
    expect(result.alertas_alergia[0].sustancia).toBe('penicilina');
  });

  it('incluye info de stock cuando se envía producto_id', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.producto.findFirst.mockResolvedValue({ id: PRODUCTO_ID });
    mockPrisma.stock.findFirst.mockResolvedValue({
      cantidad: '15.00',
      bodegas: { nombre: 'Bodega Principal' },
    });
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion({ producto_id: PRODUCTO_ID }));

    const result = await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Amoxicilina 500mg',
      dosis: '500mg',
      frecuencia: 'cada 8h',
      producto_id: PRODUCTO_ID,
    });

    expect(result.stock).toMatchObject({ cantidad: 15, bodega: 'Bodega Principal' });
  });

  it('retorna stock = { cantidad: 0 } si no hay stock en la sede', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.producto.findFirst.mockResolvedValue({ id: PRODUCTO_ID });
    mockPrisma.stock.findFirst.mockResolvedValue(null);
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion({ producto_id: PRODUCTO_ID }));

    const result = await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Amoxicilina 500mg',
      dosis: '500mg',
      frecuencia: 'cada 8h',
      producto_id: PRODUCTO_ID,
    });

    expect(result.stock).toMatchObject({ cantidad: 0, bodega: null });
  });

  it('persiste con estado "activa" siempre', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.prescripcion.create.mockResolvedValue(makePrescripcion());

    await service.crearPrescripcion(ENCUENTRO_ID, ORG_ID, {
      medicamento: 'Paracetamol', dosis: '500mg', frecuencia: 'cada 8h',
    });

    expect(mockPrisma.prescripcion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'activa' }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listarPrescripciones
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.listarPrescripciones', () => {
  it('lanza 404 si el encuentro no existe', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(null);

    await expect(service.listarPrescripciones(ENCUENTRO_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'ENCUENTRO_NOT_FOUND',
    });
  });

  it('retorna lista vacía si no hay prescripciones', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.prescripcion.findMany.mockResolvedValue([]);

    const result = await service.listarPrescripciones(ENCUENTRO_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('retorna las prescripciones del encuentro', async () => {
    mockPrisma.encuentro.findFirst.mockResolvedValue(makeEncuentro());
    mockPrisma.prescripcion.findMany.mockResolvedValue([
      makePrescripcion(),
      makePrescripcion({ id: 'rx-444', medicamento: 'Ibuprofeno 400mg' }),
    ]);

    const result = await service.listarPrescripciones(ENCUENTRO_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(mockPrisma.prescripcion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encuentro_id: ENCUENTRO_ID, deleted: false }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// actualizarPrescripcion
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.actualizarPrescripcion', () => {
  const RX_ID = 'rx-333';

  const makeRxConEncuentro = (estadoEncuentro = 'abierto') => ({
    id: RX_ID,
    encuentro_id: ENCUENTRO_ID,
    medicamento: 'Amoxicilina 500mg',
    principio_activo: 'amoxicilina',
    dosis: '500mg',
    via: 'oral',
    frecuencia: 'cada 8h',
    duracion: '7 días',
    cantidad: 21,
    indicaciones: null,
    estado: 'activa',
    producto_id: null,
    created_at: new Date(),
    deleted: false,
    deleted_at: null,
    encuentro: { estado: estadoEncuentro },
  });

  it('lanza 404 si la prescripción no existe', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(null);

    await expect(
      service.actualizarPrescripcion(RX_ID, ORG_ID, { dosis: '1000mg' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PRESCRIPCION_NOT_FOUND' });
  });

  it('lanza 409 si el encuentro no está abierto', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(makeRxConEncuentro('firmado'));

    await expect(
      service.actualizarPrescripcion(RX_ID, ORG_ID, { dosis: '1000mg' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_NO_ABIERTO' });
  });

  it('actualiza solo los campos enviados', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(makeRxConEncuentro());
    mockPrisma.prescripcion.update.mockResolvedValue(makeRxConEncuentro());

    await service.actualizarPrescripcion(RX_ID, ORG_ID, { dosis: '1000mg', estado: 'suspendida' });

    expect(mockPrisma.prescripcion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RX_ID },
        data: expect.objectContaining({ dosis: '1000mg', estado: 'suspendida' }),
      }),
    );
    // medicamento no enviado → no debe estar en el update
    const callData = mockPrisma.prescripcion.update.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('medicamento');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// eliminarPrescripcion
// ─────────────────────────────────────────────────────────────────────────────

describe('HceService.eliminarPrescripcion', () => {
  const RX_ID = 'rx-333';

  const makeRxConEncuentro = (estadoEncuentro = 'abierto') => ({
    id: RX_ID,
    encuentro_id: ENCUENTRO_ID,
    medicamento: 'Paracetamol',
    principio_activo: null,
    dosis: '500mg',
    via: null,
    frecuencia: 'cada 8h',
    duracion: null,
    cantidad: null,
    indicaciones: null,
    estado: 'activa',
    producto_id: null,
    created_at: new Date(),
    deleted: false,
    deleted_at: null,
    encuentro: { estado: estadoEncuentro },
  });

  it('lanza 404 si la prescripción no existe', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(null);

    await expect(service.eliminarPrescripcion(RX_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'PRESCRIPCION_NOT_FOUND',
    });
  });

  it('lanza 409 si el encuentro no está abierto', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(makeRxConEncuentro('cerrado'));

    await expect(service.eliminarPrescripcion(RX_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ENCUENTRO_NO_ABIERTO',
    });
  });

  it('hace soft delete (nunca delete físico)', async () => {
    mockPrisma.prescripcion.findFirst.mockResolvedValue(makeRxConEncuentro());
    mockPrisma.prescripcion.update.mockResolvedValue({});

    await service.eliminarPrescripcion(RX_ID, ORG_ID);

    expect(mockPrisma.prescripcion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RX_ID },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
  });
});
