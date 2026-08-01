import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    paciente_organizacion: { findFirst: vi.fn() },
    encuentro: { count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("../../../config/prisma.js", () => ({ default: mockPrisma }));
vi.mock("../../../core/utils/dates.js", () => ({
  serializeDates: (obj: unknown) => obj,
  serializeExtraFecha: (obj: unknown) => obj,
}));

// ── Import bajo test ──────────────────────────────────────────────────────────

import { PacienteService } from "../paciente.service.js";
import { HttpError } from "../../../core/errors.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const PACIENTE_ID = "pac-222";
const ENCUENTRO_ID = "enc-333";
const MEDICO_ID = "usr-444";

const makeRel = (overrides = {}) => ({
  id: "rel-555",
  paciente_id: PACIENTE_ID,
  organizacion_id: ORG_ID,
  numero_expediente: "EXP-2026-0001",
  fecha_registro: new Date(),
  activo: true,
  paciente: {
    id: PACIENTE_ID,
    nombre: "Juan",
    apellido: "Pérez",
    deleted: false,
    municipio: null,
  },
  ...overrides,
});

const makeEncuentroRow = (overrides = {}) => ({
  id: ENCUENTRO_ID,
  tipo: "primera_vez",
  estado: "firmado",
  motivo_consulta: "Dolor de cabeza",
  fecha: new Date("2026-01-15T10:00:00Z"),
  usuario: { id: MEDICO_ID, nombre: "Ana", apellido: "García" },
  sede: { id: "sede-1", nombre: "Sede Central" },
  nota_clinica: [
    {
      id: "nota-1",
      encuentro_id: ENCUENTRO_ID,
      motivo_consulta: "Dolor de cabeza",
      impresion_diagnostica: "Cefalea tensional",
      plan_tratamiento: "Analgésico",
      created_at: new Date(),
      updated_at: new Date(),
      diagnostico: [
        { id: "dx-1", codigo_icd10: "G44.2", descripcion: "Cefalea tensional", tipo: "principal", notas: null },
      ],
    },
  ],
  prescripcion: [
    {
      id: "rx-1",
      medicamento: "Ibuprofeno",
      dosis: "400mg",
      frecuencia: "cada 8h",
      estado: "activa",
      created_at: new Date(),
    },
  ],
  estudio_solicitado: [],
  evolucion: [],
  firma: [
    {
      id: "firma-1",
      usuario_id: MEDICO_ID,
      tipo: "electronica",
      hash_documento: "abc123",
      fecha_firma: new Date(),
      ip_origen: "127.0.0.1",
      usuario: { id: MEDICO_ID, nombre: "Ana", apellido: "García" },
    },
  ],
  ...overrides,
});

let service: PacienteService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PacienteService();

  mockPrisma.$transaction.mockImplementation(async (arr: unknown) => {
    if (Array.isArray(arr)) return Promise.all(arr);
    return (arr as (tx: unknown) => unknown)(mockPrisma);
  });
});

describe("PacienteService.getHistorial", () => {
  it("lanza 404 si el paciente no pertenece al tenant", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(null);

    await expect(service.getHistorial(PACIENTE_ID, ORG_ID, {})).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("consulta encuentros del paciente sin eliminados, paginado por defecto", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([makeEncuentroRow()]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(mockPrisma.encuentro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paciente_id: PACIENTE_ID, deleted: false }),
        orderBy: { fecha: "desc" },
        skip: 0,
        take: 10,
      }),
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.sort).toEqual({ sortOrder: "desc" });
  });

  it("respeta page, pageSize y sortOrder cuando se envían", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(25);
    mockPrisma.encuentro.findMany.mockResolvedValue([]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {
      page: 3,
      pageSize: 5,
      sortOrder: "asc",
    });

    expect(mockPrisma.encuentro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { fecha: "asc" }, skip: 10, take: 5 }),
    );
    expect(result.pagination).toEqual({ page: 3, pageSize: 5, total: 25, totalPages: 5 });
  });

  it("aplana nota_clinica[0] a un objeto único con diagnosticos", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([makeEncuentroRow()]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.nota).toMatchObject({
      id: "nota-1",
      impresion_diagnostica: "Cefalea tensional",
    });
    expect(result.items[0]?.nota?.diagnosticos).toHaveLength(1);
  });

  it("nota es null cuando el encuentro no tiene nota clínica", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([
      makeEncuentroRow({ nota_clinica: [] }),
    ]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.nota).toBeNull();
  });

  it("aplana firma[0] a un objeto único con autor", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([makeEncuentroRow()]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.firma).toMatchObject({
      id: "firma-1",
      hash_documento: "abc123",
      autor: { id: MEDICO_ID, nombre: "Ana", apellido: "García" },
    });
  });

  it("firma es null cuando el encuentro no está firmado", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([
      makeEncuentroRow({ estado: "abierto", firma: [] }),
    ]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.firma).toBeNull();
  });

  it("incluye evoluciones con su autor", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([
      makeEncuentroRow({
        evolucion: [
          {
            id: "evo-1",
            nota: "Paciente estable.",
            tipo: "medica",
            fecha: new Date(),
            usuario: { id: MEDICO_ID, nombre: "Ana", apellido: "García" },
          },
        ],
      }),
    ]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.evoluciones).toHaveLength(1);
    expect(result.items[0]?.evoluciones[0]).toMatchObject({
      nota: "Paciente estable.",
      autor: { id: MEDICO_ID, nombre: "Ana", apellido: "García" },
    });
  });

  it("incluye prescripciones y estudios del encuentro", async () => {
    mockPrisma.paciente_organizacion.findFirst.mockResolvedValue(makeRel());
    mockPrisma.encuentro.count.mockResolvedValue(1);
    mockPrisma.encuentro.findMany.mockResolvedValue([
      makeEncuentroRow({
        estudio_solicitado: [
          { id: "est-1", tipo: "laboratorio", nombre: "Hemograma", estado: "informado" },
        ],
      }),
    ]);

    const result = await service.getHistorial(PACIENTE_ID, ORG_ID, {});

    expect(result.items[0]?.prescripciones).toHaveLength(1);
    expect(result.items[0]?.estudios).toHaveLength(1);
    expect(result.items[0]?.estudios[0]).toMatchObject({ nombre: "Hemograma" });
  });
});
