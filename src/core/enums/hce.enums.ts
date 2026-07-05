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
