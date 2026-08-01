import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../env.js';

function buildOpenApiServers(env: AppEnv): { url: string; description: string }[] {
  const local = `http://localhost:${env.PORT}`;

  if (env.NODE_ENV === 'development') {
    const servers: { url: string; description: string }[] = [
      { url: local, description: `Local (puerto ${env.PORT})` },
    ];
    if (env.API_PUBLIC_URL !== local) {
      servers.push({ url: env.API_PUBLIC_URL, description: 'Desplegado / remoto' });
    }
    return servers;
  }

  return [{ url: env.API_PUBLIC_URL, description: 'API' }];
}

export async function registerOpenApi(app: FastifyInstance, env: AppEnv) {
  const servers = buildOpenApiServers(env);

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'MediCore API',
        description: 'API REST del backend MediCore.',
        version: '1.0.0',
      },
      servers,
      tags: [
        { name: 'Sistema', description: 'Salud del servicio' },
        {
          name: 'Autenticación',
          description:
            'Login, refresh, logout y JWT. El access token incluye permisos del rol para RBAC.',
        },
        {
          name: 'Core / Organizaciones',
          description: 'Gestión de organizaciones (tenant), filtros y mantenimiento.',
        },
        {
          name: 'Core / Sedes',
          description: 'Gestión de sedes por organización.',
        },
        {
          name: 'Core / Consultorios',
          description: 'Gestión de consultorios por sede.',
        },
        {
          name: 'Core / Catálogo geográfico',
          description:
            'Departamentos y municipios por organización (tenant), para dirección de pacientes y formularios.',
        },
        {
          name: 'Core / Roles y Permisos',
          description: 'CRUD de roles, validación de permisos JSON y plantillas clínicas.',
        },
        {
          name: 'Core / Usuarios',
          description: 'CRUD de usuarios, asignación usuario_sede, hash de contraseña e invalidación de refresh.',
        },
        {
          name: 'Core / Auditoría',
          description: 'Consulta de eventos de audit_log por tenant.',
        },
        {
          name: 'Agenda / Disponibilidad',
          description:
            'Reglas de disponibilidad (`regla_disponibilidad`) y calendario con zona IANA (default Guatemala vía `organizacion.zona_horaria` o `America/Guatemala`): reglas + citas, ventanas y huecos por slot.',
        },
        {
          name: 'Agenda / Tipos de cita',
          description:
            'Catálogo por organización: nombre, duración, color y flag de telemedicina. Usado al agendar citas y en reportes.',
        },
        {
          name: 'Agenda / Citas',
          description:
            'Crear, reagendar (`PUT /api/citas/:id`), cancelar (`POST /api/citas/:id/cancelar`) y marcar no-show (`PUT /api/citas/:id/no-show`). Validación de tenant, conflictos, disponibilidad y alertas de seguimiento.',
        },
        {
          name: 'Agenda / Recordatorios',
          description:
            'Plantillas por canal (whatsapp, sms, email) y job horario UC-AGE-005. Ejecución manual/cron: `POST /api/agenda/recordatorios/ejecutar` con `X-Cron-Secret`.',
        },
        {
          name: 'Agenda / Lista de espera',
          description:
            'UC-AGE-007: alta y gestión de pacientes sin disponibilidad. Sugerencias FIFO al liberar un slot (`GET /api/lista-espera/sugerencias` o en cancelar cita).',
        },
        {
          name: 'Pacientes',
          description:
            'Alta y mantenimiento de pacientes por tenant (`paciente` + `paciente_organizacion`), búsqueda y perfil.',
        },
        {
          name: 'Pacientes / Alergias',
          description: 'CRUD de `alergia` por paciente (sustancia, severidad, tipo de reacción).',
        },
        {
          name: 'Pacientes / Seguros',
          description: 'CRUD de `paciente_seguro`: pólizas y vigencia por aseguradora.',
        },
        {
          name: 'Pacientes / Historial',
          description:
            'UC-HCE-007: historial clínico paginado del paciente (nota + diagnósticos, prescripciones, estudios, evoluciones y firma por encuentro).',
        },
        {
          name: 'Aseguradoras',
          description: 'Catálogo global de aseguradoras (compañías de seguros médicos).',
        },
        {
          name: 'Aseguradoras / Convenios',
          description: 'Convenios por tenant con una aseguradora: precios y servicios cubiertos.',
        },
        {
          name: 'HCE / Encuentros',
          description:
            'UC-HCE-001: iniciar consulta (`POST /api/encuentros`) — valida la cita del médico, la pasa a `en_curso` y abre el `encuentro` con el contexto clínico del paciente (alergias, medicación activa, últimos encuentros, estudios pendientes).',
        },
        {
          name: 'HCE / Nota Clínica',
          description:
            'UC-HCE-002: crear/actualizar la `nota_clinica` del encuentro y sus diagnósticos ICD-10. Solo con el encuentro `abierto`.',
        },
        {
          name: 'HCE / Prescripciones',
          description:
            'UC-HCE-003: prescripciones del encuentro — creación con chequeo de alergias y stock, actualización y baja lógica.',
        },
        {
          name: 'HCE / Estudios',
          description:
            'UC-HCE-004: solicitud de estudios del encuentro y registro de resultados (permitido incluso con el encuentro ya firmado).',
        },
        {
          name: 'HCE / Evolución',
          description: 'UC-HCE-005: notas de evolución del encuentro (solo alta y lectura, orden cronológico).',
        },
        {
          name: 'HCE / Firma',
          description:
            'UC-HCE-006: firma y cierre del encuentro — hash del contenido clínico y cierre de la cita asociada.',
        },
        {
          name: 'Seguimiento / Indicaciones',
          description:
            'UC-SEG-001: el médico registra desde el `encuentro` que el paciente necesita seguimiento ' +
            '(`indicacion_seguimiento`, estado `pendiente`) sin agendar la cita todavía. ' +
            'UC-SEG-002: bandeja de secretaría — listar/filtrar por estado (orden por prioridad y ' +
            'antigüedad), actualizar gestión (contacto, notas, transición de estado) y cerrar el ciclo ' +
            'agendando la cita (`cita_generada_id`, estado `agendada`), reutilizando el módulo de citas.',
        },
        {
          name: 'Seguimiento / Planes',
          description:
            'UC-SEG-003: planes de seguimiento para pacientes crónicos (diabetes, HTA, prenatal, etc.). ' +
            'El médico abre el plan en `borrador` (nombre, indicación, diagnóstico/ICD-10, frecuencia); ' +
            'la secretaría lo completa con `plan_seguimiento_actividad` (tipo, fechas, instrucciones, ' +
            'preparación) y lo activa (`PUT /:id/estado`). Job diario (`POST /cron/ejecutar`, ' +
            '`X-Cron-Secret`): genera `indicacion_seguimiento` automáticas cuando se acerca ' +
            '`fecha_programada` y marca `vencida` toda actividad fuera de plazo.',
        },
        {
          name: 'Seguimiento / Alertas',
          description:
            'UC-SEG-004: bandeja de `alerta_preventiva` (generadas por el sistema o manualmente ' +
            '— p. ej. no-show de citas). Tipos: `control_vencido`, `actividad_pendiente`, ' +
            '`paciente_sin_contacto`, `plan_abandonado`, `preventivo_anual`, `personalizada`. ' +
            'Listar/filtrar por `estado` (default `activa`), `visible_para` y `prioridad` ' +
            '(`GET /alertas`), y gestionar/cerrar (`PATCH /alertas/:id`). Job diario ' +
            '(`POST /alertas/cron/ejecutar`, `X-Cron-Secret`) genera alertas a partir de ' +
            'indicaciones y actividades/planes de seguimiento vencidos.',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Access JWT (POST /api/auth/login o /api/auth/refresh). Cabecera: Authorization: Bearer <token>.',
          },
        },
      },
    },
  });

  app.log.info({ servers }, 'OpenAPI servers (Scalar /docs)');
}

/**
 * Scalar lee el OpenAPI generado por `@fastify/swagger`.
 * UI: `/docs` · JSON: `/docs/openapi.json` · YAML: `/docs/openapi.yaml`
 */
export async function registerScalarDocs(app: FastifyInstance) {
  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      theme: 'default',
    },
    logLevel: 'silent',
  });
}
