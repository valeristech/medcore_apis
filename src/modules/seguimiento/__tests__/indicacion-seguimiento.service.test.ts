import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock() se hoista al tope del archivo por Vitest; las variables usadas en
// los factories deben declararse con vi.hoisted().

const { mockPrisma, mockHceService, mockCitaService } = vi.hoisted(() => {
  const mockPrisma = {
    indicacion_seguimiento: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const mockHceService = {
    getEncuentroOrFail: vi.fn(),
  };
  const mockCitaService = {
    create: vi.fn(),
  };
  return { mockPrisma, mockHceService, mockCitaService };
});

vi.mock('../../../config/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../encuentros/encuentro.service.js', () => ({ hceService: mockHceService }));
vi.mock('../../citas/cita.service.js', () => ({ citaService: mockCitaService }));

// ── Import del módulo bajo test ───────────────────────────────────────────────
import { IndicacionSeguimientoService } from '../indicacion-seguimiento.service.js';
import { HttpError } from '../../../core/errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ENCUENTRO_ID = 'enc-222';
const MEDICO_ID = 'usr-555';
const OTRO_MEDICO_ID = 'usr-999';
const PACIENTE_ID = 'pac-444';
const INDICACION_ID = 'ind-777';
const SECRETARIA_ID = 'usr-888';
const CITA_ID = 'cita-333';

const makeEncuentro = (usuarioId = MEDICO_ID) => ({
  id: ENCUENTRO_ID,
  paciente_id: PACIENTE_ID,
  usuario_id: usuarioId,
  sede_id: 'sede-666',
  estado: 'abierto',
});

const makeIndicacionRow = (overrides: Record<string, unknown> = {}) => ({
  id: INDICACION_ID,
  encuentro_id: ENCUENTRO_ID,
  paciente_id: PACIENTE_ID,
  medico_id: MEDICO_ID,
  organizacion_id: ORG_ID,
  tipo: 'cita_control',
  descripcion: 'Control en 3 meses',
  dias_para_cita: null,
  fecha_sugerida: null,
  rango_fecha_inicio: null,
  rango_fecha_fin: null,
  prioridad: 'normal',
  notas_medico: null,
  estado: 'pendiente',
  atendida_por: null,
  fecha_gestion: null,
  notas_secretaria: null,
  fecha_contacto_paciente: null,
  preferencia_horario: null,
  intentos_contacto: 0,
  cita_generada_id: null,
  created_at: new Date('2026-08-01T10:00:00.000Z'),
  updated_at: new Date('2026-08-01T10:00:00.000Z'),
  paciente: {
    id: PACIENTE_ID,
    nombre: 'María',
    apellido: 'López',
    telefono: '50255552001',
    telefono_secundario: null,
    email: 'maria@demo.local',
  },
  usuario_indicacion_seguimiento_medico_idTousuario: {
    id: MEDICO_ID,
    nombre: 'Carlos',
    apellido: 'Méndez',
    especialidad: 'Medicina general',
  },
  usuario_indicacion_seguimiento_atendida_porTousuario: null,
  cita: null,
  ...overrides,
});

let service: IndicacionSeguimientoService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new IndicacionSeguimientoService();
  mockPrisma.$transaction.mockImplementation(async (arr: Promise<unknown>[]) => Promise.all(arr));
});

