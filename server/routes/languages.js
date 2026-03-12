// server/routes/languages.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function languagesRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/languages
  fastify.get('/languages', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM languages ORDER BY created_at DESC').all();
  });

  // POST /api/languages
  fastify.post('/languages', {
    schema: {
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          flag: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { code, name, flag } = request.body;

    const existing = db.prepare('SELECT id FROM languages WHERE code = ?').get(code);
    if (existing) {
      return reply.code(409).send({ error: 'Language code already exists' });
    }

    db.prepare('INSERT INTO languages (id, code, name, flag) VALUES (?, ?, ?, ?)').run(
      id, code, name, flag || null
    );

    const language = db.prepare('SELECT * FROM languages WHERE id = ?').get(id);
    reply.code(201).send(language);
  });

  // PUT /api/languages/:id
  fastify.put('/languages/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          flag: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM languages WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Language not found' });

    const { code, name, flag } = request.body;

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const codeTaken = db.prepare('SELECT id FROM languages WHERE code = ? AND id != ?').get(code, id);
      if (codeTaken) {
        return reply.code(409).send({ error: 'Language code already exists' });
      }
    }

    db.prepare(`
      UPDATE languages SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        flag = COALESCE(?, flag)
      WHERE id = ?
    `).run(code || null, name || null, flag || null, id);

    return db.prepare('SELECT * FROM languages WHERE id = ?').get(id);
  });

  // DELETE /api/languages/:id
  fastify.delete('/languages/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const language = db.prepare('SELECT * FROM languages WHERE id = ?').get(id);
    if (!language) return reply.code(404).send({ error: 'Language not found' });

    // Check if translations exist with this language code
    const translations = db.prepare(
      'SELECT COUNT(*) as cnt FROM pages WHERE source_page_id IS NOT NULL AND lang = ?'
    ).get(language.code);

    if (translations.cnt > 0) {
      return reply.code(409).send({
        error: `Cannot delete language: ${translations.cnt} translation(s) exist using this language`,
      });
    }

    db.prepare('DELETE FROM languages WHERE id = ?').run(id);
    return { ok: true };
  });
}
