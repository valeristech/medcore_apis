import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockPrisma, mockHceService } = vi.hoisted(() => {
  const mockPrisma = {
    paciente_organizacion: { findFirst: vi.fn() },
    plan_seguimiento: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    plan_seguimiento_actividad: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const mockHceService = {
    getEncuentroOrFail: vi.fn(),
  };
  return { mockPrisma, mockHceService };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../encuentros/encuentro.service.js', () => ({ hceService: mockHceService }));

// ── Import del módulo bajo test ───────────────────────────────────────────────
import { PlanSeguimientoService } from '../plan-seguimiento.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const PACIENTE_ID = 'pac-444';
const MEDICO_ID = 'usr-555';
const OTRO_MEDICO_ID = 'usr-999';
const SECRETARIA_ID = 'usr-888';
const PLAN_ID = 'plan-222';
const ENCUENTRO_ID = 'enc-777';
const ACTIVIDAD_ID = 'act-333';

const makeEncuentro = (usuarioId = MEDICO_ID, pacienteId = PACIENTE_ID) => ({
  id: ENCUENTRO_ID,
  paciente_id: pacienteId,
  usuario_id: usuarioId,
  sede_id: 'sede-1',
  estado: 'abierto',
});

const makePlanRow = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_ID,
  paciente_id: PACIENTE_ID,
  organizacion_id: ORG_ID,
  medico_id: MEDICO_ID,
  encuentro_origen_id: null,
  nombre: 'Control DM2',
  indicacion_medico: null,
  diagnostico_asociado: null,
  codigo_icd10: null,
  frecuencia_dias: 90,
  descripcion: null,
  fecha_inicio: new Date('2026-08-01T00:00:00.000Z'),
  fecha_fin_estimada: null,
  completado_por: null,
  fecha_completado: null,
  notas_secretaria: null,
  estado: 'borrador',
  motivo_cierre: null,
  created_at: new Date('2026-08-01T10:00:00.000Z'),
  updated_at: new Date('2026-08-01T10:00:00.000Z'),
  paciente: { id: PACIENTE_ID, nombre: 'María', apellido: 'López', telefono: '50255552001' },
  usuario_plan_seguimiento_medico_idTousuario: {
    id: MEDICO_ID,
    nombre: 'Carlos',
    apellido: 'Méndez',
    especialidad: 'Medicina general',
  },
  ...overrides,
});

const makeActividadRow = (overrides: Record<string, unknown> = {}) => ({
  id: ACTIVIDAD_ID,
  plan_id: PLAN_ID,
  numero_orden: 1,
  tipo: 'estudio',
  descripcion: 'Hemograma de control',
  fecha_programada: null,
  fecha_limite: null,
  dias_desde_inicio: null,
  instrucciones_paciente: null,
  requiere_preparacion: false,
  detalle_preparacion: null,
  creada_por: SECRETARIA_ID,
  indicacion_id: null,
  cita_id: null,
  encuentro_id: null,
  estudio_id: null,
  estado: 'pendiente',
  gestionada_por: null,
  fecha_gestion: null,
  resultado_resumen: null,
  notas: null,
  created_at: new Date('2026-08-01T10:00:00.000Z'),
  updated_at: new Date('2026-08-01T10:00:00.000Z'),
  ...overrides,
});

let service: PlanSeguimientoService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PlanSeguimientoService();
  mockPrisma.$transaction.mockImplementation(async (arr: Promise<unknown>[]) => Promise.all(arr));
});

