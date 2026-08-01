import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../env.js';
import { createPlanSeguimientoJobService } from '../../modules/seguimiento/plan-seguimiento.job.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startPlanSeguimientoScheduler(app: FastifyInstance, env: AppEnv) {
  if (!env.PLAN_SEGUIMIENTO_CRON_ENABLED) return;

  const run = async () => {
    try {
      const job = createPlanSeguimientoJobService(app.log);
      const result = await job.ejecutar();
      app.log.info(
        {
          indicaciones_generadas: result.indicaciones_generadas,
          actividades_vencidas_marcadas: result.actividades_vencidas_marcadas,
          omitidas: result.omitidas,
          fallidas: result.fallidas,
        },
        'Job planes de seguimiento completado',
      );
    } catch (err) {
      app.log.error({ err }, 'Job planes de seguimiento falló');
    }
  };

  void run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });

  app.log.info('Scheduler de planes de seguimiento activo (cada 24 horas)');
}
