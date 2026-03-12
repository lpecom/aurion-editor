// server/routes/translation-providers.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

function maskApiKey(key) {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

export default async function translationProvidersRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/translation-providers
  fastify.get('/translation-providers', async () => {
    const db = getDb();
    const providers = db.prepare('SELECT * FROM translation_providers ORDER BY created_at DESC').all();
    return providers.map(p => ({
      ...p,
      api_key: maskApiKey(p.api_key),
    }));
  });

  // POST /api/translation-providers
  fastify.post('/translation-providers', {
    schema: {
      body: {
        type: 'object',
        required: ['provider', 'api_key'],
        properties: {
          provider: { type: 'string', enum: ['google', 'openai'] },
          api_key: { type: 'string' },
          model: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { provider, api_key, model } = request.body;

    db.prepare(
      'INSERT INTO translation_providers (id, provider, api_key, model) VALUES (?, ?, ?, ?)'
    ).run(id, provider, api_key, model || null);

    const created = db.prepare('SELECT * FROM translation_providers WHERE id = ?').get(id);
    reply.code(201).send({
      ...created,
      api_key: maskApiKey(created.api_key),
    });
  });

  // PUT /api/translation-providers/:id
  fastify.put('/translation-providers/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['google', 'openai'] },
          api_key: { type: 'string' },
          model: { type: 'string' },
          active: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM translation_providers WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Provider not found' });

    const { provider, api_key, model, active } = request.body;

    db.prepare(`
      UPDATE translation_providers SET
        provider = COALESCE(?, provider),
        api_key = COALESCE(?, api_key),
        model = COALESCE(?, model),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      provider || null,
      api_key || null,
      model || null,
      active !== undefined ? active : null,
      id
    );

    const updated = db.prepare('SELECT * FROM translation_providers WHERE id = ?').get(id);
    return {
      ...updated,
      api_key: maskApiKey(updated.api_key),
    };
  });

  // DELETE /api/translation-providers/:id
  fastify.delete('/translation-providers/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM translation_providers WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Provider not found' });

    db.prepare('DELETE FROM translation_providers WHERE id = ?').run(id);
    return { ok: true };
  });
}
