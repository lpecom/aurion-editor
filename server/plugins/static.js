// server/plugins/static.js
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/index.js';
import { getDefaultCloudflareAccount, getFromR2, R2_IMAGES_BUCKET } from '../lib/cloudflare.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

function getMime(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function tryServeFile(reply, filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    reply.type(getMime(filePath)).send(content);
    return true;
  }
  return false;
}

/**
 * Get all page slugs associated with a domain (via page_domains or category_domains)
 */
function getDomainPageSlugs(domainHost) {
  const db = getDb();

  // Find the domain record
  const domain = db.prepare('SELECT id FROM domains WHERE domain = ?').get(domainHost);
  if (!domain) return null; // unknown domain

  // Pages directly linked to this domain
  const directPages = db.prepare(`
    SELECT p.slug FROM pages p
    JOIN page_domains pd ON pd.page_id = p.id
    WHERE pd.domain_id = ? AND p.status = 'published'
  `).all(domain.id);

  // Pages inherited via category
  const categoryPages = db.prepare(`
    SELECT p.slug FROM pages p
    JOIN categories c ON c.id = p.category_id
    JOIN category_domains cd ON cd.category_id = c.id
    WHERE cd.domain_id = ? AND p.status = 'published'
    AND p.id NOT IN (SELECT page_id FROM page_domains)
  `).all(domain.id);

  const slugs = new Set([
    ...directPages.map(p => p.slug),
    ...categoryPages.map(p => p.slug),
  ]);

  return slugs;
}

export default async function staticPlugin(fastify) {
  const distDir = path.join(ROOT, 'dist');
  const adminDistDir = path.join(ROOT, 'admin', 'dist');
  const adminIndexPath = path.join(adminDistDir, 'index.html');

  // Serve uploaded assets from /assets/imgs/
  // First checks local filesystem, then falls back to R2
  const uploadsDir = process.env.UPLOAD_DIR || path.join(ROOT, 'assets', 'imgs');
  fastify.get('/assets/imgs/*', async (request, reply) => {
    const filename = request.url.split('?')[0].replace('/assets/imgs/', '');
    const filePath = path.join(uploadsDir, filename);

    // Try local filesystem first
    if (tryServeFile(reply, filePath)) return reply;

    // Fall back to R2
    try {
      const cfAccount = getDefaultCloudflareAccount();
      if (cfAccount) {
        const result = await getFromR2(cfAccount, R2_IMAGES_BUCKET, filename);
        if (result) {
          // Cache locally so subsequent requests are fast
          try {
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(filePath, result.buffer);
          } catch (cacheErr) {
            // Non-fatal: filesystem might be read-only
          }

          reply
            .type(result.contentType)
            .header('cache-control', 'public, max-age=86400')
            .send(result.buffer);
          return reply;
        }
      }
    } catch (err) {
      // R2 fetch failed, return 404
    }

    return reply.code(404).send({ error: 'Not found' });
  });

  // Root — custom domains show their pages, main domain redirects to admin
  fastify.get('/', async (request, reply) => {
    if (request.isCustomDomain) {
      // Show first published page or a simple landing
      const slugs = getDomainPageSlugs(request.customDomainHost);
      if (slugs && slugs.size > 0) {
        const firstSlug = [...slugs][0];
        return reply.redirect(`/${firstSlug}`);
      }
      return reply.code(404).type('text/html').send('<h1>Site em construção</h1>');
    }
    return reply.redirect('/admin/');
  });

  // Serve admin SPA — only on main domain (blocked by onRequest hook for custom domains)
  fastify.get('/admin', async (request, reply) => {
    return reply.redirect('/admin/');
  });

  fastify.get('/admin/*', async (request, reply) => {
    const urlPath = request.url.split('?')[0];
    const relativePath = urlPath.replace(/^\/admin\/?/, '');

    // Try to serve the exact file from admin/dist/
    if (relativePath) {
      const filePath = path.join(adminDistDir, relativePath);
      if (tryServeFile(reply, filePath)) return reply;
    }

    // SPA fallback: serve index.html for any non-file route
    if (fs.existsSync(adminIndexPath)) {
      const content = fs.readFileSync(adminIndexPath, 'utf-8');
      return reply.type('text/html').send(content);
    }

    return reply.code(503).send({
      error: 'Admin app not built yet',
      hint: 'Run: npm run build:admin',
    });
  });

  // Catch-all for everything else (public site from dist/)
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const urlPath = request.url.split('?')[0];

    // For custom domains, check if the requested slug belongs to this domain
    if (request.isCustomDomain) {
      const slugs = getDomainPageSlugs(request.customDomainHost);

      if (!slugs) {
        // Unknown domain
        return reply.code(404).type('text/html').send('<h1>Domínio não configurado</h1>');
      }

      // Extract slug from URL path (e.g. /my-page → my-page)
      const requestedSlug = urlPath.replace(/^\//, '').replace(/\/$/, '');

      // Allow static assets for pages in this domain (CSS, JS, images within slug directories)
      const topLevelDir = requestedSlug.split('/')[0];
      if (slugs.has(topLevelDir) || slugs.has(requestedSlug)) {
        // Serve from dist/
        if (tryServeFile(reply, path.join(distDir, urlPath))) return reply;
        if (tryServeFile(reply, path.join(distDir, urlPath, 'index.html'))) return reply;
        if (tryServeFile(reply, path.join(distDir, `${urlPath}.html`))) return reply;
      }

      return reply.code(404).type('text/html').send('<h1>Página não encontrada</h1>');
    }

    // Main domain — serve any page from dist/
    if (tryServeFile(reply, path.join(distDir, urlPath))) return reply;
    if (tryServeFile(reply, path.join(distDir, urlPath, 'index.html'))) return reply;
    if (tryServeFile(reply, path.join(distDir, `${urlPath}.html`))) return reply;

    // 404 page from dist
    const notFoundPage = path.join(distDir, '404', 'index.html');
    if (fs.existsSync(notFoundPage)) {
      const content = fs.readFileSync(notFoundPage, 'utf-8');
      return reply.code(404).type('text/html').send(content);
    }

    // Redirect unknown routes to admin
    return reply.redirect('/admin/');
  });
}
