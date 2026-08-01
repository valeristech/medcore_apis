import 'dotenv/config';
import { loadEnv } from './core/env.js';
import { buildApp } from './app.js';
import { startRecordatorioScheduler } from './core/jobs/recordatorio.scheduler.js';
import { startPlanSeguimientoScheduler } from './core/jobs/plan-seguimiento.scheduler.js';
import { startAlertaScheduler } from './core/jobs/alerta.scheduler.js';

const env = loadEnv();

const startServer = async () => {
  try {
    const app = await buildApp(env);

    // Registrar schedulers ANTES de listen() para poder agregar hooks
    startRecordatorioScheduler(app, env);
    startPlanSeguimientoScheduler(app, env);
    startAlertaScheduler(app, env);

    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    app.log.info(`Servidor escuchando en puerto ${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
};

startServer();
