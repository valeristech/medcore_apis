import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    alerta_preventiva: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));

import { AlertaService } from '../alerta.service.js';

const ORG_ID = 'org-111';
const PACIENTE_ID = 'pac-444';
const ALERTA_ID = 'alerta-333';
const SECRETARIA_ID = 'usr-888';

function makeAlertaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ALERTA_ID,
    organizacion_id: ORG_ID,
    paciente_id: PACIENTE_ID,
    plan_id: null,
    actividad_id: null,
    indicacion_id: 'ind-1',
    tipo: 'control_vencido',
    titulo: 'Control de seguimiento vencido',
    descripcion: 'desc',
    prioridad: 'normal',
    estado: 'activa',
    visible_para: 'ambos',
    gestionada_por: null,
    fecha_gestion: null,
    notas_gestion: null,
    fecha_vencimiento: null,
    created_at: new Date('2026-07-25T10:00:00.000Z'),
    paciente: { id: PACIENTE_ID, nombre: 'María', apellido: 'López', telefono: '50255552001' },
    usuario: null,
    ...overrides,
  };
}

let service: AlertaService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new AlertaService();
  mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe('AlertaService.listar', () => {
  it('filtra por defecto solo estado activa cuando no se especifica', async () => {
    mockPrisma.alerta_preventiva.findMany.mockResolvedValue([]);

    await service.listar(ORG_ID, {});

    expect(mockPrisma.alerta_preventiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizacion_id: ORG_ID, estado: { in: ['activa'] } }),
      }),
    );
  });

  it('aplica filtros de estado, visible_para, prioridad, tipo y paciente_id', async () => {
    mockPrisma.alerta_preventiva.findMany.mockResolvedValue([]);

    await service.listar(ORG_ID, {
      estado: 'gestionada',
      visible_para: 'secretaria',
      prioridad: 'critica',
      tipo: 'plan_abandonado',
      paciente_id: PACIENTE_ID,
    });

    expect(mockPrisma.alerta_preventiva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'gestionada',
          visible_para: 'secretaria',
          prioridad: 'critica',
          tipo: 'plan_abandonado',
          paciente_id: PACIENTE_ID,
        }),
      }),
    );
  });

  it('ordena por prioridad (default) y antigüedad, paginando en memoria', async () => {
    const alta = makeAlertaRow({
      id: 'a-alta',
      prioridad: 'alta',
      created_at: new Date('2026-07-20T00:00:00.000Z'),
    });
    const critica = makeAlertaRow({
      id: 'a-critica',
      prioridad: 'critica',
      created_at: new Date('2026-07-28T00:00:00.000Z'),
    });
    const normalVieja = makeAlertaRow({
      id: 'a-normal-vieja',
      prioridad: 'normal',
      created_at: new Date('2026-07-01T00:00:00.000Z'),
    });
    mockPrisma.alerta_preventiva.findMany.mockResolvedValue([alta, critica, normalVieja]);

    const result = await service.listar(ORG_ID, {});

    expect(result.items.map((i) => i.id)).toEqual(['a-critica', 'a-alta', 'a-normal-vieja']);
    expect(result.sort).toEqual({ sortBy: 'prioridad', sortOrder: 'asc' });
  });

  it('sortBy=created_at usa paginación por transacción de BD', async () => {
    mockPrisma.alerta_preventiva.count.mockResolvedValue(5);
    mockPrisma.alerta_preventiva.findMany.mockResolvedValue([makeAlertaRow()]);
    mockPrisma.$transaction.mockResolvedValue([5, [makeAlertaRow()]]);

    const result = await service.listar(ORG_ID, { sortBy: 'created_at', sortOrder: 'desc' });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.pagination.total).toBe(5);
    expect(result.sort).toEqual({ sortBy: 'created_at', sortOrder: 'desc' });
  });

  it('serializa fecha_vencimiento como date-only', async () => {
    mockPrisma.alerta_preventiva.findMany.mockResolvedValue([
      makeAlertaRow({ fecha_vencimiento: new Date('2026-08-15T00:00:00.000Z') }),
    ]);

    const result = await service.listar(ORG_ID, {});

    expect(result.items[0].fecha_vencimiento).toBe('2026-08-15');
  });
});

describe('AlertaService.gestionar', () => {
  it('lanza 404 si la alerta no existe en el tenant', async () => {
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(null);

    await expect(
      service.gestionar(ALERTA_ID, ORG_ID, SECRETARIA_ID, { estado: 'gestionada' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lanza 409 si la alerta ya está cerrada', async () => {
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(makeAlertaRow({ estado: 'cerrada' }));

    await expect(
      service.gestionar(ALERTA_ID, ORG_ID, SECRETARIA_ID, { estado: 'gestionada' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ALERTA_CERRADA' });
  });

  it('lanza 400 si el estado solicitado no es gestionable', async () => {
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(makeAlertaRow());

    await expect(
      service.gestionar(ALERTA_ID, ORG_ID, SECRETARIA_ID, { estado: 'activa' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'ESTADO_NO_PERMITIDO' });
  });

  it('actualiza estado, gestionada_por, fecha_gestion y notas_gestion', async () => {
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(makeAlertaRow());
    mockPrisma.alerta_preventiva.update.mockResolvedValue(
      makeAlertaRow({ estado: 'gestionada', gestionada_por: SECRETARIA_ID, notas_gestion: 'Contactado.' }),
    );

    const result = await service.gestionar(ALERTA_ID, ORG_ID, SECRETARIA_ID, {
      estado: 'gestionada',
      notas: 'Contactado.',
    });

    expect(mockPrisma.alerta_preventiva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALERTA_ID },
        data: expect.objectContaining({
          estado: 'gestionada',
          gestionada_por: SECRETARIA_ID,
          notas_gestion: 'Contactado.',
        }),
      }),
    );
    expect(result.estado).toBe('gestionada');
  });

  it('permite cerrar directamente desde activa', async () => {
    mockPrisma.alerta_preventiva.findFirst.mockResolvedValue(makeAlertaRow());
    mockPrisma.alerta_preventiva.update.mockResolvedValue(makeAlertaRow({ estado: 'cerrada' }));

    const result = await service.gestionar(ALERTA_ID, ORG_ID, SECRETARIA_ID, { estado: 'cerrada' });

    expect(result.estado).toBe('cerrada');
  });
});
