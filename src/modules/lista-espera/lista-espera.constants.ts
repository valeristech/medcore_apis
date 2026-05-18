export const LISTA_ESPERA_ESTADOS = ['activa', 'asignada', 'cancelada', 'expirada'] as const;

export type ListaEsperaEstado = (typeof LISTA_ESPERA_ESTADOS)[number];

export const LISTA_ESPERA_ESTADO_DEFAULT: ListaEsperaEstado = 'activa';

export const LISTA_ESPERA_ESTADO_ACTIVA: ListaEsperaEstado = 'activa';

export const LISTA_ESPERA_SORT_BY_VALUES = ['fecha_solicitud', 'fecha_desde', 'created_at'] as const;
