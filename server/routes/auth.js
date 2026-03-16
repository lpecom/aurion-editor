// server/routes/auth.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function authRoutes(fastify) {
  // POST /api/auth/login
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body;

    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS;
    if (!adminPass) {
      console.warn('WARNING: ADMIN_PASS not set! Using insecure default. Set ADMIN_PASS env var in production.');
    }
    const effectivePass = adminPass || 'changeme';

    if (username !== adminUser || password !== effectivePass) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const db = getDb();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);

    // Clean up expired sessions
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();

    reply
      .setCookie('session_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
      })
      .send({ ok: true, user: { username: adminUser } });
  });

  // POST /api/auth/logout
  fastify.post('/auth/logout', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const token = request.cookies.session_token;
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

    reply
      .clearCookie('session_token', { path: '/' })
      .send({ ok: true });
  });

  // GET /api/auth/me
  fastify.get('/auth/me', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const adminUser = process.env.ADMIN_USER || 'admin';
    return { user: { username: adminUser } };
  });
}
