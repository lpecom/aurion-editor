// server/routes/copier.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { scrapeUrl } from '../lib/scraper.js';
import { cleanHtml } from '../lib/cleaner.js';
import { downloadAssets } from '../lib/asset-downloader.js';

export default async function copierRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /api/copier/scrape
  fastify.post('/copier/scrape', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { url } = request.body;

    // Determine server origin for absolute asset paths
    const protocol = request.protocol || 'http';
    const host = request.hostname || 'localhost:3001';
    const serverOrigin = `${protocol}://${host}`;

    try {
      // 1. Scrape the page
      request.log.info({ url }, 'Scraping page');
      const scrapeResult = await scrapeUrl(url);

      // 2. Extract original title
      const titleMatch = scrapeResult.html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const originalTitle = titleMatch ? titleMatch[1].trim() : '';

      // 3. Clean the HTML
      request.log.info('Cleaning HTML');
      const cleanResult = cleanHtml(scrapeResult.html);

      // 4. Download assets
      request.log.info('Downloading assets');
      const assetResult = await downloadAssets(cleanResult.html, url, serverOrigin);

      return {
        html: assetResult.html,
        original_title: originalTitle,
        assets_downloaded: assetResult.assetsDownloaded,
        removed_items: cleanResult.removedItems,
        warnings: assetResult.warnings,
        scrape_method: scrapeResult.method,
      };
    } catch (err) {
      const statusCode = err.statusCode || 500;
      request.log.error({ err, url }, 'Scrape failed');
      return reply.code(statusCode).send({
        error: err.message || 'Erro ao clonar página',
      });
    }
  });

  // POST /api/copier/save
  fastify.post('/copier/save', {
    schema: {
      body: {
        type: 'object',
        required: ['html', 'title', 'slug', 'type'],
        properties: {
          html: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          type: { type: 'string', enum: ['pv', 'advertorial'] },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { html, title, slug, type } = request.body;

    // Check slug uniqueness
    const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (existing) {
      return reply.code(409).send({ error: 'Slug já existe' });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO pages (id, title, slug, type, lang, status, html_content)
      VALUES (?, ?, ?, ?, 'pt-BR', 'draft', ?)
    `).run(id, title, slug, type, html);

    const page = db.prepare('SELECT id, title, slug, type, status, created_at FROM pages WHERE id = ?').get(id);
    reply.code(201).send({ page });
  });
}
