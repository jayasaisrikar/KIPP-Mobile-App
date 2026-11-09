import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';
import { taskInputSchema, taskStatusSchema } from '../contracts.js';
import { requireAuth, sessionOf } from '../lib/auth.js';
import { upsertTaskEdge } from '../graph/sync.js';

const patchSchema = taskInputSchema.partial().extend({
  status: taskStatusSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
});
type PatchBody = z.infer<typeof patchSchema>;

async function syncGraph(task: { id: string; userId: string; title: string; status: string }): Promise<void> {
  try {
    await upsertTaskEdge(task.userId, task.id, task.title, task.status);
  } catch {
    // Postgres is authoritative; graph lag is retried on the next mutation.
  }
}

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/v1/tasks', async (req, reply) => {
    const { userId } = sessionOf(req);
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(sql`${tasks.dueDate} asc nulls last`, desc(tasks.createdAt));
    return reply.send({ tasks: rows });
  });

  app.post('/v1/tasks', async (req, reply) => {
    const { userId } = sessionOf(req);
    const parsed = taskInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });

    await syncGraph(row);
    return reply.code(201).send({ task: row });
  });

  app.patch<{ Params: { id: string } }>('/v1/tasks/:id', async (req, reply) => {
    const { userId } = sessionOf(req);
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const { expectedVersion, ...patch } = parsed.data;
    const current = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, userId)))
      .limit(1);
    const existing = current[0];
    if (!existing) return reply.code(404).send({ error: 'task_not_found' });
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      return reply.code(409).send({ error: 'version_conflict', task: existing });
    }

    const [row] = await db
      .update(tasks)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null } : {}),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, userId)))
      .returning();

    if (!row) return reply.code(404).send({ error: 'task_not_found' });
    await syncGraph(row);
    return reply.send({ task: row });
  });

  app.delete<{ Params: { id: string } }>('/v1/tasks/:id', async (req, reply) => {
    const { userId } = sessionOf(req);
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });
    if (deleted.length === 0) return reply.code(404).send({ error: 'task_not_found' });

    try {
      const { getDriver } = await import('../graph/client.js');
      const session = getDriver().session();
      try {
        await session.run('MATCH (t:Task {id: $id}) DETACH DELETE t', { id: req.params.id });
      } finally {
        await session.close();
      }
    } catch {
      // orphan graph node is harmless; cleaned up on next graph pass
    }
    return reply.code(204).send();
  });
}
