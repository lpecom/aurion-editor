// server/plugins/static.js
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    reply.type(getMime(filePath)).send(fs.createReadStream(filePath));
    return true;
  }
  return false;
}

export default async function staticPlugin(fastify) {
  const distDir = path.join(ROOT, 'dist');
  const adminDistDir = path.join(ROOT, 'admin', 'dist');
  const adminIndexPath = path.join(adminDistDir, 'index.html');

  // Root redirect to admin
  fastify.get('/', async (request, reply) => {
    reply.redirect('/admin/');
  });

  // Serve admin SPA — handle all /admin/* routes manually
  fastify.get('/admin', async (request, reply) => {
    reply.redirect('/admin/');
  });

  fastify.get('/admin/*', async (request, reply) => {
    const urlPath = request.url.split('?')[0];
    const relativePath = urlPath.replace(/^\/admin\/?/, '');

    // Try to serve the exact file from admin/dist/
    if (relativePath) {
      const filePath = path.join(adminDistDir, relativePath);
      if (tryServeFile(reply, filePath)) return;
    }

    // SPA fallback: serve index.html for any non-file route
    if (fs.existsSync(adminIndexPath)) {
      reply.type('text/html').send(fs.createReadStream(adminIndexPath));
    } else {
      reply.code(503).send({
        error: 'Admin app not built yet',
        hint: 'Run: npm run build:admin',
      });
    }
  });

  // Catch-all for everything else (public site from dist/)
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const urlPath = request.url.split('?')[0];

    // Try exact file in dist/
    if (tryServeFile(reply, path.join(distDir, urlPath))) return;

    // Try clean URL: /slug → dist/slug/index.html
    if (tryServeFile(reply, path.join(distDir, urlPath, 'index.html'))) return;

    // Try .html extension
    if (tryServeFile(reply, path.join(distDir, `${urlPath}.html`))) return;

    // 404 page from dist
    const notFoundPage = path.join(distDir, '404', 'index.html');
    if (fs.existsSync(notFoundPage)) {
      reply.code(404).type('text/html').send(fs.createReadStream(notFoundPage));
      return;
    }

    // Redirect unknown routes to admin
    reply.redirect('/admin/');
  });
}
