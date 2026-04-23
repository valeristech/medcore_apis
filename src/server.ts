import 'dotenv/config';
import { loadEnv } from './core/env.js';
import { buildApp } from './app.js';

const env = loadEnv();

const startServer = async () => {
  try {
    const app = await buildApp(env);

    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    app.log.info(`Servidor escuchando en puerto ${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
};

startServer();
