// server/routes/cloaker-rules.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function cloakerRulesRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/pages/:id/cloaker
  fastify.get('/pages/:id/cloaker', async (request, reply) => {
    const db = getDb();
    const rules = db.prepare('SELECT * FROM page_cloaker_rules WHERE page_id = ?').get(request.params.id);
    if (!rules) return reply.code(404).send({ error: 'No cloaker rules for this page' });
    // Parse JSON fields
    return {
      ...rules,
      url_whitelist: JSON.parse(rules.url_whitelist || '[]'),
      countries: JSON.parse(rules.countries || '[]'),
      devices: JSON.parse(rules.devices || '[]'),
      browsers: JSON.parse(rules.browsers || '[]'),
    };
  });

  // PUT /api/pages/:id/cloaker — create or update
  fastify.put('/pages/:id/cloaker', {
    schema: {
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'integer' },
          action: { type: 'string', enum: ['redirect', 'safe_page'] },
          redirect_url: { type: 'string' },
          safe_page_id: { type: ['string', 'null'] },
          url_whitelist: { type: 'array', items: { type: 'string' } },
          countries_mode: { type: 'string', enum: ['allow', 'block'] },
          countries: { type: 'array', items: { type: 'string' } },
          devices_mode: { type: 'string', enum: ['allow', 'block'] },
          devices: { type: 'array', items: { type: 'string' } },
          browsers_mode: { type: 'string', enum: ['allow', 'block'] },
          browsers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const pageId = request.params.id;

    // Verify page exists
    const page = db.prepare('SELECT id, slug, status FROM pages WHERE id = ?').get(pageId);
    if (!page) return reply.code(404).send({ error: 'Page not found' });

    const {
      enabled = 1,
      action = 'redirect',
      redirect_url = '',
      safe_page_id = null,
      url_whitelist = [],
      countries_mode = 'allow',
      countries = [],
      devices_mode = 'allow',
      devices = [],
      browsers_mode = 'allow',
      browsers = [],
    } = request.body;

    const existing = db.prepare('SELECT id FROM page_cloaker_rules WHERE page_id = ?').get(pageId);

    if (existing) {
      db.prepare(`
        UPDATE page_cloaker_rules SET
          enabled = ?, action = ?, redirect_url = ?, safe_page_id = ?,
          url_whitelist = ?, countries_mode = ?, countries = ?,
          devices_mode = ?, devices = ?, browsers_mode = ?, browsers = ?,
          updated_at = datetime('now')
        WHERE page_id = ?
      `).run(
        enabled, action, redirect_url, safe_page_id,
        JSON.stringify(url_whitelist), countries_mode, JSON.stringify(countries),
        devices_mode, JSON.stringify(devices), browsers_mode, JSON.stringify(browsers),
        pageId
      );
    } else {
      db.prepare(`
        INSERT INTO page_cloaker_rules (id, page_id, enabled, action, redirect_url, safe_page_id, url_whitelist, countries_mode, countries, devices_mode, devices, browsers_mode, browsers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), pageId, enabled, action, redirect_url, safe_page_id,
        JSON.stringify(url_whitelist), countries_mode, JSON.stringify(countries),
        devices_mode, JSON.stringify(devices), browsers_mode, JSON.stringify(browsers)
      );
    }

    // Auto-republish if page is published on CF domain
    if (page.status === 'published') {
      try {
        const { publishPage } = await import('../../lib/publish.js');
        const fullPage = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
        await publishPage(fullPage, db);
      } catch (err) {
        console.error(`Auto-republish after cloaker update failed: ${err.message}`);
      }
    }

    const rules = db.prepare('SELECT * FROM page_cloaker_rules WHERE page_id = ?').get(pageId);
    return {
      ...rules,
      url_whitelist: JSON.parse(rules.url_whitelist || '[]'),
      countries: JSON.parse(rules.countries || '[]'),
      devices: JSON.parse(rules.devices || '[]'),
      browsers: JSON.parse(rules.browsers || '[]'),
    };
  });

  // DELETE /api/pages/:id/cloaker
  fastify.delete('/pages/:id/cloaker', async (request, reply) => {
    const db = getDb();
    const pageId = request.params.id;

    const existing = db.prepare('SELECT id FROM page_cloaker_rules WHERE page_id = ?').get(pageId);
    if (!existing) return reply.code(404).send({ error: 'No cloaker rules for this page' });

    db.prepare('DELETE FROM page_cloaker_rules WHERE page_id = ?').run(pageId);

    // Auto-republish to remove cloaker from R2
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
    if (page && page.status === 'published') {
      try {
        const { publishPage } = await import('../../lib/publish.js');
        await publishPage(page, db);
      } catch (err) {
        console.error(`Auto-republish after cloaker delete failed: ${err.message}`);
      }
    }

    return { ok: true };
  });
}
