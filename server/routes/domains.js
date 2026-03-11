// server/routes/domains.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function domainsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/domains
  fastify.get('/domains', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all();
  });

  // GET /api/domains/:id
  fastify.get('/domains/:id', async (request, reply) => {
    const db = getDb();
    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(request.params.id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });
    return domain;
  });

  // POST /api/domains
  fastify.post('/domains', {
    schema: {
      body: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string' },
          cloudflare_zone_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { domain, cloudflare_zone_id } = request.body;

    const existing = db.prepare('SELECT id FROM domains WHERE domain = ?').get(domain);
    if (existing) return reply.code(409).send({ error: 'Domain already exists' });

    db.prepare('INSERT INTO domains (id, domain, cloudflare_zone_id) VALUES (?, ?, ?)').run(
      id, domain, cloudflare_zone_id || null
    );

    const created = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    reply.code(201).send(created);
  });

  // PUT /api/domains/:id
  fastify.put('/domains/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          ssl_status: { type: 'string', enum: ['pending', 'active', 'error'] },
          cloudflare_zone_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Domain not found' });

    const { domain, ssl_status, cloudflare_zone_id } = request.body;

    if (domain && domain !== existing.domain) {
      const taken = db.prepare('SELECT id FROM domains WHERE domain = ? AND id != ?').get(domain, id);
      if (taken) return reply.code(409).send({ error: 'Domain already exists' });
    }

    db.prepare(`
      UPDATE domains SET
        domain = COALESCE(?, domain),
        ssl_status = COALESCE(?, ssl_status),
        cloudflare_zone_id = COALESCE(?, cloudflare_zone_id)
      WHERE id = ?
    `).run(domain || null, ssl_status || null, cloudflare_zone_id || null, id);

    return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
  });

  // DELETE /api/domains/:id
  fastify.delete('/domains/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM domains WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Domain not found' });

    db.prepare('DELETE FROM domains WHERE id = ?').run(id);
    return { ok: true };
  });
}
