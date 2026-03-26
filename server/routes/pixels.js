// server/routes/pixels.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

function parsePixelRow(p) {
  return {
    ...p,
    config: p.config ? JSON.parse(p.config) : null,
    events: p.events ? JSON.parse(p.events) : [],
  };
}

export default async function pixelsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/pixels
  fastify.get('/pixels', async () => {
    const db = getDb();
    const pixels = db.prepare('SELECT * FROM pixels ORDER BY created_at DESC').all();

    // Load page_ids for each pixel
    const stmtPages = db.prepare('SELECT page_id FROM pixel_pages WHERE pixel_id = ?');
    return pixels.map(p => {
      const pageRows = stmtPages.all(p.id);
      return {
        ...parsePixelRow(p),
        page_ids: pageRows.map(r => r.page_id),
      };
    });
  });

  // GET /api/pixels/:id
  fastify.get('/pixels/:id', async (request, reply) => {
    const db = getDb();
    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(request.params.id);
    if (!pixel) return reply.code(404).send({ error: 'Pixel not found' });

    const pageRows = db.prepare('SELECT page_id FROM pixel_pages WHERE pixel_id = ?').all(pixel.id);
    return {
      ...parsePixelRow(pixel),
      page_ids: pageRows.map(r => r.page_id),
    };
  });

  // POST /api/pixels
  fastify.post('/pixels', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'pixel_id'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['facebook', 'google', 'tiktok', 'taboola', 'custom'] },
          pixel_id: { type: 'string' },
          config: { type: 'object' },
          events: { type: 'array', items: { type: 'string' } },
          page_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, type, pixel_id, config, events, page_ids } = request.body;

    db.prepare('INSERT INTO pixels (id, name, type, pixel_id, config, events) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, name, type, pixel_id,
      config ? JSON.stringify(config) : null,
      events && events.length > 0 ? JSON.stringify(events) : null
    );

    // Save page associations
    if (page_ids && page_ids.length > 0) {
      const insertPage = db.prepare('INSERT OR IGNORE INTO pixel_pages (pixel_id, page_id) VALUES (?, ?)');
      for (const pageId of page_ids) {
        insertPage.run(id, pageId);
      }
    }

    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    const pageRows = db.prepare('SELECT page_id FROM pixel_pages WHERE pixel_id = ?').all(id);
    reply.code(201).send({
      ...parsePixelRow(pixel),
      page_ids: pageRows.map(r => r.page_id),
    });
  });

  // PUT /api/pixels/:id
  fastify.put('/pixels/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['facebook', 'google', 'tiktok', 'taboola', 'custom'] },
          pixel_id: { type: 'string' },
          config: { type: 'object' },
          events: { type: 'array', items: { type: 'string' } },
          page_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Pixel not found' });

    const { name, type, pixel_id, config, events, page_ids } = request.body;

    db.prepare(`
      UPDATE pixels SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        pixel_id = COALESCE(?, pixel_id),
        config = COALESCE(?, config),
        events = COALESCE(?, events)
      WHERE id = ?
    `).run(
      name || null, type || null, pixel_id || null,
      config ? JSON.stringify(config) : null,
      events ? JSON.stringify(events) : null,
      id
    );

    // Update page associations if provided
    if (page_ids !== undefined) {
      db.prepare('DELETE FROM pixel_pages WHERE pixel_id = ?').run(id);
      if (page_ids.length > 0) {
        const insertPage = db.prepare('INSERT OR IGNORE INTO pixel_pages (pixel_id, page_id) VALUES (?, ?)');
        for (const pageId of page_ids) {
          insertPage.run(id, pageId);
        }
      }
    }

    const pixel = db.prepare('SELECT * FROM pixels WHERE id = ?').get(id);
    const pageRows = db.prepare('SELECT page_id FROM pixel_pages WHERE pixel_id = ?').all(id);
    return {
      ...parsePixelRow(pixel),
      page_ids: pageRows.map(r => r.page_id),
    };
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
