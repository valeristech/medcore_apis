import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../env.js';
import { createRecordatorioJobService } from '../../modules/recordatorios/recordatorio.job.service.js';

const HOUR_MS = 60 * 60 * 1000;

export function startRecordatorioScheduler(app: FastifyInstance, env: AppEnv) {
  if (!env.RECORDATORIOS_CRON_ENABLED) return;

  const run = async () => {
    try {
      const job = createRecordatorioJobService(env, app.log);
      const result = await job.ejecutar();
      app.log.info(
        {
          enviados: result.enviados,
          fallidos: result.fallidos,
          omitidos: result.omitidos,
        },
        'Job recordatorios completado',
      );
    } catch (err) {
      app.log.error({ err }, 'Job recordatorios falló');
    }
  };

  void run();
  const timer = setInterval(run, HOUR_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });

  app.log.info('Scheduler de recordatorios activo (cada 1 hora)');
}
