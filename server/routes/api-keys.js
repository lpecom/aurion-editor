// server/routes/api-keys.js
import { randomUUID, randomBytes } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function apiKeysRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/api-keys
  fastify.get('/api-keys', async () => {
    const db = getDb();
    const keys = db.prepare('SELECT id, nickname, api_key, created_at FROM api_keys ORDER BY created_at DESC').all();
    return keys.map(k => ({
      ...k,
      api_key: '••••••••' + k.api_key.slice(-8),
    }));
  });

  // POST /api/api-keys
  fastify.post('/api-keys', {
    schema: {
      body: {
        type: 'object',
        required: ['nickname'],
        properties: {
          nickname: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const apiKey = 'aur_' + randomBytes(32).toString('hex');
    const { nickname } = request.body;

    db.prepare('INSERT INTO api_keys (id, nickname, api_key) VALUES (?, ?, ?)').run(id, nickname, apiKey);

    reply.code(201).send({
      id,
      nickname,
      api_key: apiKey, // Full key shown only on creation
      created_at: new Date().toISOString(),
    });
  });

  // DELETE /api/api-keys/:id
  fastify.delete('/api-keys/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'API key not found' });

    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return { ok: true };
  });
}
