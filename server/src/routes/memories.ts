import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { int } from 'neo4j-driver';
import { db } from '../db/client.js';
import { memories } from '../db/schema.js';
import { memoryInputSchema } from '../contracts.js';
import { requireAuth, sessionOf } from '../lib/auth.js';
import { getDriver } from '../graph/client.js';
import { upsertMemoryEdge } from '../graph/sync.js';

/**
 * Search strategy: when `q` is present the graph does the finding (full-text
 * over Memory nodes, which is the whole reason Neo4j is in the stack) and
 * Postgres hydrates the rows. Without `q` it's a plain table read.
 */
async function searchIds(userId: string, q: string, limit: number): Promise<string[]> {
  const session = getDriver().session();
  try {
    const res = await session.run(
      `CALL db.index.fulltext.queryNodes('memory_text_search', $q)
       YIELD node, score
       WHERE exists((:Person {id: $userId})-[:REMEMBERS]->(node))
       RETURN node.id AS id ORDER BY score DESC LIMIT $limit`,
      // neo4j-driver serialises plain JS numbers as floats, which LIMIT rejects
      { q, userId, limit: int(limit) },
    );
    return res.records.map((r) => String(r.get('id')));
  } finally {
    await session.close();
  }
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get<{ Querystring: { q?: string; category?: string; limit?: string } }>(
    '/v1/memories',
    async (req, reply) => {
      const { userId } = sessionOf(req);
      const { q, category, limit } = req.query;
      const take = Math.min(Number(limit ?? 50) || 50, 200);

      if (q && q.trim()) {
        try {
          const ids = await searchIds(userId, q.trim(), take);
          if (ids.length === 0) return reply.send({ memories: [], source: 'graph' });
          const rows = await db
            .select()
            .from(memories)
            .where(
              and(
                eq(memories.userId, userId),
                sql`${memories.deletedAt} is null`,
                inArray(memories.id, ids),
              ),
            )
            .orderBy(desc(memories.createdAt));
          return reply.send({ memories: rows, source: 'graph' });
        } catch (err) {
          req.log.warn({ err }, 'graph search failed, falling back to LIKE');
        }
      }

      const rows = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.userId, userId),
            sql`${memories.deletedAt} is null`,
            category ? eq(memories.category, category) : sql`true`,
          ),
        )
        .orderBy(desc(memories.createdAt))
        .limit(take);
      return reply.send({ memories: rows, source: q && q.trim() ? 'fallback' : 'table' });
    },
  );

  app.post('/v1/memories', async (req, reply) => {
    const { userId } = sessionOf(req);
    const parsed = memoryInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const [row] = await db
      .insert(memories)
      .values({
        userId,
        text: parsed.data.text,
        category: parsed.data.category,
        sensitive: parsed.data.sensitive,
        explicit: parsed.data.explicit,
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });

    try {
      await upsertMemoryEdge(userId, row.id, row.text, row.category);
    } catch (err) {
      req.log.warn({ err }, 'graph memory edge failed (non-fatal)');
    }
    return reply.code(201).send({ memory: row });
  });

  app.delete<{ Params: { id: string } }>('/v1/memories/:id', async (req, reply) => {
    const { userId } = sessionOf(req);
    const updated = await db
      .update(memories)
      .set({ deletedAt: new Date() })
      .where(and(eq(memories.id, req.params.id), eq(memories.userId, userId), sql`${memories.deletedAt} is null`))
      .returning({ id: memories.id });
    if (updated.length === 0) return reply.code(404).send({ error: 'memory_not_found' });

    try {
      const session = getDriver().session();
      try {
        await session.run('MATCH (m:Memory {id: $id}) SET m.deletedAt = timestamp()', { id: req.params.id });
      } finally {
        await session.close();
      }
    } catch {
      // non-fatal: PG row is the source of truth
    }
    return reply.code(204).send();
  });
}
