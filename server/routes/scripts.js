// server/routes/scripts.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function scriptsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/scripts
  fastify.get('/scripts', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM scripts ORDER BY created_at DESC').all();
  });

  // GET /api/scripts/:id
  fastify.get('/scripts/:id', async (request, reply) => {
    const db = getDb();
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(request.params.id);
    if (!script) return reply.code(404).send({ error: 'Script not found' });
    return script;
  });

  // POST /api/scripts
  fastify.post('/scripts', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'position', 'code'],
        properties: {
          name: { type: 'string' },
          position: { type: 'string', enum: ['head', 'body_start', 'body_end'] },
          code: { type: 'string' },
          active: { type: 'integer', default: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, position, code, active } = request.body;

    db.prepare('INSERT INTO scripts (id, name, position, code, active) VALUES (?, ?, ?, ?, ?)').run(
      id, name, position, code, active !== undefined ? active : 1
    );

    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    reply.code(201).send(script);
  });

  // PUT /api/scripts/:id
  fastify.put('/scripts/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          position: { type: 'string', enum: ['head', 'body_start', 'body_end'] },
          code: { type: 'string' },
          active: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Script not found' });

    const { name, position, code, active } = request.body;

    db.prepare(`
      UPDATE scripts SET
        name = COALESCE(?, name),
        position = COALESCE(?, position),
        code = COALESCE(?, code),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name || null, position || null, code || null, active !== undefined ? active : null, id);

    return db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
  });

  // DELETE /api/scripts/:id
  fastify.delete('/scripts/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM scripts WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Script not found' });

    db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
    return { ok: true };
  });
}
