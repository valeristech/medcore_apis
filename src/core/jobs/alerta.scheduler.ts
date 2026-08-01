import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../env.js';
import { createAlertaJobService } from '../../modules/seguimiento/alerta.job.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startAlertaScheduler(app: FastifyInstance, env: AppEnv) {
  if (!env.ALERTA_CRON_ENABLED) return;

  const run = async () => {
    try {
      const job = createAlertaJobService(app.log);
      const result = await job.ejecutar();
      app.log.info(
        {
          alertas_generadas: result.alertas_generadas,
          omitidas: result.omitidas,
          fallidas: result.fallidas,
        },
        'Job de alertas preventivas completado',
      );
    } catch (err) {
      app.log.error({ err }, 'Job de alertas preventivas falló');
    }
  };

  void run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });

  app.log.info('Scheduler de alertas preventivas activo (cada 24 horas)');
}
