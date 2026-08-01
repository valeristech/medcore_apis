import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    indicacion_seguimiento: { create: vi.fn() },
    plan_seguimiento_actividad: { update: vi.fn() },
  };
  const mockPrisma = {
    plan_seguimiento_actividad: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma, mockTx };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));

import { PlanSeguimientoJobService } from '../plan-seguimiento.job.service.js';

const PLAN_ID = 'plan-222';
const PACIENTE_ID = 'pac-444';
const MEDICO_ID = 'usr-555';
const ORG_ID = 'org-111';
const ACTIVIDAD_ID = 'act-333';
const ENCUENTRO_ID = 'enc-777';
const INDICACION_ID = 'ind-999';

const makeLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

function makeActividad(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVIDAD_ID,
    plan_id: PLAN_ID,
    numero_orden: 1,
    tipo: 'estudio',
    descripcion: 'Hemograma de control',
    fecha_programada: new Date('2026-08-05T00:00:00.000Z'),
    fecha_limite: null,
    encuentro_id: null,
    instrucciones_paciente: 'Ayuno de 8 horas',
    estado: 'pendiente',
    plan_seguimiento: {
      id: PLAN_ID,
      nombre: 'Control DM2',
      paciente_id: PACIENTE_ID,
      medico_id: MEDICO_ID,
      organizacion_id: ORG_ID,
      encuentro_origen_id: null,
      deleted: false,
    },
    ...overrides,
  };
}

let service: PlanSeguimientoJobService;
let log: ReturnType<typeof makeLogger>;

beforeEach(() => {
  vi.clearAllMocks();
  log = makeLogger();
  service = new PlanSeguimientoJobService(log as never);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  mockPrisma.plan_seguimiento_actividad.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([]);
});

describe('PlanSeguimientoJobService.ejecutar — generación de indicaciones', () => {
  it('omite (no crea indicación) cuando no hay encuentro_id ni en la actividad ni en el plan', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([makeActividad({ encuentro_id: null })]);

    const result = await service.ejecutar();

    expect(mockTx.indicacion_seguimiento.create).not.toHaveBeenCalled();
    expect(result.omitidas).toBe(1);
    expect(result.indicaciones_generadas).toBe(0);
    expect(result.detalle[0]).toMatchObject({ actividad_id: ACTIVIDAD_ID, accion: 'omitida' });
  });

  it('usa encuentro_id de la actividad cuando está presente', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([
      makeActividad({ encuentro_id: ENCUENTRO_ID }),
    ]);
    mockTx.indicacion_seguimiento.create.mockResolvedValue({ id: INDICACION_ID });
    mockTx.plan_seguimiento_actividad.update.mockResolvedValue({});

    const result = await service.ejecutar();

    expect(mockTx.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encuentro_id: ENCUENTRO_ID,
          paciente_id: PACIENTE_ID,
          medico_id: MEDICO_ID,
          organizacion_id: ORG_ID,
          plan_id: PLAN_ID,
          tipo: 'estudio',
          estado: 'pendiente',
        }),
      }),
    );
    expect(result.indicaciones_generadas).toBe(1);
  });

  it('usa encuentro_origen_id del plan como respaldo si la actividad no tiene encuentro_id', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([
      makeActividad({
        encuentro_id: null,
        plan_seguimiento: {
          id: PLAN_ID,
          nombre: 'Control DM2',
          paciente_id: PACIENTE_ID,
          medico_id: MEDICO_ID,
          organizacion_id: ORG_ID,
          encuentro_origen_id: ENCUENTRO_ID,
          deleted: false,
        },
      }),
    ]);
    mockTx.indicacion_seguimiento.create.mockResolvedValue({ id: INDICACION_ID });
    mockTx.plan_seguimiento_actividad.update.mockResolvedValue({});

    await service.ejecutar();

    expect(mockTx.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ encuentro_id: ENCUENTRO_ID }) }),
    );
  });

  it('marca la actividad como indicacion_creada y enlaza el id generado', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([
      makeActividad({ encuentro_id: ENCUENTRO_ID }),
    ]);
    mockTx.indicacion_seguimiento.create.mockResolvedValue({ id: INDICACION_ID });
    mockTx.plan_seguimiento_actividad.update.mockResolvedValue({});

    await service.ejecutar();

    expect(mockTx.plan_seguimiento_actividad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVIDAD_ID },
        data: expect.objectContaining({ estado: 'indicacion_creada', indicacion_id: INDICACION_ID }),
      }),
    );
  });

  it('continúa procesando otras actividades si una falla', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([
      makeActividad({ id: 'act-1', encuentro_id: ENCUENTRO_ID }),
      makeActividad({ id: 'act-2', encuentro_id: ENCUENTRO_ID }),
    ]);

    mockPrisma.$transaction
      .mockImplementationOnce(async () => {
        throw new Error('DB error');
      })
      .mockImplementationOnce(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

    mockTx.indicacion_seguimiento.create.mockResolvedValue({ id: INDICACION_ID });
    mockTx.plan_seguimiento_actividad.update.mockResolvedValue({});

    const result = await service.ejecutar();

    expect(result.fallidas).toBe(1);
    expect(result.indicaciones_generadas).toBe(1);
    expect(log.error).toHaveBeenCalled();
  });

  it('solo evalúa actividades pendientes de planes activos', async () => {
    await service.ejecutar();

    expect(mockPrisma.plan_seguimiento_actividad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'pendiente',
          plan_seguimiento: expect.objectContaining({ estado: 'activo' }),
        }),
      }),
    );
  });
});

describe('PlanSeguimientoJobService.ejecutar — marcar actividades vencidas', () => {
  it('llama a updateMany con el estado vencida y devuelve el conteo', async () => {
    mockPrisma.plan_seguimiento_actividad.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.ejecutar();

    expect(mockPrisma.plan_seguimiento_actividad.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: { in: ['pendiente', 'indicacion_creada'] },
        }),
        data: expect.objectContaining({ estado: 'vencida' }),
      }),
    );
    expect(result.actividades_vencidas_marcadas).toBe(3);
  });

  it('filtra por organizacion_id cuando se provee', async () => {
    await service.ejecutar(ORG_ID);

    const call = mockPrisma.plan_seguimiento_actividad.updateMany.mock.calls[0][0];
    expect(call.where.plan_seguimiento.organizacion_id).toBe(ORG_ID);
  });
});
