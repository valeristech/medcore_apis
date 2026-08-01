import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    indicacion_seguimiento: { findMany: vi.fn() },
    plan_seguimiento_actividad: { findMany: vi.fn() },
    plan_seguimiento: { findMany: vi.fn() },
    alerta_preventiva: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));

import { AlertaJobService } from '../alerta.job.service.js';

const ORG_ID = 'org-111';
const PACIENTE_ID = 'pac-444';

const makeLogger = () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() });

let service: AlertaJobService;
let log: ReturnType<typeof makeLogger>;

function makeIndicacion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ind-1',
    organizacion_id: ORG_ID,
    paciente_id: PACIENTE_ID,
    descripcion: 'Control DM2',
    prioridad: 'normal',
    estado: 'pendiente',
    fecha_sugerida: null,
    rango_fecha_fin: null,
    dias_para_cita: null,
    intentos_contacto: 0,
    created_at: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  log = makeLogger();
  service = new AlertaJobService(log as never);
  mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([]);
  mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([]);
  mockPrisma.plan_seguimiento.findMany.mockResolvedValue([]);
  mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(null);
  mockPrisma.alerta_preventiva.create.mockResolvedValue({ id: 'alerta-nueva' });
});

describe('AlertaJobService — control_vencido', () => {
  it('genera alerta cuando fecha_sugerida ya pasó', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ fecha_sugerida: new Date('2026-07-01T00:00:00.000Z') }),
    ]);

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'control_vencido' }) }),
    );
    expect(result.alertas_generadas).toBe(1);
  });

  it('genera alerta cuando rango_fecha_fin ya pasó', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ rango_fecha_fin: new Date('2026-07-01T00:00:00.000Z') }),
    ]);

    await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'control_vencido' }) }),
    );
  });

  it('genera alerta cuando dias_para_cita desde created_at ya venció', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ dias_para_cita: 5, created_at: new Date('2026-07-01T00:00:00.000Z') }),
    ]);

    await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'control_vencido' }) }),
    );
  });

  it('no genera alerta si el plazo aún no vence', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ fecha_sugerida: new Date('2027-01-01T00:00:00.000Z') }),
    ]);

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).not.toHaveBeenCalled();
    expect(result.alertas_generadas).toBe(0);
  });

  it('omite (no duplica) si ya existe una alerta activa para la misma indicación y tipo', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ fecha_sugerida: new Date('2026-07-01T00:00:00.000Z') }),
    ]);
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue({ id: 'ya-existe' });

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).not.toHaveBeenCalled();
    expect(result.omitidas).toBe(1);
  });
});

describe('AlertaJobService — paciente_sin_contacto', () => {
  it('genera alerta cuando no_contactado con >=3 intentos', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ estado: 'no_contactado', intentos_contacto: 3 }),
    ]);

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'paciente_sin_contacto' }) }),
    );
    expect(result.alertas_generadas).toBe(1);
  });

  it('no genera alerta si los intentos de contacto son menores al umbral', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ estado: 'no_contactado', intentos_contacto: 1 }),
    ]);

    const result = await service.ejecutar();

    expect(result.alertas_generadas).toBe(0);
  });

  it('una misma indicación puede generar control_vencido y paciente_sin_contacto a la vez', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({
        estado: 'no_contactado',
        intentos_contacto: 4,
        fecha_sugerida: new Date('2026-07-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.ejecutar();

    expect(result.alertas_generadas).toBe(2);
  });
});

