export enum EstadoPrescripcion {
  Activa = 'activa',
  Suspendida = 'suspendida',
  Cumplida = 'cumplida',
  Cancelada = 'cancelada',
}
export const ESTADO_PRESCRIPCION_VALUES = Object.values(EstadoPrescripcion) as [string, ...string[]];

export enum TipoDiagnostico {
  Principal = 'principal',
  Secundario = 'secundario',
  Diferencial = 'diferencial',
}
export const TIPO_DIAGNOSTICO_VALUES = Object.values(TipoDiagnostico) as [string, ...string[]];

export enum EstadoEncuentro {
  Abierto = 'abierto',
  Cerrado = 'cerrado',
  Firmado = 'firmado',
}
export const ESTADO_ENCUENTRO_VALUES = Object.values(EstadoEncuentro) as [string, ...string[]];

export enum TipoEncuentro {
  PrimeraVez = 'primera_vez',
  Control = 'control',
  Urgencia = 'urgencia',
  Interconsulta = 'interconsulta',
}
export const TIPO_ENCUENTRO_VALUES = Object.values(TipoEncuentro) as [string, ...string[]];

// UC-HCE-004 — Solicitud de estudios
export enum TipoEstudio {
  Laboratorio = 'laboratorio',
  Imagen = 'imagen',
  Patologia = 'patologia',
  Otro = 'otro',
}
export const TIPO_ESTUDIO_VALUES = Object.values(TipoEstudio) as [string, ...string[]];

export enum EstadoEstudio {
  Solicitado = 'solicitado',
  ResultadoCargado = 'resultado_cargado',
  Informado = 'informado',
}
export const ESTADO_ESTUDIO_VALUES = Object.values(EstadoEstudio) as [string, ...string[]];

// UC-HCE-005 — Evolución
export enum TipoEvolucion {
  Medica = 'medica',
  Enfermeria = 'enfermeria',
  Otro = 'otro',
}
export const TIPO_EVOLUCION_VALUES = Object.values(TipoEvolucion) as [string, ...string[]];

// UC-HCE-006 — Firma
export enum TipoFirma {
  Electronica = 'electronica',
  DigitalCertificada = 'digital_certificada',
}
export const TIPO_FIRMA_VALUES = Object.values(TipoFirma) as [string, ...string[]];
