// server/middleware/auth.js
import { getDb } from '../db/index.js';

export async function authMiddleware(request, reply) {
  const token = request.cookies?.session_token;

  if (!token) {
    return reply.code(401).send({ error: 'Not authenticated' });
  }

  const db = getDb();
  const session = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(token);

  if (!session) {
    return reply.code(401).send({ error: 'Session expired or invalid' });
  }

  request.session = session;
}
