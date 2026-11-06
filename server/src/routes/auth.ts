import type { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { env } from '../config.js';
import { googleAuthSchema } from '../contracts.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { signSession, verifySession } from '../lib/session.js';
import { upsertPerson } from '../graph/sync.js';

const client = new OAuth2Client();

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/google', async (req, reply) => {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: parsed.data.idToken,
        audience: env.googleClientIds,
      });
      payload = ticket.getPayload();
    } catch {
      return reply.code(401).send({ error: 'invalid_id_token' });
    }

    const sub = payload?.sub;
    const email = payload?.email;
    if (!payload || !sub || !email || payload.email_verified === false) {
      return reply.code(401).send({ error: 'unverified_email' });
    }

    const [user] = await db
      .insert(users)
      .values({ googleSub: sub, email, name: payload.name ?? null, picture: payload.picture ?? null })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: {
          email,
          name: payload.name ?? null,
          picture: payload.picture ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!user) return reply.code(500).send({ error: 'user_upsert_failed' });

    try {
      await upsertPerson({ id: user.id, email: user.email, name: user.name, picture: user.picture });
    } catch (err) {
      req.log.warn({ err }, 'graph person upsert failed (non-fatal)');
    }

    const token = await signSession({ sub: user.id, userId: user.id, email: user.email });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
    });
  });

  app.get('/v1/me', async (req, reply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return reply.code(401).send({ error: 'missing_token' });
    try {
      const session = await verifySession(header.slice(7));
      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (!user) return reply.code(404).send({ error: 'user_not_found' });
      return reply.send({ user });
    } catch {
      return reply.code(401).send({ error: 'invalid_token' });
    }
  });
}