// ─────────────────────────────────────────────────────────────────────────────
// Validación de plazo
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.crear — validación de plazo', () => {
  it('lanza 400 si no se indica ningún plazo', async () => {
    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });

    expect(mockHceService.getEncuentroOrFail).not.toHaveBeenCalled();
  });

  it('lanza 400 si el rango de fechas viene incompleto (solo inicio)', async () => {
    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        rango_fecha_inicio: '2026-09-01',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('lanza 400 si el rango de fechas viene incompleto (solo fin)', async () => {
    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        rango_fecha_fin: '2026-09-15',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('lanza 400 si rango_fecha_inicio es posterior a rango_fecha_fin', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());

    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        rango_fecha_inicio: '2026-09-15',
        rango_fecha_fin: '2026-09-01',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('lanza 400 si fecha_sugerida no es una fecha válida', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());

    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        fecha_sugerida: 'no-es-fecha',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant / propiedad del encuentro
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.crear — encuentro y tenant', () => {
  it('propaga el 404 de hceService.getEncuentroOrFail cuando el encuentro no existe en el tenant', async () => {
    mockHceService.getEncuentroOrFail.mockRejectedValue(
      new HttpError(404, 'ENCUENTRO_NOT_FOUND', 'Encuentro no encontrado.'),
    );

    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        dias_para_cita: 90,
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ENCUENTRO_NOT_FOUND' });

    expect(mockHceService.getEncuentroOrFail).toHaveBeenCalledWith(ENCUENTRO_ID, ORG_ID);
    expect(mockPrisma.indicacion_seguimiento.create).not.toHaveBeenCalled();
  });

  it('lanza 403 FORBIDDEN si el médico autenticado no es el dueño del encuentro', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro(OTRO_MEDICO_ID));

    await expect(
      service.crear(ORG_ID, MEDICO_ID, {
        encuentro_id: ENCUENTRO_ID,
        tipo: 'cita_control',
        descripcion: 'Control',
        dias_para_cita: 90,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(mockPrisma.indicacion_seguimiento.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Creación exitosa
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.crear — creación', () => {
  it('crea la indicación con dias_para_cita, tomando paciente_id del encuentro y estado pendiente', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(
      makeIndicacionRow({ dias_para_cita: 90 }),
    );

    const result = await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'cita_control',
      descripcion: 'Control de diabetes en 3 meses',
      dias_para_cita: 90,
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encuentro_id: ENCUENTRO_ID,
          paciente_id: PACIENTE_ID,
          medico_id: MEDICO_ID,
          organizacion_id: ORG_ID,
          tipo: 'cita_control',
          dias_para_cita: 90,
          fecha_sugerida: null,
          rango_fecha_inicio: null,
          rango_fecha_fin: null,
          prioridad: 'normal',
          notas_medico: null,
          estado: 'pendiente',
          deleted: false,
        }),
      }),
    );
    expect(result).toMatchObject({ id: INDICACION_ID, estado: 'pendiente', dias_para_cita: 90 });
  });

  it('crea la indicación con fecha_sugerida y la serializa como YYYY-MM-DD', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(
      makeIndicacionRow({ fecha_sugerida: new Date('2026-09-10T00:00:00.000Z') }),
    );

    const result = await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'estudio',
      descripcion: 'Hemograma de control',
      fecha_sugerida: '2026-09-10',
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fecha_sugerida: new Date('2026-09-10T00:00:00.000Z'),
        }),
      }),
    );
    expect(result.fecha_sugerida).toBe('2026-09-10');
  });

  it('crea la indicación con rango de fechas válido', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(
      makeIndicacionRow({
        rango_fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
        rango_fecha_fin: new Date('2026-09-15T00:00:00.000Z'),
      }),
    );

    const result = await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'vacuna',
      descripcion: 'Refuerzo',
      rango_fecha_inicio: '2026-09-01',
      rango_fecha_fin: '2026-09-15',
    });

    expect(result.rango_fecha_inicio).toBe('2026-09-01');
    expect(result.rango_fecha_fin).toBe('2026-09-15');
  });

  it('usa prioridad "normal" por defecto cuando no se envía', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(makeIndicacionRow());

    await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'procedimiento',
      descripcion: 'Curación',
      dias_para_cita: 7,
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prioridad: 'normal' }) }),
    );
  });

  it('respeta la prioridad enviada', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(
      makeIndicacionRow({ prioridad: 'alta' }),
    );

    await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'otro',
      descripcion: 'Seguimiento urgente',
      dias_para_cita: 2,
      prioridad: 'alta',
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prioridad: 'alta' }) }),
    );
  });

  it('limpia notas en blanco (cleanStr) a null', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(makeIndicacionRow());

    await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'otro',
      descripcion: 'Seguimiento',
      dias_para_cita: 30,
      notas: '   ',
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notas_medico: null }) }),
    );
  });

  it('conserva notas con contenido real, recortando espacios', async () => {
    mockHceService.getEncuentroOrFail.mockResolvedValue(makeEncuentro());
    mockPrisma.indicacion_seguimiento.create.mockResolvedValue(
      makeIndicacionRow({ notas_medico: 'Llamar por la tarde' }),
    );

    await service.crear(ORG_ID, MEDICO_ID, {
      encuentro_id: ENCUENTRO_ID,
      tipo: 'otro',
      descripcion: 'Seguimiento',
      dias_para_cita: 30,
      notas: '  Llamar por la tarde  ',
    });

    expect(mockPrisma.indicacion_seguimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notas_medico: 'Llamar por la tarde' }) }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listar (UC-SEG-002 — bandeja de secretaría)
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.listar', () => {
  it('filtra por la bandeja default (pendiente/en_gestion/no_contactado) cuando no se envía estado', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([]);

    await service.listar(ORG_ID, {});

    expect(mockPrisma.indicacion_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizacion_id: ORG_ID,
          deleted: false,
          estado: { in: ['pendiente', 'en_gestion', 'no_contactado'] },
        }),
      }),
    );
  });

  it('filtra por el estado explícito cuando se envía', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([]);

    await service.listar(ORG_ID, { estado: 'agendada' });

    expect(mockPrisma.indicacion_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'agendada' }),
      }),
    );
  });

  it('ordena por prioridad (default) y antigüedad, paginando en memoria', async () => {
    const baja = makeIndicacionRow({
      id: 'ind-baja',
      prioridad: 'baja',
      created_at: new Date('2026-08-01T08:00:00.000Z'),
    });
    const criticaVieja = makeIndicacionRow({
      id: 'ind-critica-vieja',
      prioridad: 'critica',
      created_at: new Date('2026-08-01T06:00:00.000Z'),
    });
    const criticaNueva = makeIndicacionRow({
      id: 'ind-critica-nueva',
      prioridad: 'critica',
      created_at: new Date('2026-08-01T09:00:00.000Z'),
    });
    const normal = makeIndicacionRow({
      id: 'ind-normal',
      prioridad: 'normal',
      created_at: new Date('2026-08-01T07:00:00.000Z'),
    });

    // Orden de llegada intencionalmente desordenado.
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([baja, criticaNueva, normal, criticaVieja]);

    const result = await service.listar(ORG_ID, {});

    expect(result.items.map((i) => i.id)).toEqual([
      'ind-critica-vieja',
      'ind-critica-nueva',
      'ind-normal',
      'ind-baja',
    ]);
    expect(result.sort).toEqual({ sortBy: 'prioridad', sortOrder: 'asc' });
  });

  it('pagina en memoria (page/pageSize) cuando sortBy=prioridad', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeIndicacionRow({ id: `ind-${i}`, created_at: new Date(2026, 7, 1, 8, i) }),
    );
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue(rows);

    const result = await service.listar(ORG_ID, { page: 2, pageSize: 2 });

    expect(result.items.map((i) => i.id)).toEqual(['ind-2', 'ind-3']);
    expect(result.pagination).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
  });

  it('usa paginación de BD cuando sortBy=created_at', async () => {
    mockPrisma.indicacion_seguimiento.count.mockResolvedValue(1);
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([makeIndicacionRow()]);

    const result = await service.listar(ORG_ID, { sortBy: 'created_at', sortOrder: 'desc' });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.indicacion_seguimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { created_at: 'desc' } }),
    );
    expect(result.sort).toEqual({ sortBy: 'created_at', sortOrder: 'desc' });
  });

  it('incluye datos de contacto del paciente en cada item', async () => {
    mockPrisma.indicacion_seguimiento.findMany.mockResolvedValue([makeIndicacionRow()]);

    const result = await service.listar(ORG_ID, {});

    expect(result.items[0].paciente).toMatchObject({ nombre: 'María', telefono: '50255552001' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// actualizarGestion (UC-SEG-002)
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.actualizarGestion', () => {
  it('lanza 404 si la indicación no existe en el tenant', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(null);

    await expect(
      service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, { notas_secretaria: 'x' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('lanza 409 si la indicación ya fue agendada', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(
      makeIndicacionRow({ estado: 'agendada', cita_generada_id: CITA_ID }),
    );

    await expect(
      service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, { notas_secretaria: 'x' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INDICACION_YA_AGENDADA' });

    expect(mockPrisma.indicacion_seguimiento.update).not.toHaveBeenCalled();
  });

  it('lanza 400 si se intenta setear estado=agendada directamente', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());

    await expect(
      service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, { estado: 'agendada' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'ESTADO_NO_PERMITIDO' });

    expect(mockPrisma.indicacion_seguimiento.update).not.toHaveBeenCalled();
  });

  it('permite transicionar a en_gestion y marca atendida_por/fecha_gestion', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(
      makeIndicacionRow({ estado: 'en_gestion', atendida_por: SECRETARIA_ID }),
    );

    const result = await service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, {
      estado: 'en_gestion',
    });

    expect(mockPrisma.indicacion_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INDICACION_ID },
        data: expect.objectContaining({
          estado: 'en_gestion',
          atendida_por: SECRETARIA_ID,
          fecha_gestion: expect.any(Date),
        }),
      }),
    );
    expect(result.estado).toBe('en_gestion');
  });

  it('incrementa intentos_contacto cuando registrar_intento es true', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(makeIndicacionRow());

    await service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, { registrar_intento: true });

    expect(mockPrisma.indicacion_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intentos_contacto: { increment: 1 } }),
      }),
    );
  });

  it('no toca intentos_contacto si registrar_intento no viene', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(makeIndicacionRow());

    await service.actualizarGestion(INDICACION_ID, ORG_ID, SECRETARIA_ID, { notas_secretaria: 'Llamé y no contestó' });

    const call = mockPrisma.indicacion_seguimiento.update.mock.calls[0][0];
    expect(call.data.intentos_contacto).toBeUndefined();
    expect(call.data.notas_secretaria).toBe('Llamé y no contestó');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// agendarCita (UC-SEG-002 — cerrar el ciclo, reutiliza citaService)
// ─────────────────────────────────────────────────────────────────────────────

describe('IndicacionSeguimientoService.agendarCita', () => {
  const agendarInput = {
    consultorio_id: 'consultorio-1',
    sede_id: 'sede-666',
    tipo_cita_id: 'tipo-1',
    fecha_hora_inicio: '2026-09-01T10:00:00.000Z',
  };

  it('lanza 404 si la indicación no existe en el tenant', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(null);

    await expect(
      service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(mockCitaService.create).not.toHaveBeenCalled();
  });

  it('lanza 409 si la indicación ya tiene cita_generada_id', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(
      makeIndicacionRow({ cita_generada_id: CITA_ID }),
    );

    await expect(
      service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INDICACION_YA_AGENDADA' });

    expect(mockCitaService.create).not.toHaveBeenCalled();
  });

  it('lanza 409 si el estado ya es agendada', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(
      makeIndicacionRow({ estado: 'agendada' }),
    );

    await expect(
      service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INDICACION_YA_AGENDADA' });
  });

  it('crea la cita vía citaService con el médico de la indicación por defecto', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockCitaService.create.mockResolvedValue({ id: CITA_ID, estado: 'programada' });
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(
      makeIndicacionRow({ estado: 'agendada', cita_generada_id: CITA_ID }),
    );

    const result = await service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput);

    expect(mockCitaService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        paciente_id: PACIENTE_ID,
        usuario_id: MEDICO_ID,
        consultorio_id: 'consultorio-1',
        sede_id: 'sede-666',
        tipo_cita_id: 'tipo-1',
        fecha_hora_inicio: agendarInput.fecha_hora_inicio,
        origen: 'seguimiento',
      }),
    );
    expect(result.cita).toEqual({ id: CITA_ID, estado: 'programada' });
    expect(result.indicacion.estado).toBe('agendada');
  });

  it('permite sobreescribir el médico con usuario_id', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockCitaService.create.mockResolvedValue({ id: CITA_ID, estado: 'programada' });
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(
      makeIndicacionRow({ estado: 'agendada', cita_generada_id: CITA_ID }),
    );

    await service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, {
      ...agendarInput,
      usuario_id: OTRO_MEDICO_ID,
    });

    expect(mockCitaService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ usuario_id: OTRO_MEDICO_ID }),
    );
  });

  it('vincula cita_generada_id y pasa la indicación a agendada tras crear la cita', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(makeIndicacionRow());
    mockCitaService.create.mockResolvedValue({ id: CITA_ID, estado: 'programada' });
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(
      makeIndicacionRow({ estado: 'agendada', cita_generada_id: CITA_ID }),
    );

    await service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput);

    expect(mockPrisma.indicacion_seguimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INDICACION_ID },
        data: expect.objectContaining({
          cita_generada_id: CITA_ID,
          estado: 'agendada',
          atendida_por: SECRETARIA_ID,
          fecha_gestion: expect.any(Date),
        }),
      }),
    );
  });

  it('usa la descripción de la indicación como notas por defecto si no se envían', async () => {
    mockPrisma.indicacion_seguimiento.findFirst.mockResolvedValue(
      makeIndicacionRow({ descripcion: 'Control de diabetes en 3 meses' }),
    );
    mockCitaService.create.mockResolvedValue({ id: CITA_ID, estado: 'programada' });
    mockPrisma.indicacion_seguimiento.update.mockResolvedValue(makeIndicacionRow());

    await service.agendarCita(INDICACION_ID, ORG_ID, SECRETARIA_ID, agendarInput);

    expect(mockCitaService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ notas: 'Seguimiento: Control de diabetes en 3 meses' }),
    );
  });
});
