// server/routes/pixels.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function pixelsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/pixels
  fastify.get('/pixels', async () => {
    const db = getDb();
    const pixels = db.prepare('SELECT * FROM pixels ORDER BY created_at DESC').all();
    return pixels.map(p => ({
      ...p,
      config: p.config ? JSON.parse(p.config) : null,
    }));
  });

  // GET /api/pixels/:id
  fastify.get('/pixels/:id', async (request, reply) => {
    const db = getDb();
    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(request.params.id);
    if (!pixel) return reply.code(404).send({ error: 'Pixel not found' });
    return { ...pixel, config: pixel.config ? JSON.parse(pixel.config) : null };
  });

  // POST /api/pixels
  fastify.post('/pixels', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'pixel_id'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['facebook', 'google', 'tiktok', 'custom'] },
          pixel_id: { type: 'string' },
          config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, type, pixel_id, config } = request.body;

    db.prepare('INSERT INTO pixels (id, name, type, pixel_id, config) VALUES (?, ?, ?, ?, ?)').run(
      id, name, type, pixel_id, config ? JSON.stringify(config) : null
    );

    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    reply.code(201).send({ ...pixel, config: pixel.config ? JSON.parse(pixel.config) : null });
  });

  // PUT /api/pixels/:id
  fastify.put('/pixels/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['facebook', 'google', 'tiktok', 'custom'] },
          pixel_id: { type: 'string' },
          config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Pixel not found' });

    const { name, type, pixel_id, config } = request.body;

    db.prepare(`
      UPDATE pixels SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        pixel_id = COALESCE(?, pixel_id),
        config = COALESCE(?, config)
      WHERE id = ?
    `).run(
      name || null, type || null, pixel_id || null,
      config ? JSON.stringify(config) : null,
      id
    );

    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    return { ...pixel, config: pixel.config ? JSON.parse(pixel.config) : null };
  });

  // DELETE /api/pixels/:id
  fastify.delete('/pixels/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM pixels WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Pixel not found' });

    db.prepare('DELETE FROM pixels WHERE id = ?').run(id);
    return { ok: true };
  });
}
