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
