import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySession, type Session } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session;
  }
}

/** preHandler: requires a valid Bearer session, else 401. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'missing_token' });
    return;
  }
  try {
    req.session = await verifySession(header.slice(7));
  } catch {
    await reply.code(401).send({ error: 'invalid_token' });
  }
}

export function sessionOf(req: FastifyRequest): Session {
  if (!req.session) throw new Error('requireAuth did not run');
  return req.session;
}