// ─────────────────────────────────────────────────────────────────────────────
// crearPlan
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanSeguimientoService.crearPlan', () => {
  it('lanza 404 si el paciente no pertenece al tenant', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(null);

    await expect(
      service.crearPlan(ORG_ID, MEDICO_ID, { paciente_id: PACIENTE_ID, nombre: 'Control DM2' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PACIENTE_INVALIDO' });

    expect(mockPrisma.plan_seguimiento.create).not.toHaveBeenCalled();
  });

  it('lanza 403 si el encuentro_origen_id no pertenece al médico', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue({ paciente_id: PACIENTE_ID });
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro(OTRO_MEDICO_ID));

    await expect(
      service.crearPlan(ORG_ID, MEDICO_ID, {
        paciente_id: PACIENTE_ID,
        nombre: 'Control DM2',
        encuentro_origen_id: ENCUENTRO_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('lanza 409 si el paciente del encuentro no coincide', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue({ paciente_id: PACIENTE_ID });
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro(MEDICO_ID, 'otro-paciente'));

    await expect(
      service.crearPlan(ORG_ID, MEDICO_ID, {
        paciente_id: PACIENTE_ID,
        nombre: 'Control DM2',
        encuentro_origen_id: ENCUENTRO_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ENCUENTRO_PACIENTE_INVALIDO' });
  });

  it('lanza 400 si fecha_inicio es posterior a fecha_fin_estimada', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue({ paciente_id: PACIENTE_ID });

    await expect(
      service.crearPlan(ORG_ID, MEDICO_ID, {
        paciente_id: PACIENTE_ID,
        nombre: 'Control DM2',
        fecha_inicio: '2026-10-01',
        fecha_fin_estimada: '2026-09-01',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('crea el plan en borrador sin encuentro de origen', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue({ paciente_id: PACIENTE_ID });
    mockPrisma.plan_seguimiento.create.mockResolvedValue(makePlanRow());

    const result = await service.crearPlan(ORG_ID, MEDICO_ID, {
      paciente_id: PACIENTE_ID,
      nombre: 'Control DM2',
      codigo_icd10: 'E11.9',
    });

    expect(mockHceService.getEncuentroOrFail).not.toHaveBeenCalled();
    expect(mockPrisma.plan_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paciente_id: PACIENTE_ID,
          medico_id: MEDICO_ID,
          organizacion_id: ORG_ID,
          nombre: 'Control DM2',
          estado: 'borrador',
          encuentro_origen_id: null,
        }),
      }),
    );
    expect(result.estado).toBe('borrador');
    expect(result.medico).toMatchObject({ id: MEDICO_ID, nombre: 'Carlos' });
  });

  it('crea el plan vinculado a un encuentro válido del médico', async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue({ paciente_id: PACIENTE_ID });
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.plan_seguimiento.create.mockResolvedValue(
      makePlanRow({ encuentro_origen_id: ENCUENTRO_ID }),
    );

    await service.crearPlan(ORG_ID, MEDICO_ID, {
      paciente_id: PACIENTE_ID,
      nombre: 'Control DM2',
      encuentro_origen_id: ENCUENTRO_ID,
    });

    expect(mockPrisma.plan_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ encuentro_origen_id: ENCUENTRO_ID }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// obtenerPlan / listarPlanes
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanSeguimientoService.obtenerPlan', () => {
  it('lanza 404 si no existe en el tenant', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(null);

    await expect(service.obtenerPlan(PLAN_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('incluye actividades mapeadas', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue({
      ...makePlanRow(),
      plan_seguimiento_actividad: [makeActividadRow()],
    });

    const result = await service.obtenerPlan(PLAN_ID, ORG_ID);

    expect(result.actividades).toHaveLength(1);
    expect(result.actividades![0]).toMatchObject({ id: ACTIVIDAD_ID, estado: 'pendiente' });
  });
});

describe('PlanSeguimientoService.listarPlanes', () => {
  it('filtra por tenant y estado, con paginación', async () => {
    mockPrisma.plan_seguimiento.count.mockResolvedValue(1);
    mockPrisma.plan_seguimiento.findMany.mockResolvedValue([makePlanRow()]);

    const result = await service.listarPlanes(ORG_ID, { estado: 'borrador' });

    expect(mockPrisma.plan_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizacion_id: ORG_ID, deleted: false, estado: 'borrador' }),
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cambiarEstadoPlan
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanSeguimientoService.cambiarEstadoPlan', () => {
  it('lanza 404 si el plan no existe', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(null);

    await expect(
      service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'activo' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('lanza 409 si el plan ya está en estado terminal', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'completado' }));

    await expect(
      service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'activo' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PLAN_TERMINAL' });
  });

  it('lanza 409 si la transición no es válida', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));

    await expect(
      service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'completado' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TRANSICION_INVALIDA' });
  });

  it('lanza 400 al activar un plan sin actividades', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));
    mockPrisma.plan_seguimiento_actividad.count.mockResolvedValue(0);

    await expect(
      service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'activo' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'PLAN_SIN_ACTIVIDADES' });
  });

  it('activa el plan cuando tiene al menos una actividad', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));
    mockPrisma.plan_seguimiento_actividad.count.mockResolvedValue(1);
    mockPrisma.plan_seguimiento.update.mockResolvedValue(makePlanRow({ estado: 'activo' }));

    const result = await service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'activo' });

    expect(result.estado).toBe('activo');
    expect(mockPrisma.plan_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'activo' }) }),
    );
  });

  it('lanza 400 si se cancela sin motivo_cierre', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'activo' }));

    await expect(
      service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, { estado: 'cancelado' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MOTIVO_REQUERIDO' });
  });

  it('cancela el plan con motivo y marca completado_por/fecha_completado', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'activo' }));
    mockPrisma.plan_seguimiento.update.mockResolvedValue(
      makePlanRow({ estado: 'cancelado', motivo_cierre: 'Paciente se cambió de clínica' }),
    );

    await service.cambiarEstadoPlan(PLAN_ID, ORG_ID, SECRETARIA_ID, {
      estado: 'cancelado',
      motivo_cierre: 'Paciente se cambió de clínica',
    });

    expect(mockPrisma.plan_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'cancelado',
          motivo_cierre: 'Paciente se cambió de clínica',
          completado_por: SECRETARIA_ID,
          fecha_completado: expect.any(Date),
        }),
      }),
    );
  });

  it('completa el plan activo y marca completado_por/fecha_completado', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'activo' }));
    mockPrisma.plan_seguimiento.update.mockResolvedValue(makePlanRow({ estado: 'completado' }));

    await service.cambiarEstadoPlan(PLAN_ID, ORG_ID, MEDICO_ID, { estado: 'completado' });

    expect(mockPrisma.plan_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'completado',
          completado_por: MEDICO_ID,
          fecha_completado: expect.any(Date),
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Actividades
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanSeguimientoService.crearActividad', () => {
  it('lanza 404 si el plan no existe', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(null);

    await expect(
      service.crearActividad(PLAN_ID, ORG_ID, SECRETARIA_ID, { tipo: 'estudio', descripcion: 'Hemograma' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('lanza 409 si el plan ya es terminal', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'cancelado' }));

    await expect(
      service.crearActividad(PLAN_ID, ORG_ID, SECRETARIA_ID, { tipo: 'estudio', descripcion: 'Hemograma' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PLAN_TERMINAL' });
  });

  it('autoasigna numero_orden como max+1 cuando no se envía', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));
    mockPrisma.plan_seguimiento_actividad.aggregate.mockResolvedValue({ _max: { numero_orden: 3 } });
    mockPrisma.plan_seguimiento_actividad.create.mockResolvedValue(makeActividadRow({ numero_orden: 4 }));

    const result = await service.crearActividad(PLAN_ID, ORG_ID, SECRETARIA_ID, {
      tipo: 'estudio',
      descripcion: 'Hemograma',
    });

    expect(mockPrisma.plan_seguimiento_actividad.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numero_orden: 4 }) }),
    );
    expect(result.numero_orden).toBe(4);
  });

  it('respeta numero_orden explícito', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));
    mockPrisma.plan_seguimiento_actividad.create.mockResolvedValue(makeActividadRow({ numero_orden: 10 }));

    await service.crearActividad(PLAN_ID, ORG_ID, SECRETARIA_ID, {
      tipo: 'estudio',
      descripcion: 'Hemograma',
      numero_orden: 10,
    });

    expect(mockPrisma.plan_seguimiento_actividad.aggregate).not.toHaveBeenCalled();
    expect(mockPrisma.plan_seguimiento_actividad.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numero_orden: 10 }) }),
    );
  });

  it('lanza 400 si fecha_programada es posterior a fecha_limite', async () => {
    mockPrisma.plan_seguimiento.findFirst.mockResolvedValue(makePlanRow({ estado: 'borrador' }));

    await expect(
      service.crearActividad(PLAN_ID, ORG_ID, SECRETARIA_ID, {
        tipo: 'estudio',
        descripcion: 'Hemograma',
        fecha_programada: '2026-10-10',
        fecha_limite: '2026-10-01',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});

describe('PlanSeguimientoService.actualizarActividad', () => {
  const currentRow = () => ({
    ...makeActividadRow(),
    plan_seguimiento: { id: PLAN_ID, estado: 'activo' },
  });

  it('lanza 404 si la actividad no existe en el tenant', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue(null);

    await expect(
      service.actualizarActividad(ACTIVIDAD_ID, ORG_ID, SECRETARIA_ID, { notas: 'x' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('lanza 409 si el plan de la actividad ya es terminal', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue({
      ...makeActividadRow(),
      plan_seguimiento: { id: PLAN_ID, estado: 'completado' },
    });

    await expect(
      service.actualizarActividad(ACTIVIDAD_ID, ORG_ID, SECRETARIA_ID, { notas: 'x' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PLAN_TERMINAL' });
  });

  it('lanza 400 si se intenta setear un estado no gestionable manualmente', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue(currentRow());

    await expect(
      service.actualizarActividad(ACTIVIDAD_ID, ORG_ID, SECRETARIA_ID, { estado: 'indicacion_creada' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'ESTADO_NO_PERMITIDO' });
  });

  it('actualiza campos parciales sin tocar los demás', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue(currentRow());
    mockPrisma.plan_seguimiento_actividad.update.mockResolvedValue(
      makeActividadRow({ instrucciones_paciente: 'Ayuno de 8 horas' }),
    );

    await service.actualizarActividad(ACTIVIDAD_ID, ORG_ID, SECRETARIA_ID, {
      instrucciones_paciente: 'Ayuno de 8 horas',
    });

    expect(mockPrisma.plan_seguimiento_actividad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ instrucciones_paciente: 'Ayuno de 8 horas' }),
      }),
    );
    const call = mockPrisma.plan_seguimiento_actividad.update.mock.calls[0][0];
    expect(call.data.gestionada_por).toBeUndefined();
  });

  it('marca gestionada_por/fecha_gestion cuando se envía estado, resultado_resumen o notas', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue(currentRow());
    mockPrisma.plan_seguimiento_actividad.update.mockResolvedValue(
      makeActividadRow({ estado: 'completada', resultado_resumen: 'Normal' }),
    );

    await service.actualizarActividad(ACTIVIDAD_ID, ORG_ID, SECRETARIA_ID, {
      estado: 'completada',
      resultado_resumen: 'Normal',
    });

    expect(mockPrisma.plan_seguimiento_actividad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'completada',
          resultado_resumen: 'Normal',
          gestionada_por: SECRETARIA_ID,
          fecha_gestion: expect.any(Date),
        }),
      }),
    );
  });
});

