// server/middleware/mcp-auth.js
import { getDb } from '../db/index.js';

/**
 * Authenticates MCP requests via Bearer token (API key).
 * Sets request.mcpApiKey with the full api_keys row.
 */
export async function mcpAuthMiddleware(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const db = getDb();
  const apiKey = db.prepare('SELECT * FROM api_keys WHERE api_key = ?').get(token);

  if (!apiKey) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }

  request.mcpApiKey = apiKey;
}
