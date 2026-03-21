// server/middleware/auth.js
import { getDb } from '../db/index.js';

export async function authMiddleware(request, reply) {
  const db = getDb();

  // Try Bearer token (API key) first
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const apiKeyToken = authHeader.slice(7);
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE api_key = ?').get(apiKeyToken);
    if (apiKey) {
      request.apiKey = apiKey;
      return;
    }
  }

  // Fall back to session cookie
  const token = request.cookies?.session_token;
  if (!token) {
    return reply.code(401).send({ error: 'Not authenticated' });
  }

  const session = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(token);

  if (!session) {
    return reply.code(401).send({ error: 'Session expired or invalid' });
  }

  request.session = session;
}
