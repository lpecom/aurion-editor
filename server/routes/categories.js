// server/routes/categories.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function categoriesRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/categories
  fastify.get('/categories', async (request) => {
    const db = getDb();
    const { type } = request.query;

    let sql = 'SELECT * FROM categories WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY name ASC';
    const categories = db.prepare(sql).all(...params);

    return categories.map(c => ({
      ...c,
      config: c.config ? JSON.parse(c.config) : null,
      domains: getCategoryDomains(db, c.id),
    }));
  });

  // GET /api/categories/:id
  fastify.get('/categories/:id', async (request, reply) => {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(request.params.id);
    if (!category) return reply.code(404).send({ error: 'Category not found' });

    return {
      ...category,
      config: category.config ? JSON.parse(category.config) : null,
      domains: getCategoryDomains(db, category.id),
    };
  });

  // POST /api/categories
  fastify.post('/categories', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['pv', 'advertorial', 'auxiliar'] },
          config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, type, config } = request.body;

    db.prepare('INSERT INTO categories (id, name, type, config) VALUES (?, ?, ?, ?)').run(
      id, name, type, config ? JSON.stringify(config) : null
    );

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    reply.code(201).send({
      ...created,
      config: created.config ? JSON.parse(created.config) : null,
      domains: [],
    });
  });

  // PUT /api/categories/:id
  fastify.put('/categories/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Category not found' });

    const { name, type, config } = request.body;

    db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        config = COALESCE(?, config)
      WHERE id = ?
    `).run(name || null, type || null, config ? JSON.stringify(config) : null, id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return {
      ...updated,
      config: updated.config ? JSON.parse(updated.config) : null,
      domains: getCategoryDomains(db, id),
    };
  });

  // DELETE /api/categories/:id
  fastify.delete('/categories/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Category not found' });

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { ok: true };
  });

  // --- Category Domain Association ---

  // PUT /api/categories/:id/domains — set domains for category
  fastify.put('/categories/:id/domains', {
    schema: {
      body: {
        type: 'object',
        required: ['domain_ids'],
        properties: {
          domain_ids: { type: 'array', items: { type: 'string' } },
          primary_domain_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { domain_ids, primary_domain_id } = request.body;

    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Category not found' });

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM category_domains WHERE category_id = ?').run(id);
      const insert = db.prepare('INSERT INTO category_domains (category_id, domain_id, is_primary) VALUES (?, ?, ?)');
      for (const domainId of domain_ids) {
        insert.run(id, domainId, domainId === primary_domain_id ? 1 : 0);
      }
    });
    tx();

    return { ok: true, domains: getCategoryDomains(db, id) };
  });

  // GET /api/categories/:id/domains
  fastify.get('/categories/:id/domains', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Category not found' });

    return getCategoryDomains(db, id);
  });
}

function getCategoryDomains(db, categoryId) {
  return db.prepare(`
    SELECT d.*, cd.is_primary
    FROM domains d
    JOIN category_domains cd ON cd.domain_id = d.id
    WHERE cd.category_id = ?
    ORDER BY cd.is_primary DESC, d.domain ASC
  `).all(categoryId);
}
