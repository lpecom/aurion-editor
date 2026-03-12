// server/routes/page-parents.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function pageParentsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/pages/:id/auxiliares — list auxiliar pages linked to a PV/advertorial
  fastify.get('/pages/:id/auxiliares', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const pages = db.prepare(
      'SELECT p.*, pp.is_primary FROM pages p JOIN page_parents pp ON pp.page_id = p.id WHERE pp.parent_page_id = ?'
    ).all(id);

    return pages.map(p => ({
      ...p,
      frontmatter: p.frontmatter ? JSON.parse(p.frontmatter) : null,
      category_config: p.category_config ? JSON.parse(p.category_config) : null,
    }));
  });

  // PUT /api/pages/:id/parents — manage shared parents for an auxiliar page
  fastify.put('/pages/:id/parents', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { add = [], remove = [] } = request.body;

    // Validate the page is type 'auxiliar'
    const page = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(id);
    if (!page) return reply.code(404).send({ error: 'Page not found' });
    if (page.type !== 'auxiliar') {
      return reply.code(400).send({ error: 'Page must be of type auxiliar' });
    }

    // Process additions
    for (const parentId of add) {
      const parent = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(parentId);
      if (!parent) {
        return reply.code(400).send({ error: `Parent page ${parentId} not found` });
      }
      if (parent.type !== 'pv' && parent.type !== 'advertorial') {
        return reply.code(400).send({ error: `Parent page ${parentId} must be of type pv or advertorial` });
      }
      db.prepare(
        'INSERT OR IGNORE INTO page_parents (page_id, parent_page_id, is_primary) VALUES (?, ?, 0)'
      ).run(id, parentId);
    }

    // Process removals (cannot remove primary parent)
    for (const parentId of remove) {
      db.prepare(
        'DELETE FROM page_parents WHERE page_id = ? AND parent_page_id = ? AND is_primary = 0'
      ).run(id, parentId);
    }

    // Return updated parent list
    const parents = db.prepare(
      'SELECT p.*, pp.is_primary FROM pages p JOIN page_parents pp ON pp.parent_page_id = p.id WHERE pp.page_id = ?'
    ).all(id);

    return parents.map(p => ({
      ...p,
      frontmatter: p.frontmatter ? JSON.parse(p.frontmatter) : null,
      category_config: p.category_config ? JSON.parse(p.category_config) : null,
    }));
  });

  // PUT /api/pages/:id/primary-parent — change the primary parent
  fastify.put('/pages/:id/primary-parent', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { parent_page_id } = request.body;

    // Validate page is type 'auxiliar'
    const page = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(id);
    if (!page) return reply.code(404).send({ error: 'Page not found' });
    if (page.type !== 'auxiliar') {
      return reply.code(400).send({ error: 'Page must be of type auxiliar' });
    }

    // Validate new parent is type 'pv' or 'advertorial'
    const parent = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(parent_page_id);
    if (!parent) return reply.code(404).send({ error: 'Parent page not found' });
    if (parent.type !== 'pv' && parent.type !== 'advertorial') {
      return reply.code(400).send({ error: 'Parent page must be of type pv or advertorial' });
    }

    // Set old primary to is_primary=0
    db.prepare(
      'UPDATE page_parents SET is_primary = 0 WHERE page_id = ? AND is_primary = 1'
    ).run(id);

    // Set new parent to is_primary=1 (upsert)
    db.prepare(
      'INSERT INTO page_parents (page_id, parent_page_id, is_primary) VALUES (?, ?, 1) ON CONFLICT(page_id, parent_page_id) DO UPDATE SET is_primary = 1'
    ).run(id, parent_page_id);

    // Return updated parent list
    const parents = db.prepare(
      'SELECT p.*, pp.is_primary FROM pages p JOIN page_parents pp ON pp.parent_page_id = p.id WHERE pp.page_id = ?'
    ).all(id);

    return parents.map(p => ({
      ...p,
      frontmatter: p.frontmatter ? JSON.parse(p.frontmatter) : null,
      category_config: p.category_config ? JSON.parse(p.category_config) : null,
    }));
  });
}
