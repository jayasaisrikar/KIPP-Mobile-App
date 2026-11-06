import Fastify from 'fastify';
import { env } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.isProd ? 'info' : 'debug',
      transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
    },
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    reply.code(500).send({ error: 'internal_error' });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}
