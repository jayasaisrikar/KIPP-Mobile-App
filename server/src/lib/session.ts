import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type Session = {
  sub: string;
  userId: string;
  email: string;
};

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuer('kipp')
    .setAudience('kipp-app')
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<Session> {
  const { payload } = await jwtVerify(token, secret, { issuer: 'kipp', audience: 'kipp-app' });
  if (!payload.sub) throw new Error('missing subject');
  return {
    sub: payload.sub,
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
  };
}