describe('PlanSeguimientoService.eliminarActividad', () => {
  it('lanza 404 si no existe', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue(null);

    await expect(service.eliminarActividad(ACTIVIDAD_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('lanza 409 si el plan ya es terminal', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue({
      ...makeActividadRow(),
      plan_seguimiento: { id: PLAN_ID, estado: 'cancelado' },
    });

    await expect(service.eliminarActividad(ACTIVIDAD_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLAN_TERMINAL',
    });
  });

  it('lanza 409 si la actividad ya está completada', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue({
      ...makeActividadRow({ estado: 'completada' }),
      plan_seguimiento: { id: PLAN_ID, estado: 'activo' },
    });

    await expect(service.eliminarActividad(ACTIVIDAD_ID, ORG_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACTIVIDAD_COMPLETADA',
    });
  });

  it('hace soft delete cuando todo es válido', async () => {
    mockPrisma.plan_seguimiento_actividad.findFirst.mockResolvedValue({
      ...makeActividadRow(),
      plan_seguimiento: { id: PLAN_ID, estado: 'activo' },
    });
    mockPrisma.plan_seguimiento_actividad.update.mockResolvedValue({});

    await service.eliminarActividad(ACTIVIDAD_ID, ORG_ID);

    expect(mockPrisma.plan_seguimiento_actividad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVIDAD_ID },
        data: expect.objectContaining({ deleted: true, deleted_at: expect.any(Date) }),
      }),
    );
  });
});
