// server/routes/pages.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publishPage, unpublishPage } from '../../lib/publish.js';

function getPageDomains(db, pageId) {
  return db.prepare(`
    SELECT d.*, pd.is_primary, 'page' as source
    FROM domains d
    JOIN page_domains pd ON pd.domain_id = d.id
    WHERE pd.page_id = ?
    ORDER BY pd.is_primary DESC, d.domain ASC
  `).all(pageId);
}

function getEffectiveDomains(db, page) {
  const pageDomains = getPageDomains(db, page.id);
  if (pageDomains.length > 0) return pageDomains;

  if (page.category_id) {
    return db.prepare(`
      SELECT d.*, cd.is_primary, 'category' as source
      FROM domains d
      JOIN category_domains cd ON cd.domain_id = d.id
      WHERE cd.category_id = ?
      ORDER BY cd.is_primary DESC, d.domain ASC
    `).all(page.category_id);
  }

  return [];
}

export default async function pagesRoutes(fastify) {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/pages — list with filters
  fastify.get('/pages', async (request, reply) => {
    const { type, status, lang, domain } = request.query;
    const db = getDb();

    let sql = 'SELECT id, title, slug, type, lang, domain, status, frontmatter, category_config, created_at, updated_at FROM pages WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (lang) {
      sql += ' AND lang = ?';
      params.push(lang);
    }
    if (domain) {
      sql += ' AND domain = ?';
      params.push(domain);
    }

    sql += ' ORDER BY updated_at DESC';

    const pages = db.prepare(sql).all(...params);
    return pages.map(p => ({
      ...p,
      frontmatter: p.frontmatter ? JSON.parse(p.frontmatter) : null,
      category_config: p.category_config ? JSON.parse(p.category_config) : null,
      domains: getEffectiveDomains(db, p),
    }));
  });

  // GET /api/pages/:id
  fastify.get('/pages/:id', async (request, reply) => {
    const db = getDb();
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(request.params.id);

    if (!page) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    return {
      ...page,
      frontmatter: page.frontmatter ? JSON.parse(page.frontmatter) : null,
      category_config: page.category_config ? JSON.parse(page.category_config) : null,
    };
  });

  // POST /api/pages — create
  fastify.post('/pages', {
    schema: {
      body: {
        type: 'object',
        required: ['title', 'slug', 'type'],
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
          type: { type: 'string', enum: ['pv', 'advertorial'] },
          lang: { type: 'string' },
          domain: { type: 'string' },
          frontmatter: { type: 'object' },
          category_config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { title, slug, type, lang, domain, frontmatter, category_config } = request.body;

    // Check slug uniqueness
    const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (existing) {
      return reply.code(409).send({ error: 'Slug already exists' });
    }

    db.prepare(`
      INSERT INTO pages (id, title, slug, type, lang, domain, frontmatter, category_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, title, slug, type,
      lang || 'pt-BR',
      domain || null,
      frontmatter ? JSON.stringify(frontmatter) : null,
      category_config ? JSON.stringify(category_config) : null
    );

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    reply.code(201).send({
      ...page,
      frontmatter: page.frontmatter ? JSON.parse(page.frontmatter) : null,
      category_config: page.category_config ? JSON.parse(page.category_config) : null,
    });
  });

  // PUT /api/pages/:id — update metadata
  fastify.put('/pages/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
          type: { type: 'string', enum: ['pv', 'advertorial'] },
          lang: { type: 'string' },
          domain: { type: 'string' },
          category_id: { type: 'string' },
          frontmatter: { type: 'object' },
          category_config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    const { title, slug, type, lang, domain, category_id, frontmatter, category_config } = request.body;

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugTaken = db.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').get(slug, id);
      if (slugTaken) {
        return reply.code(409).send({ error: 'Slug already exists' });
      }
    }

    db.prepare(`
      UPDATE pages SET
        title = COALESCE(?, title),
        slug = COALESCE(?, slug),
        type = COALESCE(?, type),
        lang = COALESCE(?, lang),
        domain = COALESCE(?, domain),
        category_id = COALESCE(?, category_id),
        frontmatter = COALESCE(?, frontmatter),
        category_config = COALESCE(?, category_config),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title || null,
      slug || null,
      type || null,
      lang || null,
      domain !== undefined ? domain : null,
      category_id || null,
      frontmatter ? JSON.stringify(frontmatter) : null,
      category_config ? JSON.stringify(category_config) : null,
      id
    );

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    return {
      ...page,
      frontmatter: page.frontmatter ? JSON.parse(page.frontmatter) : null,
      category_config: page.category_config ? JSON.parse(page.category_config) : null,
    };
  });

  // PUT /api/pages/:id/content — save HTML + project data from editor
  fastify.put('/pages/:id/content', {
    schema: {
      body: {
        type: 'object',
        properties: {
          html_content: { type: 'string' },
          project_data: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM pages WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    const { html_content, project_data } = request.body;

    if (html_content && project_data) {
      db.prepare(`
        UPDATE pages SET html_content = ?, project_data = ?, updated_at = datetime('now') WHERE id = ?
      `).run(html_content, project_data, id);
    } else if (html_content) {
      db.prepare(`
        UPDATE pages SET html_content = ?, updated_at = datetime('now') WHERE id = ?
      `).run(html_content, id);
    } else if (project_data) {
      db.prepare(`
        UPDATE pages SET project_data = ?, updated_at = datetime('now') WHERE id = ?
      `).run(project_data, id);
    }

    return { ok: true };
  });

  // DELETE /api/pages/:id
  fastify.delete('/pages/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!page) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    // If published, unpublish first
    if (page.status === 'published') {
      try {
        await unpublishPage(page);
      } catch (err) {
        // Continue with deletion even if unpublish fails
        request.log.warn({ err }, 'Failed to unpublish page before deletion');
      }
    }

    db.prepare('DELETE FROM pages WHERE id = ?').run(id);
    return { ok: true };
  });

  // POST /api/pages/:id/publish
  fastify.post('/pages/:id/publish', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!page) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    if (!page.html_content) {
      return reply.code(400).send({ error: 'Page has no content to publish' });
    }

    try {
      await publishPage(page, db);

      db.prepare("UPDATE pages SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(id);

      const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
      return {
        ...updated,
        frontmatter: updated.frontmatter ? JSON.parse(updated.frontmatter) : null,
        category_config: updated.category_config ? JSON.parse(updated.category_config) : null,
      };
    } catch (err) {
      request.log.error({ err }, 'Failed to publish page');
      return reply.code(500).send({ error: 'Failed to publish page' });
    }
  });

  // --- Page Domain Association ---

  // PUT /api/pages/:id/domains — set custom domains for a specific page
  fastify.put('/pages/:id/domains', {
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

    const existing = db.prepare('SELECT id FROM pages WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Page not found' });

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM page_domains WHERE page_id = ?').run(id);
      const insert = db.prepare('INSERT INTO page_domains (page_id, domain_id, is_primary) VALUES (?, ?, ?)');
      for (const domainId of domain_ids) {
        insert.run(id, domainId, domainId === primary_domain_id ? 1 : 0);
      }
    });
    tx();

    return { ok: true, domains: getPageDomains(db, id) };
  });

  // GET /api/pages/:id/domains — get domains for page (own + inherited from category)
  fastify.get('/pages/:id/domains', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const page = db.prepare('SELECT id, category_id FROM pages WHERE id = ?').get(id);
    if (!page) return reply.code(404).send({ error: 'Page not found' });

    const pageDomains = getPageDomains(db, id);
    let categoryDomains = [];

    if (page.category_id) {
      categoryDomains = db.prepare(`
        SELECT d.*, cd.is_primary, 'category' as source
        FROM domains d
        JOIN category_domains cd ON cd.domain_id = d.id
        WHERE cd.category_id = ?
        ORDER BY cd.is_primary DESC, d.domain ASC
      `).all(page.category_id);
    }

    return {
      page_domains: pageDomains,
      category_domains: categoryDomains,
      effective_domains: pageDomains.length > 0 ? pageDomains : categoryDomains,
    };
  });

  // POST /api/pages/:id/unpublish
  fastify.post('/pages/:id/unpublish', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!page) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    try {
      await unpublishPage(page);

      db.prepare("UPDATE pages SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(id);

      const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
      return {
        ...updated,
        frontmatter: updated.frontmatter ? JSON.parse(updated.frontmatter) : null,
        category_config: updated.category_config ? JSON.parse(updated.category_config) : null,
      };
    } catch (err) {
      request.log.error({ err }, 'Failed to unpublish page');
      return reply.code(500).send({ error: 'Failed to unpublish page' });
    }
  });
}