describe('AlertaJobService — actividad_pendiente', () => {
  it('genera alerta para actividades vencidas de planes activos', async () => {
    mockPrisma.plan_seguimiento_actividad.findMany.mockResolvedValue([
      {
        id: 'act-1',
        descripcion: 'Hemograma',
        plan_seguimiento: {
          id: 'plan-1',
          nombre: 'Control DM2',
          paciente_id: PACIENTE_ID,
          organizacion_id: ORG_ID,
          deleted: false,
          estado: 'activo',
        },
      },
    ]);

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'actividad_pendiente', actividad_id: 'act-1', plan_id: 'plan-1' }),
      }),
    );
    expect(result.alertas_generadas).toBe(1);
  });

  it('consulta solo actividades vencida de planes deleted:false y estado activo', async () => {
    await service.ejecutar();

    expect(mockPrisma.plan_seguimiento_actividad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'vencida',
          plan_seguimiento: expect.objectContaining({ estado: 'activo' }),
        }),
      }),
    );
  });
});

describe('AlertaJobService — plan_abandonado', () => {
  it('genera alerta cuando todas las actividades del plan activo están vencidas', async () => {
    mockPrisma.plan_seguimiento.findMany.mockResolvedValue([
      {
        id: 'plan-2',
        nombre: 'Control HTA',
        paciente_id: PACIENTE_ID,
        organizacion_id: ORG_ID,
        plan_seguimiento_actividad: [
          { id: 'a1', estado: 'vencida' },
          { id: 'a2', estado: 'vencida' },
        ],
      },
    ]);

    const result = await service.ejecutar();

    expect(mockPrisma.alerta_preventiva.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'plan_abandonado', plan_id: 'plan-2' }) }),
    );
    expect(result.alertas_generadas).toBe(1);
  });

  it('no genera alerta si al menos una actividad no está vencida', async () => {
    mockPrisma.plan_seguimiento.findMany.mockResolvedValue([
      {
        id: 'plan-3',
        nombre: 'Control HTA',
        paciente_id: PACIENTE_ID,
        organizacion_id: ORG_ID,
        plan_seguimiento_actividad: [
          { id: 'a1', estado: 'vencida' },
          { id: 'a2', estado: 'pendiente' },
        ],
      },
    ]);

    const result = await service.ejecutar();

    expect(result.alertas_generadas).toBe(0);
  });

  it('no genera alerta si el plan no tiene actividades', async () => {
    mockPrisma.plan_seguimiento.findMany.mockResolvedValue([
      { id: 'plan-4', nombre: 'Sin actividades', paciente_id: PACIENTE_ID, organizacion_id: ORG_ID, plan_seguimiento_actividad: [] },
    ]);

    const result = await service.ejecutar();

    expect(result.alertas_generadas).toBe(0);
  });
});

describe('AlertaJobService — manejo de errores', () => {
  it('continúa procesando y cuenta fallidas si crear una alerta lanza', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([
      makeIndicacion({ id: 'ind-a', fecha_sugerida: new Date('2026-07-01T00:00:00.000Z') }),
      makeIndicacion({ id: 'ind-b', fecha_sugerida: new Date('2026-07-01T00:00:00.000Z') }),
    ]);
    mockPrisma.alerta_preventiva.create
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'ok' });

    const result = await service.ejecutar();

    expect(result.fallidas).toBe(1);
    expect(result.alertas_generadas).toBe(1);
    expect(log.error).toHaveBeenCalled();
  });
});

describe('AlertaJobService — ejecutar()', () => {
  it('devuelve el shape esperado con contadores en cero cuando no hay nada que procesar', async () => {
    const result = await service.ejecutar();

    expect(result).toMatchObject({
      evaluadas: 0,
      alertas_generadas: 0,
      omitidas: 0,
      fallidas: 0,
      detalle: [],
    });
    expect(typeof result.ejecutado_en).toBe('string');
  });

  it('filtra por organizacion_id cuando se provee', async () => {
    await service.ejecutar(ORG_ID);

    expect(mockPrisma.indicacion_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizacion_id: ORG_ID }) }),
    );
    expect(mockPrisma.plan_seguimiento_actividad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ plan_seguimiento: expect.objectContaining({ organizacion_id: ORG_ID }) }),
      }),
    );
    expect(mockPrisma.plan_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizacion_id: ORG_ID }) }),
    );
  });
});
