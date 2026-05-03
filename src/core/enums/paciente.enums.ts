export enum Genero {
  Masculino     = 'masculino',
  Femenino      = 'femenino',
  Otro          = 'otro',
  NoEspecificado = 'no_especificado',
}

export const GENERO_VALUES = Object.values(Genero) as [string, ...string[]];

export enum SeveridadAlergia {
  Leve     = 'leve',
  Moderada = 'moderada',
  Grave    = 'grave',
}

export const SEVERIDAD_ALERGIA_VALUES = Object.values(SeveridadAlergia) as [string, ...string[]];

export enum GrupoSanguineo {
  APositivo  = 'A+',
  ANegativo  = 'A-',
  BPositivo  = 'B+',
  BNegativo  = 'B-',
  ABPositivo = 'AB+',
  ABNegativo = 'AB-',
  OPositivo  = 'O+',
  ONegativo  = 'O-',
  Desconocido = 'desconocido',
}

export const GRUPO_SANGUINEO_VALUES = Object.values(GrupoSanguineo) as [string, ...string[]];
