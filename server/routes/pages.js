// server/routes/pages.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publishPage, unpublishPage } from '../../lib/publish.js';
import { translateHtml } from '../lib/translator.js';
import { purgeZoneCacheAll } from '../lib/cloudflare.js';

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

  // Check primary parent domains for auxiliar pages
  const parentDomain = db.prepare(`
    SELECT d.*, pd.is_primary, 'parent' as source
    FROM domains d
    JOIN page_domains pd ON pd.domain_id = d.id
    JOIN page_parents pp ON pp.parent_page_id = pd.page_id
    WHERE pp.page_id = ? AND pp.is_primary = 1
    ORDER BY pd.is_primary DESC, d.domain ASC
  `).all(page.id);
  if (parentDomain.length > 0) return parentDomain;

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
    const { type, status, lang, domain, variant_group } = request.query;
    const db = getDb();

    let sql = 'SELECT id, title, slug, type, lang, domain, status, frontmatter, category_config, variant_group, variant_label, created_at, updated_at FROM pages WHERE 1=1';
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
    if (variant_group) {
      sql += ' AND variant_group = ?';
      params.push(variant_group);
    }

    sql += ' ORDER BY updated_at DESC';

    const rawPages = db.prepare(sql).all(...params);
    const pages = rawPages.map(p => ({
      ...p,
      frontmatter: p.frontmatter ? JSON.parse(p.frontmatter) : null,
      category_config: p.category_config ? JSON.parse(p.category_config) : null,
      domains: getEffectiveDomains(db, p),
    }));

    if (type === 'auxiliar') {
      for (const page of pages) {
        page.parent_pages = db.prepare(`
          SELECT p.id, p.title, p.slug, p.type, pp.is_primary
          FROM pages p JOIN page_parents pp ON pp.parent_page_id = p.id
          WHERE pp.page_id = ?
          ORDER BY pp.is_primary DESC
        `).all(page.id);
      }
    }

    return pages;
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
          type: { type: 'string', enum: ['pv', 'advertorial', 'auxiliar'] },
          lang: { type: 'string' },
          domain: { type: 'string' },
          frontmatter: { type: 'object' },
          category_config: { type: 'object' },
          parent_page_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { title, slug, type, lang, domain, frontmatter, category_config, parent_page_id } = request.body;

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

    if (type === 'auxiliar') {
      if (!parent_page_id) {
        // Roll back the insert
        db.prepare('DELETE FROM pages WHERE id = ?').run(id);
        return reply.code(400).send({ error: 'Auxiliar pages require parent_page_id' });
      }

      const parentPage = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(parent_page_id);
      if (!parentPage || (parentPage.type !== 'pv' && parentPage.type !== 'advertorial')) {
        db.prepare('DELETE FROM pages WHERE id = ?').run(id);
        return reply.code(400).send({ error: 'Parent page must be PV or advertorial' });
      }

      db.prepare('INSERT INTO page_parents (page_id, parent_page_id, is_primary) VALUES (?, ?, 1)').run(id, parent_page_id);
    }

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    reply.code(201).send({
      ...page,
      frontmatter: page.frontmatter ? JSON.parse(page.frontmatter) : null,
      category_config: page.category_config ? JSON.parse(page.category_config) : null,
    });
  });

  // POST /api/pages/:id/duplicate — duplicate page as A/B variant
  fastify.post('/pages/:id/duplicate', {
    schema: {
      body: {
        type: 'object',
        required: ['title', 'slug'],
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { title, slug } = request.body;

    // 1. Fetch source page
    const source = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!source) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    // 2. Check slug uniqueness
    const slugExists = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (slugExists) {
      return reply.code(409).send({ error: 'Slug already exists' });
    }

    // 3. Determine variant_group
    const variantGroup = source.variant_group || source.slug;

    // 4. If source doesn't have variant_label yet, update it
    if (!source.variant_label) {
      db.prepare(`
        UPDATE pages SET variant_group = ?, variant_label = 'A', updated_at = datetime('now') WHERE id = ?
      `).run(variantGroup, id);
    }

    // 5. Count existing variants, assign next letter
    const count = db.prepare('SELECT COUNT(*) as cnt FROM pages WHERE variant_group = ?').get(variantGroup).cnt;
    const nextLabel = String.fromCharCode(65 + count); // 65 = 'A', so if count=1 (source with 'A'), next is 'B'

    // 6. Insert new page
    const newId = randomUUID();
    db.prepare(`
      INSERT INTO pages (id, title, slug, html_content, project_data, type, lang, status, category_id, category_config, frontmatter, variant_group, variant_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(
      newId,
      title,
      slug,
      source.html_content,
      source.project_data,
      source.type,
      source.lang,
      source.category_id,
      source.category_config,
      source.frontmatter,
      variantGroup,
      nextLabel
    );

    // 7. Return new page
    const newPage = db.prepare('SELECT * FROM pages WHERE id = ?').get(newId);
    reply.code(201).send({
      ...newPage,
      frontmatter: newPage.frontmatter ? JSON.parse(newPage.frontmatter) : null,
      category_config: newPage.category_config ? JSON.parse(newPage.category_config) : null,
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
        await unpublishPage(page, db);
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

  // POST /api/pages/:id/purge-cache — purge CDN cache for all domains of this page
  fastify.post('/pages/:id/purge-cache', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!page) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    const results = [];

    // Get all CF domains associated with this page
    const pageDomains = db.prepare(`
      SELECT d.* FROM domains d
      JOIN page_domains pd ON pd.domain_id = d.id
      WHERE pd.page_id = ? AND d.cloudflare_account_id IS NOT NULL AND d.cloudflare_zone_id IS NOT NULL
    `).all(id);

    let cfDomains = [...pageDomains];

    // Also check category domains
    if (page.category_id) {
      const catDomains = db.prepare(`
        SELECT d.* FROM domains d
        JOIN category_domains cd ON cd.domain_id = d.id
        WHERE cd.category_id = ? AND d.cloudflare_account_id IS NOT NULL AND d.cloudflare_zone_id IS NOT NULL
      `).all(page.category_id);
      for (const cd of catDomains) {
        if (!cfDomains.find(d => d.id === cd.id)) cfDomains.push(cd);
      }
    }

    for (const domain of cfDomains) {
      try {
        const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
        if (cfAccount) {
          await purgeZoneCacheAll(cfAccount, domain.cloudflare_zone_id);
          results.push({ domain: domain.domain, status: 'ok' });
        }
      } catch (err) {
        results.push({ domain: domain.domain, status: 'error', message: err.message });
      }
    }

    if (cfDomains.length === 0) {
      return reply.code(400).send({ error: 'Nenhum domínio com Cloudflare configurado' });
    }

    return { ok: true, results };
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

  // POST /api/pages/:id/translate — create translation of a page
  fastify.post('/pages/:id/translate', {
    schema: {
      body: {
        type: 'object',
        required: ['target_lang', 'provider_id'],
        properties: {
          target_lang: { type: 'string' },
          provider_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { target_lang, provider_id } = request.body;

    // Fetch source page
    const source = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!source) {
      return reply.code(404).send({ error: 'Page not found' });
    }

    // Check if translation already exists for this source + target_lang
    const existingTranslation = db.prepare(
      'SELECT id FROM pages WHERE source_page_id = ? AND lang = ?'
    ).get(id, target_lang);
    if (existingTranslation) {
      return reply.code(409).send({ error: 'Translation already exists for this language' });
    }

    // Fetch provider
    const provider = db.prepare('SELECT * FROM translation_providers WHERE id = ?').get(provider_id);
    if (!provider) {
      return reply.code(404).send({ error: 'Translation provider not found' });
    }

    // Translate HTML
    let translatedHtml;
    try {
      translatedHtml = await translateHtml(source.html_content || '', target_lang, provider);
    } catch (err) {
      request.log.error({ err }, 'Translation failed');
      return reply.code(422).send({ error: `Translation failed: ${err.message}` });
    }

    // Create new page with translation
    const newId = randomUUID();
    const langCode = target_lang.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newSlug = `${source.slug}-${langCode}`;

    // Check slug uniqueness, append suffix if needed
    let finalSlug = newSlug;
    const slugExists = db.prepare('SELECT id FROM pages WHERE slug = ?').get(finalSlug);
    if (slugExists) {
      finalSlug = `${newSlug}-${Date.now()}`;
    }

    db.prepare(`
      INSERT INTO pages (id, title, slug, type, lang, html_content, project_data, category_id, category_config, frontmatter, source_page_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      newId,
      source.title,
      finalSlug,
      source.type,
      target_lang,
      translatedHtml,
      source.project_data,
      source.category_id,
      source.category_config,
      source.frontmatter,
      id
    );

    const newPage = db.prepare('SELECT * FROM pages WHERE id = ?').get(newId);
    reply.code(201).send({
      ...newPage,
      frontmatter: newPage.frontmatter ? JSON.parse(newPage.frontmatter) : null,
      category_config: newPage.category_config ? JSON.parse(newPage.category_config) : null,
    });
  });

  // GET /api/translations — list all translated pages
  fastify.get('/translations', async (request) => {
    const db = getDb();
    const { lang, source_id } = request.query;

    let sql = `
      SELECT
        p.id, p.title, p.slug, p.type, p.lang, p.status,
        p.source_page_id, p.created_at, p.updated_at,
        sp.title as source_title, sp.slug as source_slug
      FROM pages p
      LEFT JOIN pages sp ON sp.id = p.source_page_id
      WHERE p.source_page_id IS NOT NULL
    `;
    const params = [];

    if (lang) {
      sql += ' AND p.lang = ?';
      params.push(lang);
    }
    if (source_id) {
      sql += ' AND p.source_page_id = ?';
      params.push(source_id);
    }

    sql += ' ORDER BY p.updated_at DESC';

    return db.prepare(sql).all(...params);
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
      await unpublishPage(page, db);

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
