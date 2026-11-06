import type { FastifyInstance } from 'fastify';
import { pingNeo4j } from '../graph/client.js';
import { pingPostgres } from '../db/client.js';

async function check(fn: () => Promise<void>): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_req, reply) => {
    const [postgres, neo4j] = await Promise.all([check(pingPostgres), check(pingNeo4j)]);
    const ok = postgres.ok && neo4j.ok;
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      checks: { postgres, neo4j },
      uptime_s: Math.round(process.uptime()),
    });
  });
}
